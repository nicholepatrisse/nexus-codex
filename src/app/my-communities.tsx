import Link from "next/link";
import { getAuthenticatedActor } from "@/auth/actor";
import { listHomepageCommunitiesForPerson } from "@/community/repository";

interface CommunitySummary {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  lifecycleStatus: string;
}

export function CommunityList({ communities }: { communities: CommunitySummary[] }) {
  const activeCommunities = communities.filter(({ lifecycleStatus }) => lifecycleStatus === "active");
  const archivedCommunities = communities.filter(
    ({ lifecycleStatus }) => lifecycleStatus === "archived",
  );

  return (
    <section aria-labelledby="my-communities-heading" className="mt-14 border-t border-white/10 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
            Your space
          </p>
          <h2 id="my-communities-heading" className="mt-2 text-3xl font-semibold tracking-tight">
            Your communities
          </h2>
        </div>
        <Link
          href="/communities/new"
          className="inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#07110f] transition hover:brightness-110"
        >
          Create a community
        </Link>
      </div>

      {activeCommunities.length === 0 && archivedCommunities.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
          <p className="font-semibold">No communities yet</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Create a community to start organizing Society games.
          </p>
        </div>
      ) : null}

      {activeCommunities.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {activeCommunities.map((community) => (
            <li key={community.id}>
              <Link
                href={`/communities/${community.slug}`}
                className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-[var(--accent)] hover:bg-white/[0.08]"
              >
                <span className="block text-lg font-semibold text-white">{community.name}</span>
                <span className="mt-2 block text-sm capitalize text-[var(--muted)]">
                  {community.visibility} community
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {archivedCommunities.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-xl font-semibold">Archived communities</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Only owners can see archived communities and restore them.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {archivedCommunities.map((community) => (
              <li key={community.id}>
                <Link
                  href={`/communities/${community.slug}/settings`}
                  className="block rounded-2xl border border-amber-200/20 bg-amber-300/[0.04] p-5 transition hover:border-amber-200/50"
                >
                  <span className="block text-lg font-semibold text-white">{community.name}</span>
                  <span className="mt-2 block text-sm text-amber-100">Open settings to restore</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export async function MyCommunities() {
  const actor = await getAuthenticatedActor();
  if (!actor) return null;

  const communities = await listHomepageCommunitiesForPerson(actor.personId);
  return <CommunityList communities={communities} />;
}
