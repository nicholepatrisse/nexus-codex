import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { listGameCreationCommunitiesForPerson } from "@/community/repository";

export default async function ChooseGameCommunityPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?callbackURL=${encodeURIComponent("/games/new")}`);

  const communities = await listGameCreationCommunitiesForPerson(actor.personId);
  const onlyCommunity = communities.length === 1 ? communities[0] : undefined;
  if (onlyCommunity) {
    redirect(`/communities/${encodeURIComponent(onlyCommunity.slug)}/sessions/new`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 sm:py-16">
      <Link href="/" className="text-sm font-semibold text-brand hover:underline">← Home</Link>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight">Create a game</h1>
      {communities.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-border bg-surface p-6">
          <h2 className="text-xl font-semibold">You need an eligible community first</h2>
          <p className="mt-2 text-text-muted">Join or create a community, or ask a community owner for Game Master access.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/communities" className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">Find communities</Link><Link href="/communities/new" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">Create a community</Link></div>
        </section>
      ) : (
        <section aria-labelledby="community-choice-heading" className="mt-8">
          <h2 id="community-choice-heading" className="text-xl font-semibold">Choose a community</h2>
          <p className="mt-2 text-text-muted">The game will appear in this community after you publish it.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {communities.map((community) => <li key={community.id}><Link href={`/communities/${encodeURIComponent(community.slug)}/sessions/new`} className="block rounded-2xl border border-border bg-surface p-5 text-lg font-semibold transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">{community.name}<span className="mt-2 block text-sm font-normal text-text-muted">Create a game here →</span></Link></li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
