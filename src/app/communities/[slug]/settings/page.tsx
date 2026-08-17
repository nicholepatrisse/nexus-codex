import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { communities, communitySupportedPrograms, organizedPlayPrograms } from "@/db/schema";
import { authorizeOwnerSettings } from "./access";
import { CommunityLifecycleForm } from "./lifecycle-form";
import { CommunitySettingsForm } from "./settings-form";

export default async function CommunitySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?callbackURL=${encodeURIComponent(`/communities/${slug}/settings`)}`);
  const authorization = await authorizeOwnerSettings(actor, slug);
  if (authorization.status !== "authorized") notFound();

  const database = getDb();
  const [settings] = await database.select().from(communities).where(eq(communities.id, authorization.access.community.id)).limit(1);
  if (!settings) notFound();
  const [programs, selected] = await Promise.all([
    database.select({ id: organizedPlayPrograms.id, name: organizedPlayPrograms.name }).from(organizedPlayPrograms).orderBy(asc(organizedPlayPrograms.name)),
    database.select({ id: communitySupportedPrograms.programId }).from(communitySupportedPrograms).where(eq(communitySupportedPrograms.communityId, settings.id)),
  ]);
  const archived = settings.lifecycleStatus === "archived";

  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-16"><Link href={archived ? "/" : `/communities/${settings.slug}`} className="text-sm text-[var(--accent)] hover:underline">← {archived ? "Nexus Codex" : settings.name}</Link><h1 className="mt-8 text-4xl font-semibold">Community settings</h1>{archived ? <p className="mt-4 rounded-xl bg-amber-300/10 p-4 text-amber-100">This community is archived. Restore it to edit settings.</p> : null}<section className="mt-10 rounded-3xl border border-white/10 bg-black/20 p-8"><h2 className="mb-6 text-2xl font-semibold">Profile and policies</h2>{archived ? null : <CommunitySettingsForm settings={settings} programs={programs} selectedProgramIds={selected.map(({ id }) => id)} />}</section><section className="mt-8 rounded-3xl border border-red-300/20 bg-red-950/10 p-8"><h2 className="text-2xl font-semibold">{archived ? "Restore community" : "Archive community"}</h2><p className="mt-3 text-[var(--muted)]">{archived ? "Restoring makes this community active again. Its memberships and records are preserved." : "Archiving hides this community and prevents normal use. It does not permanently delete any data."}</p><CommunityLifecycleForm slug={settings.slug} action={archived ? "restore" : "archive"} /></section></main>;
}
