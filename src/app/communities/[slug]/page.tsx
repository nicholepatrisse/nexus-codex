import { notFound } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import { CommunityProfile } from "./community-profile";

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

  return <CommunityProfile community={community} isOwner={isOwner} />;
}
