import Link from "next/link";
import { PublicCommunityList } from "@/app/communities/public-community-list";
import { directoryHref, parseDirectoryQuery } from "@/app/communities/discovery-query";
import { listPublicCommunities } from "@/community/public-discovery";

export const dynamic = "force-dynamic";

interface CommunitiesPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function CommunitiesPage({ searchParams }: CommunitiesPageProps) {
  const { page } = parseDirectoryQuery(await searchParams);
  const result = await listPublicCommunities({ page }).catch(() => null);

  if (!result) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 sm:py-24">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <h1 className="text-3xl font-semibold">Community directory unavailable</h1>
          <p className="mt-3 text-[var(--muted)]">Please try again in a moment.</p>
        </section>
      </main>
    );
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 sm:py-24">
      <section>
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Community directory
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Public communities
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
          Browse communities that have chosen to make their profile public.
        </p>

        <PublicCommunityList communities={result.items} />

        {pageCount > 1 ? (
          <nav aria-label="Community results pages" className="mt-8 flex items-center gap-4">
            {page > 1 ? (
              <Link href={directoryHref(page - 1)} className="text-[var(--accent)] hover:underline">
                ← Previous
              </Link>
            ) : null}
            <span className="text-sm text-[var(--muted)]">
              Page {Math.min(page, pageCount)} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={directoryHref(page + 1)} className="text-[var(--accent)] hover:underline">
                Next →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
