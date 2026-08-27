import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import type { AuthorizationDenialSink } from "@/authorization/denial-audit";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { communitySlugCandidate, normalizeCommunitySlug } from "@/community/create-community";
import { getDb } from "@/db/client";
import {
  communities,
  communityAuditEvents,
  communitySupportedPrograms,
  organizedPlayPrograms,
} from "@/db/schema";

const MAX_SLUG_LENGTH = 80;

export const updateCommunitySettingsInputSchema = z.object({
  name: z.string().trim().min(1, "Community name is required.").max(120),
  requestedSlug: z.string().trim().min(1).max(MAX_SLUG_LENGTH),
  description: z.string().trim().max(2_000).nullable(),
  eventName: z.string().trim().max(200).nullable().optional().transform((value) => value || null),
  eventCode: z.string().trim().max(100).nullable().optional().transform((value) => value || null),
  supportedProgramIds: z.array(z.string().trim().min(1)).max(100).transform((ids) => [...new Set(ids)]),
  visibility: z.enum(["private", "public"]),
  membershipApproval: z.enum(["manual", "automatic"]),
  gmAdmission: z.enum(["approved_only", "self_service"]),
  scheduleVisibility: z.enum(["members", "public"]),
});

export type UpdateCommunitySettingsInput = z.input<typeof updateCommunitySettingsInputSchema>;

export type UpdateCommunitySettingsResult =
  | { status: "updated"; community: { id: string; name: string; slug: string } }
  | { status: "not-found" }
  | { status: "forbidden" };

type Database = ReturnType<typeof getDb>;

export class CommunitySettingsUpdateError extends Error {
  constructor(options?: ErrorOptions) {
    super("The community settings could not be updated.", options);
    this.name = "CommunitySettingsUpdateError";
  }
}

async function allocateSlug(
  base: string,
  communityId: string,
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
): Promise<string> {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${base}, 0))`);

  for (let collisionIndex = 0; collisionIndex < 10_000; collisionIndex += 1) {
    const candidate = communitySlugCandidate(base, collisionIndex);
    const [occupied] = await transaction
      .select({ id: communities.id })
      .from(communities)
      .where(and(eq(communities.slug, candidate), ne(communities.id, communityId)))
      .limit(1);
    if (!occupied) return candidate;
  }

  throw new CommunitySettingsUpdateError();
}

/**
 * Updates the current settings snapshot. Existing memberships and future
 * request/session records are deliberately untouched, so policy changes only
 * affect decisions made after this transaction commits.
 */
export async function updateCommunitySettings(
  actor: AuthenticatedActor,
  currentSlug: string,
  input: UpdateCommunitySettingsInput,
  options: { database?: Database; denialSink?: AuthorizationDenialSink } = {},
): Promise<UpdateCommunitySettingsResult> {
  const parsed = updateCommunitySettingsInputSchema.parse(input);
  const slugBase = normalizeCommunitySlug(parsed.requestedSlug);
  if (!slugBase) {
    throw new z.ZodError([
      { code: "custom", path: ["requestedSlug"], message: "Enter a valid web address." },
    ]);
  }

  const database = options.database ?? getDb();
  try {
    return await database.transaction(async (transaction) => {
      const authorization = await authorizeCommunityBySlug({
        actor,
        slug: currentSlug,
        operation: "community.policy.manage",
        resolveAccess: (slug, personId) => resolveCommunityAccessBySlug(slug, personId, transaction),
        denialSink: options.denialSink,
      });
      if (authorization.status !== "authorized") return authorization;

      const communityId = authorization.access.community.id;
      const slug = await allocateSlug(slugBase, communityId, transaction);

      if (parsed.supportedProgramIds.length > 0) {
        const existingPrograms = await transaction
          .select({ id: organizedPlayPrograms.id })
          .from(organizedPlayPrograms)
          .where(inArray(organizedPlayPrograms.id, parsed.supportedProgramIds));
        if (existingPrograms.length !== parsed.supportedProgramIds.length) {
          throw new CommunitySettingsUpdateError();
        }
      }

      const [community] = await transaction
        .update(communities)
        .set({
          name: parsed.name,
          slug,
          description: parsed.description || null,
          eventName: parsed.eventName,
          eventCode: parsed.eventCode,
          visibility: parsed.visibility,
          membershipApproval: parsed.membershipApproval,
          gmAdmission: parsed.gmAdmission,
          // Keep the owner's public-schedule preference while private. The
          // authorization policy computes effective visibility as member-only
          // until the community itself becomes public.
          scheduleVisibility: parsed.scheduleVisibility,
          updatedAt: new Date(),
        })
        .where(eq(communities.id, communityId))
        .returning({ id: communities.id, name: communities.name, slug: communities.slug });
      if (!community) throw new CommunitySettingsUpdateError();

      await transaction
        .delete(communitySupportedPrograms)
        .where(eq(communitySupportedPrograms.communityId, communityId));
      if (parsed.supportedProgramIds.length > 0) {
        await transaction.insert(communitySupportedPrograms).values(
          parsed.supportedProgramIds.map((programId) => ({
            id: randomUUID(),
            communityId,
            programId,
          })),
        );
      }

      await transaction.insert(communityAuditEvents).values({
        id: randomUUID(),
        communityId,
        actorPersonId: actor.personId,
        eventType: "community.settings.updated",
        details: {
          fields: [
            "name",
            "slug",
            "description",
            "eventName",
            "eventCode",
            "supportedPrograms",
            "visibility",
            "membershipApproval",
            "gmAdmission",
            "scheduleVisibility",
          ],
        },
      });

      return { status: "updated", community };
    });
  } catch (error) {
    if (error instanceof CommunitySettingsUpdateError) throw error;
    throw new CommunitySettingsUpdateError({ cause: error });
  }
}
