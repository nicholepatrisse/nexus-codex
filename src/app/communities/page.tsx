import Link from "next/link";
import { redirect } from "next/navigation";
import { CommunityList } from "@/app/my-communities";
import { socialMetadata } from "@/app/social-metadata";
import { getAuthenticatedActor } from "@/auth/actor";
import { listHomepageAdmissionStatusesForPerson, listHomepageCommunitiesForPerson } from "@/community/repository";

export const metadata = socialMetadata({ title: "My Communities | Nexus Codex", description: "Manage your Starfinder 2E communities on Nexus Codex.", pathname: "/communities" });
export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/communities/directory");
  const [communities, admissions] = await Promise.all([
    listHomepageCommunitiesForPerson(actor.personId),
    listHomepageAdmissionStatusesForPerson(actor.personId),
  ]);
  return <main className="page-shell mx-auto min-h-screen max-w-5xl sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Your space</p><h1 className="responsive-title mt-3 font-semibold sm:text-5xl">My communities</h1><p className="mt-4 max-w-2xl leading-7 text-text-muted">Open the communities you belong to, review membership requests, or discover another table.</p></div><div className="flex flex-wrap gap-3"><Link href="/communities/directory" className="inline-flex min-h-11 items-center rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand">Browse community directory <span aria-hidden="true" className="ml-2">→</span></Link><Link href="/communities/new" className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition hover:bg-brand-hover">Create a community</Link></div></div>
    <CommunityList communities={communities} admissions={admissions} showAll hideHeading />
  </main>;
}
