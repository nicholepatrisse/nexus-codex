import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";

interface CommunityPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in");

  const authorization = await authorizeCommunityBySlug({
    actor,
    slug: (await params).slug,
    operation: "community.view",
  });
  if (authorization.status !== "authorized") notFound();
  const community = authorization.access.community;
  const isOwner = authorization.access.roles.includes("owner");

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 sm:py-24">
      <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
        ← Nexus Codex
      </Link>
      <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8 sm:p-12">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Community created
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {community.name}
        </h1>
        <p className="mt-5 text-[var(--muted)]">
          This community is private and visible only to active members.
        </p>
        {isOwner ? (
          <Link
            href={`/communities/${encodeURIComponent(community.slug)}/settings`}
            className="mt-8 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Community settings
          </Link>
        ) : null}
      </section>
    </main>
  );
}
