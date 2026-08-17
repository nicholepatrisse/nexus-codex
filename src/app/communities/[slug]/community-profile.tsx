import Link from "next/link";
import { AdmissionForm } from "./admission-form";

export type CommunityProfileProps = Readonly<{
  community: {
    name: string;
    slug: string;
    description?: string | null;
    visibility: string;
  };
  isOwner: boolean;
  isSignedIn?: boolean;
  isMember?: boolean;
  pendingRequestId?: string;
}>;

/** Public/member profile deliberately limited to approved, non-operational fields. */
export function CommunityProfile({ community, isOwner, isSignedIn = false, isMember = false, pendingRequestId }: CommunityProfileProps) {
  const isPublic = community.visibility === "public";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 sm:py-24">
      <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
        ← Nexus Codex
      </Link>
      <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8 sm:p-12">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          {isPublic ? "Public community" : "Private community"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {community.name}
        </h1>
        {community.description ? (
          <p className="mt-5 whitespace-pre-wrap text-[var(--muted)]">{community.description}</p>
        ) : null}
        <p className="mt-5 text-sm text-[var(--muted)]">
          {isPublic
            ? "This community is publicly visible."
            : "This community is private and visible only to active members."}
        </p>
        {isOwner ? (
          <Link
            href={`/communities/${encodeURIComponent(community.slug)}/settings`}
            className="mt-8 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Community settings
          </Link>
        ) : null}
        {isPublic && !isMember && !isOwner ? (
          isSignedIn ? (
            <AdmissionForm slug={community.slug} pendingRequestId={pendingRequestId} />
          ) : (
            <Link
              href={`/sign-in?callbackURL=${encodeURIComponent(`/communities/${community.slug}`)}`}
              className="mt-8 inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#07110f]"
            >
              Sign in to request membership
            </Link>
          )
        ) : null}
      </section>
    </main>
  );
}
