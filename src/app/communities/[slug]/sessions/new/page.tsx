import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { createSessionDraftAction } from "../actions";
import { loadSessionFormOptions } from "../form-options";
import { SessionDraftForm } from "../session-draft-form";

export default async function NewSessionDraftPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?callbackURL=${encodeURIComponent(`/communities/${slug}/sessions/new`)}`);
  const access = await resolveCommunityAccessBySlug(slug, actor.personId);
  if (access.status !== "available" || !access.isActiveMember) notFound();
  const isOwner = access.roles.includes("owner");
  const canCreate = isOwner || access.roles.includes("gm") || access.community.gmAdmission === "self_service";
  if (!canCreate) notFound();
  const options = await loadSessionFormOptions(access.community.id);

  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16"><Link href={`/communities/${slug}`} className="text-sm text-[var(--accent)] hover:underline">← {access.community.name}</Link><h1 className="mt-8 text-4xl font-semibold">Create session draft</h1><p className="mt-3 text-[var(--muted)]">Drafts remain private until the publication workflow is added.</p>{options.scenarios.length === 0 ? <p className="mt-8 rounded-xl bg-amber-300/10 p-4 text-amber-100">This community has no supported scenarios. An owner must select a supported program in community settings first.</p> : <SessionDraftForm action={createSessionDraftAction.bind(null, slug)} slug={slug} scenarios={options.scenarios} gms={options.gms} canAssignGm={isOwner} actorPersonId={actor.personId} />}</main>;
}
