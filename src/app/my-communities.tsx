import Link from "next/link";
import { getAuthenticatedActor } from "@/auth/actor";
import { listCommunitiesForActiveMember } from "@/community/repository";

interface CommunitySummary {
  id: string;
  name: string;
  slug: string;
  visibility: string;
}

export function CommunityList({ communities }: { communities: CommunitySummary[] }) {
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

      {communities.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
          <p className="font-semibold">No communities yet</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Create a community to start organizing Society games.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {communities.map((community) => (
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
      )}
    </section>
  );
}

export async function MyCommunities() {
  const actor = await getAuthenticatedActor();
  if (!actor) return null;

  const communities = await listCommunitiesForActiveMember(actor.personId);
  return <CommunityList communities={communities} />;
}
