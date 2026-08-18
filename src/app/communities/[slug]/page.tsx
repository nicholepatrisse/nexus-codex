import { notFound } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import { CommunityProfile } from "./community-profile";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communityMembershipRequests } from "@/db/schema";

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

  return <CommunityProfile community={community} isOwner={isOwner} isSignedIn={Boolean(actor)} isMember={authorization.access.isActiveMember} pendingRequestId={pendingRequest?.id} />;
}
