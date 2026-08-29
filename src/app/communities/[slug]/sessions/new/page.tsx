import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { addPaizoScenarioAction, createSessionDraftAction, previewPaizoScenarioAction } from "../actions";
import { loadSessionFormOptions } from "../form-options";
import { SessionDraftForm } from "../session-draft-form";
import { addSessionSocietyNumberAction } from "../actions";
import { SocietyNumberPrompt } from "./society-number-prompt";

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

  const noEligibleGm = isOwner && options.gms.length === 0;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16"><Link href={`/communities/${slug}`} className="text-sm text-brand hover:underline">← {access.community.name}</Link><h1 className="mt-8 text-4xl font-semibold">Create session draft</h1><p className="mt-3 text-text-muted">Drafts remain private until published.</p>{options.scenarioGroups.length === 0 ? <p className="mt-8 rounded-xl bg-warning/10 p-4 text-warning">The scenario catalog is temporarily unavailable. Please try again after an administrator restores the catalog.</p> : noEligibleGm ? <SocietyNumberPrompt action={addSessionSocietyNumberAction.bind(null, slug)} /> : <SessionDraftForm action={createSessionDraftAction.bind(null, slug)} previewScenario={previewPaizoScenarioAction.bind(null, slug)} addScenario={addPaizoScenarioAction.bind(null, slug)} slug={slug} scenarioGroups={options.scenarioGroups} gms={options.gms} canAssignGm={isOwner} actorPersonId={actor.personId} />}</main>;
}
