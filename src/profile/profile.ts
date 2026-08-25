import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { authUsers, people } from "@/db/schema";

const optionalProfileField = (maximum: number) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .transform((value) => value || null);

export const updateProfileInputSchema = z.object({
  displayName: optionalProfileField(100),
  discordHandle: optionalProfileField(100),
  societyPlayNumber: optionalProfileField(50),
});

export type UpdateProfileInput = z.output<typeof updateProfileInputSchema>;

export const societyPlayNumberSchema = z.string().trim().regex(/^\d+$/, "Enter your numeric society number.").max(50);

export async function updateSocietyPlayNumber(actor: AuthenticatedActor, value: string) {
  const societyPlayNumber = societyPlayNumberSchema.parse(value);
  const [updated] = await getDb().update(people).set({ societyPlayNumber, updatedAt: new Date() })
    .where(eq(people.id, actor.personId)).returning({ societyPlayNumber: people.societyPlayNumber });
  if (!updated) throw new Error("Profile not found.");
  return updated.societyPlayNumber!;
}

export async function getProfile(actor: AuthenticatedActor) {
  const [profile] = await getDb()
    .select({
      displayName: people.displayName,
      discordHandle: people.discordHandle,
      societyPlayNumber: people.societyPlayNumber,
      accountName: authUsers.name,
      email: authUsers.email,
    })
    .from(people)
    .innerJoin(authUsers, eq(authUsers.id, people.authUserId))
    .where(eq(people.id, actor.personId))
    .limit(1);
  return profile ?? null;
}

export async function updateProfile(actor: AuthenticatedActor, input: UpdateProfileInput) {
  const parsed = updateProfileInputSchema.parse(input);
  return getDb().transaction(async (transaction) => {
    const [identity] = await transaction
      .select({ accountName: authUsers.name })
      .from(people)
      .innerJoin(authUsers, eq(authUsers.id, people.authUserId))
      .where(eq(people.id, actor.personId))
      .limit(1);
    if (!identity) throw new Error("Profile not found.");

    const [updated] = await transaction
      .update(people)
      .set({
        displayName: parsed.displayName ?? identity.accountName,
        discordHandle: parsed.discordHandle,
        societyPlayNumber: parsed.societyPlayNumber,
        updatedAt: new Date(),
      })
      .where(eq(people.id, actor.personId))
      .returning({
        displayName: people.displayName,
        discordHandle: people.discordHandle,
        societyPlayNumber: people.societyPlayNumber,
      });
    if (!updated) throw new Error("Profile not found.");
    return updated;
  });
}
