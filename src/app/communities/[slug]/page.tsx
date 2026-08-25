import { notFound } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { CommunityProfile } from "./community-profile";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { characters, contentItems, communityGmRequests, communityMembershipRequests, communityRoleGrants, organizedPlayPrograms, people, rulesets, sessionSignups, sessions } from "@/db/schema";

interface CommunityPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ published?: string }>;
}

export default async function CommunityPage({ params, searchParams }: CommunityPageProps) {
  const actor = await getAuthenticatedActor();

  const authorization = await authorizeCommunityBySlug({
    actor,
    slug: (await params).slug,
    operation: "community.view",
  });
  if (authorization.status !== "authorized") notFound();
  const community = authorization.access.community;
  const isOwner = authorization.access.roles.includes("owner");
  const role: CommunityRole = isOwner
    ? "owner"
    : authorization.access.roles.includes("gm")
      ? "gm"
      : authorization.access.isActiveMember
        ? "member"
        : "visitor";
  const canViewSchedule = canPerformCommunityOperation(role, "schedule.view", {
    visibility: community.visibility === "public" ? "public" : "private",
    scheduleVisibility: community.scheduleVisibility === "public" ? "public" : "members",
  });
  const [pendingRequest] = actor && !authorization.access.isActiveMember
    ? await getDb()
        .select({ id: communityMembershipRequests.id })
        .from(communityMembershipRequests)
        .where(and(
          eq(communityMembershipRequests.communityId, community.id),
          eq(communityMembershipRequests.personId, actor.personId),
          eq(communityMembershipRequests.status, "pending"),
        ))
        .orderBy(desc(communityMembershipRequests.requestedAt))
        .limit(1)
    : [];
  const [gmGrant] = actor && authorization.access.isActiveMember
    ? await getDb().select({ status: communityRoleGrants.status }).from(communityRoleGrants).where(and(eq(communityRoleGrants.communityId, community.id), eq(communityRoleGrants.personId, actor.personId), eq(communityRoleGrants.role, "gm"))).orderBy(desc(communityRoleGrants.grantedAt)).limit(1)
    : [];
  const [gmRequest] = actor && authorization.access.isActiveMember && !isOwner && gmGrant?.status !== "active"
    ? await getDb().select({ id: communityGmRequests.id, status: communityGmRequests.status }).from(communityGmRequests).where(and(eq(communityGmRequests.communityId, community.id), eq(communityGmRequests.personId, actor.personId))).orderBy(desc(communityGmRequests.requestedAt)).limit(1)
    : [];
  const gmState = gmGrant?.status === "active" ? "active" as const : gmRequest?.status === "pending" ? "pending" as const : gmRequest?.status === "rejected" ? "rejected" as const : gmGrant?.status === "revoked" ? "revoked" as const : actor && authorization.access.isActiveMember && !isOwner ? "eligible" as const : undefined;
  const drafts = actor && authorization.access.isActiveMember && (isOwner || gmGrant?.status === "active")
    ? await getDb().select({ id: sessions.id, code: contentItems.code, title: contentItems.title, startsAt: sessions.startsAt, gmPersonId: sessions.gmPersonId }).from(sessions).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).where(and(eq(sessions.communityId, community.id), eq(sessions.status, "draft"), isOwner ? undefined : eq(sessions.gmPersonId, actor.personId))).orderBy(asc(sessions.startsAt))
    : [];
  const publishedSessions = canViewSchedule
    ? await getDb().select({ id: sessions.id, code: contentItems.code, title: contentItems.title, startsAt: sessions.startsAt, gmName: people.displayName, gmPersonId: sessions.gmPersonId, gameSystemId: rulesets.gameSystemId }).from(sessions).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).innerJoin(organizedPlayPrograms, eq(organizedPlayPrograms.id, contentItems.programId)).innerJoin(rulesets, eq(rulesets.id, organizedPlayPrograms.rulesetId)).innerJoin(people, eq(people.id, sessions.gmPersonId)).where(and(eq(sessions.communityId, community.id), eq(sessions.status, "published"))).orderBy(asc(sessions.startsAt))
    : [];
  const ownSignups = actor && publishedSessions.length
    ? await getDb().select({ sessionId: sessionSignups.sessionId, status: sessionSignups.status, characterId: sessionSignups.characterId, characterName: characters.name }).from(sessionSignups).leftJoin(characters, eq(characters.id, sessionSignups.characterId)).where(and(
        eq(sessionSignups.personId, actor.personId),
        inArray(sessionSignups.sessionId, publishedSessions.map(({ id }) => id)),
        inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
      ))
    : [];
  const signupBySession = new Map(ownSignups.map((signup) => [signup.sessionId, signup]));
  const ownCharacters = actor
    ? await getDb().select({ id: characters.id, name: characters.name, societyNumber: characters.societyNumber, gameSystemId: characters.gameSystemId }).from(characters).where(eq(characters.personId, actor.personId)).orderBy(asc(characters.name))
    : [];

  return <CommunityProfile community={community} isOwner={isOwner} isSignedIn={Boolean(actor)} isMember={authorization.access.isActiveMember} pendingRequestId={pendingRequest?.id} gmAdmission={community.gmAdmission === "self_service" ? "self_service" : "approved_only"} gmState={gmState} pendingGmRequestId={gmRequest?.status === "pending" ? gmRequest.id : undefined} drafts={drafts.map((draft) => ({ ...draft, startsAt: draft.startsAt.toISOString() }))} sessions={publishedSessions.map((session) => { const signup = signupBySession.get(session.id); return { ...session, startsAt: session.startsAt.toISOString(), canSignUp: actor?.personId !== session.gmPersonId, signupStatus: signup?.status === "confirmed" ? "confirmed" as const : signup?.status === "waitlisted" ? "waitlisted" as const : undefined, signupCharacterId: signup?.characterId ?? undefined, signupCharacterName: signup?.characterName ?? undefined, eligibleCharacters: ownCharacters.filter(({ gameSystemId }) => gameSystemId === session.gameSystemId).map(({ id, name, societyNumber }) => ({ id, name, societyNumber })) }; })} canViewSchedule={canViewSchedule} published={(await searchParams)?.published === "1"} />;
}
