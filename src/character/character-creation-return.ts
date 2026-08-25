import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
export type SessionReturnTarget = { slug: string; sessionId: string };

export function parseSessionReturnTo(value: unknown): SessionReturnTarget | null {
  if (typeof value !== "string" || value.length > 300) return null;
  const match = /^\/communities\/([a-z0-9]+(?:-[a-z0-9]+)*)\/sessions\/([A-Za-z0-9_-]+)$/.exec(value);
  return match ? { slug: match[1]!, sessionId: match[2]! } : null;
}

function roleFor(access: { isActiveMember: boolean; roles: ("owner" | "gm")[] }): CommunityRole | "member" | "visitor" {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}

export async function resolveCharacterCreationReturnTo(value: unknown, actor: AuthenticatedActor, database: Database = getDb()): Promise<string | null> {
  const target = parseSessionReturnTo(value);
  if (!target) return null;
  const access = await resolveCommunityAccessBySlug(target.slug, actor.personId, database);
  if (access.status !== "available") return null;
  if (!canPerformCommunityOperation(roleFor(access), "schedule.view", {
    visibility: access.community.visibility === "public" ? "public" : "private",
    scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members",
  })) return null;
  const [session] = await database.select({ id: sessions.id }).from(sessions).where(and(
    eq(sessions.id, target.sessionId), eq(sessions.communityId, access.community.id), eq(sessions.status, "published"),
  )).limit(1);
  return session ? `/communities/${encodeURIComponent(target.slug)}/sessions/${encodeURIComponent(target.sessionId)}` : null;
}
