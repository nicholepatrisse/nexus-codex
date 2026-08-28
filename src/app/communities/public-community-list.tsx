import { CommunityCard } from "@/app/community-card";
import { EmptyState } from "@/app/empty-state";

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
      <EmptyState className="mt-8 p-7" title="No public communities yet" description="Public communities will appear here when they are available." />
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
            <CommunityCard name={community.name} slug={community.slug} description={community.description} href={`/communities/${encodeURIComponent(community.slug)}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
