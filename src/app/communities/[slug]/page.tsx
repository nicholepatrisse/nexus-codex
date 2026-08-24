import { notFound } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import { CommunityProfile } from "./community-profile";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contentItems, communityGmRequests, communityMembershipRequests, communityRoleGrants, sessions } from "@/db/schema";

interface CommunityPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const actor = await getAuthenticatedActor();

  const authorization = await authorizeCommunityBySlug({
    actor,
    slug: (await params).slug,
    operation: "community.view",
  });
  if (authorization.status !== "authorized") notFound();
  const community = authorization.access.community;
  const isOwner = authorization.access.roles.includes("owner");
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

  return <CommunityProfile community={community} isOwner={isOwner} isSignedIn={Boolean(actor)} isMember={authorization.access.isActiveMember} pendingRequestId={pendingRequest?.id} gmAdmission={community.gmAdmission === "self_service" ? "self_service" : "approved_only"} gmState={gmState} pendingGmRequestId={gmRequest?.status === "pending" ? gmRequest.id : undefined} drafts={drafts.map((draft) => ({ ...draft, startsAt: draft.startsAt.toISOString() }))} />;
}
