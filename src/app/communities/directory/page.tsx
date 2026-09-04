import Link from "next/link";
import { PublicCommunityList } from "@/app/communities/public-community-list";
import { directoryHref, parseDirectoryQuery } from "@/app/communities/discovery-query";
import { socialMetadata } from "@/app/social-metadata";
import { getAuthenticatedActor } from "@/auth/actor";
import { listPublicCommunities } from "@/community/public-discovery";
import { listHomepageCommunitiesForPerson } from "@/community/repository";

export const metadata = socialMetadata({ title: "Community Directory | Nexus Codex", description: "Browse visible Starfinder 2E communities on Nexus Codex.", pathname: "/communities/directory" });
export const dynamic = "force-dynamic";
interface DirectoryPageProps { searchParams: Promise<{ page?: string | string[] }>; }

export default async function CommunityDirectoryPage({ searchParams }: DirectoryPageProps) {
  const actor = await getAuthenticatedActor();
  const { page } = parseDirectoryQuery(await searchParams);
  const [result, joinedCommunities] = await Promise.all([listPublicCommunities({ page }).catch(() => null), actor ? listHomepageCommunitiesForPerson(actor.personId) : Promise.resolve([])]);
  if (!result) return <main className="page-shell mx-auto min-h-screen max-w-5xl sm:py-24"><section className="card-standard responsive-card"><h1 className="text-3xl font-semibold">Community directory unavailable</h1><p className="mt-3 text-text-muted">Please try again in a moment.</p></section></main>;
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const joinedCommunityIds = joinedCommunities.filter(({ lifecycleStatus }) => lifecycleStatus === "active").map(({ id }) => id);
  return <main className="page-shell mx-auto min-h-screen max-w-5xl sm:py-16"><section>
    {actor ? <Link href="/communities" className="text-sm font-semibold text-brand hover:underline">← My communities</Link> : null}
    <p className={`${actor ? "mt-8" : ""} text-sm font-semibold tracking-[0.2em] text-brand uppercase`}>Community directory</p><h1 className="responsive-title mt-3 font-semibold sm:text-5xl">Visible communities</h1><p className="mt-4 max-w-2xl leading-7 text-text-muted">Browse communities that have chosen to make their profile public. Communities you already belong to are marked for easy recognition.</p>
    <PublicCommunityList communities={result.items} joinedCommunityIds={joinedCommunityIds} />
    {pageCount > 1 ? <nav aria-label="Community results pages" className="mt-8 flex items-center gap-4">{page > 1 ? <Link href={directoryHref(page - 1)} className="text-brand hover:underline">← Previous</Link> : null}<span className="text-sm text-text-muted">Page {Math.min(page, pageCount)} of {pageCount}</span>{page < pageCount ? <Link href={directoryHref(page + 1)} className="text-brand hover:underline">Next →</Link> : null}</nav> : null}
  </section></main>;
}
