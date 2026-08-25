import Link from "next/link";
import { AdmissionForm } from "./admission-form";
import { GmAdmissionForm } from "./gm-admission-form";
import { SessionSignupControl } from "./session-signup-control";

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
  gmAdmission?: "approved_only" | "self_service";
  gmState?: "eligible" | "pending" | "active" | "rejected" | "revoked";
  pendingGmRequestId?: string;
  drafts?: { id: string; code: string; title: string; startsAt: string; gmPersonId: string }[];
  sessions?: { id: string; code: string; title: string; startsAt: string; gmName: string; canSignUp?: boolean; signupStatus?: "confirmed" | "waitlisted" }[];
  canViewSchedule?: boolean;
  now?: string;
  published?: boolean;
}>;

type CommunitySession = NonNullable<CommunityProfileProps["sessions"]>[number];

export function separateSessions(sessions: CommunitySession[], now: string) {
  const boundary = new Date(now).getTime();
  const chronological = (left: CommunitySession, right: CommunitySession) =>
    new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
  const upcoming = sessions.filter((session) => new Date(session.startsAt).getTime() >= boundary)
    .sort(chronological);
  const past = sessions.filter((session) => new Date(session.startsAt).getTime() < boundary)
    .sort((left, right) => chronological(right, left));

  return { upcoming, past };
}

function SessionList({ communitySlug, sessions, isSignedIn }: Readonly<{
  communitySlug: string;
  sessions: CommunitySession[];
  isSignedIn: boolean;
}>) {
  return <ul className="mt-5 space-y-3">{sessions.map((session) => <li key={session.id} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/communities/${encodeURIComponent(communitySlug)}/sessions/${session.id}`} className="font-semibold hover:text-[var(--accent)] hover:underline">{session.code} — {session.title}</Link><p className="mt-1 text-sm text-[var(--muted)]">{new Date(session.startsAt).toLocaleString()}</p><p className="mt-1 text-sm text-[var(--muted)]">GM: {session.gmName}</p></div><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">Published</span></div>{isSignedIn && session.canSignUp !== false ? <SessionSignupControl slug={communitySlug} sessionId={session.id} initialStatus={session.signupStatus} /> : !isSignedIn ? <Link href={`/sign-in?callbackURL=${encodeURIComponent(`/communities/${communitySlug}`)}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline">Sign in to sign up</Link> : null}</li>)}</ul>;
}

/** Public/member profile deliberately limited to approved, non-operational fields. */
export function CommunityProfile({ community, isOwner, isSignedIn = false, isMember = false, pendingRequestId, gmAdmission = "approved_only", gmState, pendingGmRequestId, drafts = [], sessions = [], canViewSchedule = sessions.length > 0, now = new Date().toISOString(), published = false }: CommunityProfileProps) {
  const isPublic = community.visibility === "public";
  const separatedSessions = separateSessions(sessions, now);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 sm:py-24">
      {published ? <p className="mb-8 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100" role="status">Session published.</p> : null}
      <section className="rounded-3xl border border-white/10 bg-black/20 p-8 sm:p-12">
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
          <div className="mt-8 flex flex-wrap gap-3"><Link
            href={`/communities/${encodeURIComponent(community.slug)}/settings`}
            className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Community settings
          </Link><Link href={`/communities/${encodeURIComponent(community.slug)}/sessions/new`} className="inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#07110f]">New Session</Link></div>
        ) : null}
        {!isOwner && isMember && (gmState === "active" || (gmState === "eligible" && gmAdmission === "self_service")) ? <Link href={`/communities/${encodeURIComponent(community.slug)}/sessions/new`} className="mt-8 inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#07110f]">New Session</Link> : null}
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
        {isMember && !isOwner && gmState ? <section className="mt-8 border-t border-white/10 pt-6"><h2 className="text-lg font-semibold">Game Master access</h2>{gmState === "active" ? <p className="mt-2 text-sm text-emerald-200">You’re an approved GM.</p> : gmState === "pending" ? <GmAdmissionForm slug={community.slug} pendingRequestId={pendingGmRequestId} /> : gmState === "revoked" ? <><p className="mt-2 text-sm text-[var(--muted)]">Your previous GM access was revoked. It cannot be restored through self-service.</p>{gmAdmission === "approved_only" ? <GmAdmissionForm slug={community.slug} /> : null}</> : gmAdmission === "self_service" ? <p className="mt-2 text-sm text-[var(--muted)]">GM access is granted when you create a game that you will GM. There is no separate request.</p> : gmState === "rejected" ? <><p className="mt-2 text-sm text-[var(--muted)]">Your previous GM request was not approved. You may submit a new request.</p><GmAdmissionForm slug={community.slug} /></> : <GmAdmissionForm slug={community.slug} />}</section> : null}
      </section>
      {canViewSchedule ? <div className="mt-8 grid gap-8 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8" aria-labelledby="upcoming-sessions-heading"><h2 id="upcoming-sessions-heading" className="text-2xl font-semibold">Upcoming Sessions</h2>{separatedSessions.upcoming.length ? <SessionList communitySlug={community.slug} sessions={separatedSessions.upcoming} isSignedIn={isSignedIn} /> : <p className="mt-4 text-sm text-[var(--muted)]">No upcoming sessions are scheduled.</p>}</section><section className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8" aria-labelledby="past-sessions-heading"><h2 id="past-sessions-heading" className="text-2xl font-semibold">Past Sessions</h2>{separatedSessions.past.length ? <SessionList communitySlug={community.slug} sessions={separatedSessions.past} isSignedIn={isSignedIn} /> : <p className="mt-4 text-sm text-[var(--muted)]">No past sessions yet.</p>}</section></div> : null}
      {drafts.length ? <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8"><h2 className="text-2xl font-semibold">Session drafts</h2><p className="mt-2 text-sm text-[var(--muted)]">Drafts are visible only to authorized community staff.</p><ul className="mt-5 space-y-3">{drafts.map((draft) => <li key={draft.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 p-4"><div><p className="font-semibold">{draft.code} — {draft.title}</p><p className="mt-1 text-sm text-[var(--muted)]">{new Date(draft.startsAt).toLocaleString()}</p></div><Link href={`/communities/${encodeURIComponent(community.slug)}/sessions/${draft.id}`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:border-[var(--accent)]">View draft</Link></li>)}</ul></section> : null}
    </main>
  );
}
