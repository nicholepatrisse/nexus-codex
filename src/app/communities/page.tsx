import Link from "next/link";
import { PublicCommunityList } from "@/app/communities/public-community-list";
import { discoveryHref, parseDiscoveryQuery } from "@/app/communities/discovery-query";
import { searchPublicCommunities } from "@/community/public-discovery";

export const dynamic = "force-dynamic";

interface CommunitiesPageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}

export default async function CommunitiesPage({ searchParams }: CommunitiesPageProps) {
  const { query, page } = parseDiscoveryQuery(await searchParams);
  const result = await searchPublicCommunities({ query, page }).catch(() => null);

  if (!result) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 sm:py-24">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          ← Nexus Codex
        </Link>
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <h1 className="text-3xl font-semibold">Community directory unavailable</h1>
          <p className="mt-3 text-[var(--muted)]">Please try again in a moment.</p>
        </section>
      </main>
    );
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 sm:py-24">
      <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
        ← Nexus Codex
      </Link>

      <section className="mt-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Community directory
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Find a public community
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
          Browse communities that have chosen to make their profile public.
        </p>

        <form action="/communities" method="get" role="search" className="mt-8 flex max-w-2xl gap-3">
          <label htmlFor="community-search" className="sr-only">
            Search by community name or slug
          </label>
          <input
            id="community-search"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query}
            placeholder="Community name or slug"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[#07110f] transition hover:brightness-110"
          >
            Search
          </button>
        </form>

        {query ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-[var(--muted)]">
            <span>
              {result.total} {result.total === 1 ? "result" : "results"} for “{query}”
            </span>
            <Link href="/communities" className="text-[var(--accent)] hover:underline">
              Clear search
            </Link>
          </div>
        ) : null}

        <PublicCommunityList communities={result.items} hasQuery={Boolean(query)} />

        {pageCount > 1 ? (
          <nav aria-label="Community results pages" className="mt-8 flex items-center gap-4">
            {page > 1 ? (
              <Link href={discoveryHref(query, page - 1)} className="text-[var(--accent)] hover:underline">
                ← Previous
              </Link>
            ) : null}
            <span className="text-sm text-[var(--muted)]">
              Page {Math.min(page, pageCount)} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={discoveryHref(query, page + 1)} className="text-[var(--accent)] hover:underline">
                Next →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
