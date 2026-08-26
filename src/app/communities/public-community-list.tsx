import Link from "next/link";

export interface PublicCommunitySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export function PublicCommunityList({
  communities,
}: {
  communities: PublicCommunitySummary[];
}) {
  if (communities.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface p-7">
        <h2 className="text-xl font-semibold">
          No public communities yet
        </h2>
        <p className="mt-2 leading-6 text-text-muted">
          Public communities will appear here when they are available.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="public-community-results" className="mt-8">
      <h2 id="public-community-results" className="sr-only">
        Public communities
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {communities.map((community) => (
          <li key={community.id}>
            <Link
              href={`/communities/${encodeURIComponent(community.slug)}`}
              className="block h-full rounded-2xl border border-border bg-surface-raised p-6 transition hover:border-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <h3 className="text-xl font-semibold text-text-primary">{community.name}</h3>
              <p className="mt-1 text-sm text-brand">/{community.slug}</p>
              {community.description ? (
                <p className="mt-4 line-clamp-3 leading-6 text-text-muted">
                  {community.description}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
