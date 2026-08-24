import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { updateSessionDraftAction } from "../../actions";
import { loadSessionFormOptions } from "../../form-options";
import { SessionDraftForm } from "../../session-draft-form";

export default async function EditSessionDraftPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?callbackURL=${encodeURIComponent(`/communities/${slug}/sessions/${sessionId}/edit`)}`);
  const access = await resolveCommunityAccessBySlug(slug, actor.personId);
  if (access.status !== "available") notFound();
  const [draft] = await getDb().select({
    status: sessions.status,
    contentItemId: sessions.contentItemId,
    gmPersonId: sessions.gmPersonId,
    startsAt: sessions.startsAt,
    endsAt: sessions.endsAt,
    notes: sessions.notes,
    locationType: sessions.locationType,
  }).from(sessions).where(and(
    eq(sessions.id, sessionId),
    eq(sessions.communityId, access.community.id),
  )).limit(1);
  const isOwner = access.roles.includes("owner");
  if (!draft || (!isOwner && !(access.roles.includes("gm") && draft.gmPersonId === actor.personId))) notFound();
  const options = await loadSessionFormOptions(access.community.id);
  const locationType = draft.locationType === "physical" ? "physical" as const : "virtual" as const;

  if (draft.status === "cancelled") notFound();
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16"><Link href={`/communities/${slug}`} className="text-sm text-[var(--accent)] hover:underline">← {access.community.name}</Link><h1 className="mt-8 text-4xl font-semibold">Edit {draft.status === "draft" ? "session draft" : "published session"}</h1><SessionDraftForm action={updateSessionDraftAction.bind(null, slug, sessionId)} slug={slug} scenarios={options.scenarios} gms={options.gms} canAssignGm={isOwner} actorPersonId={actor.personId} initial={{ ...draft, startsAt: draft.startsAt.toISOString(), endsAt: draft.endsAt.toISOString(), locationType }} /></main>;
}
