import Link from "next/link";
import { AdmissionForm } from "./admission-form";
import { GmAdmissionForm } from "./gm-admission-form";
import { GameCard } from "@/app/game-card";

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
  sessions?: { id: string; code: string; title: string; startsAt: string; gmName: string; status?: string; paizoReportedAt?: Date | null; canSignUp?: boolean; signupStatus?: "confirmed" | "waitlisted"; signupCharacterId?: string; signupCharacterName?: string; eligibleCharacters?: { id: string; name: string; societyNumber: string; currentLevel: number }[] }[];
  canViewSchedule?: boolean;
  now?: string;
  published?: boolean;
}>;

type CommunitySession = NonNullable<CommunityProfileProps["sessions"]>[number];

export function separateSessions(sessions: CommunitySession[], now: string) {
  const boundary = new Date(now).getTime();
  const chronological = (left: CommunitySession, right: CommunitySession) =>
    new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
  const upcoming = sessions.filter((session) => session.status !== "completed" && new Date(session.startsAt).getTime() >= boundary)
    .sort(chronological);
  const past = sessions.filter((session) => session.status === "completed" || new Date(session.startsAt).getTime() < boundary)
    .sort((left, right) => chronological(right, left));

  return { upcoming, past };
}

function SessionList({ communitySlug, sessions, isSignedIn }: Readonly<{
  communitySlug: string;
  sessions: CommunitySession[];
  isSignedIn: boolean;
}>) {
  return <ul className="mt-5 space-y-3">{sessions.map((session) => {
    const href = `/communities/${encodeURIComponent(communitySlug)}/sessions/${encodeURIComponent(session.id)}`;
    return <li key={session.id}>
      <GameCard href={isSignedIn ? href : `/sign-in?callbackURL=${encodeURIComponent(href)}`} scenarioCode={session.code} scenarioTitle={session.title} startsAt={new Date(session.startsAt)} status={session.status === "completed" ? "completed" : session.status === "cancelled" ? "cancelled" : "published"} paizoReportedAt={session.paizoReportedAt} gmName={session.gmName} communityName={undefined} relationship={session.signupStatus === "waitlisted" ? "waitlisted" : session.signupStatus === "confirmed" ? "registered" : null} characterName={session.signupCharacterName} />
    </li>;
  })}</ul>;
}

/** Public/member profile deliberately limited to approved, non-operational fields. */
export function CommunityProfile({ community, isOwner, isSignedIn = false, isMember = false, pendingRequestId, gmAdmission = "approved_only", gmState, pendingGmRequestId, drafts = [], sessions = [], canViewSchedule = sessions.length > 0, now = new Date().toISOString(), published = false }: CommunityProfileProps) {
  const isPublic = community.visibility === "public";
  const separatedSessions = separateSessions(sessions, now);

  return (
    <main className="page-shell mx-auto min-h-screen max-w-4xl sm:py-24">
      {published ? <p className="mb-8 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success" role="status">Session published.</p> : null}
      <section className="responsive-card rounded-3xl border border-border bg-surface sm:p-12">
        <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
          {isPublic ? "Public community" : "Private community"}
        </p>
        <h1 className="responsive-title mt-3 break-words font-semibold sm:text-5xl">
          {community.name}
        </h1>
        {community.description ? (
          <p className="mt-5 whitespace-pre-wrap text-text-muted">{community.description}</p>
        ) : null}
        <p className="mt-5 text-sm text-text-muted">
          {isPublic
            ? "This community is publicly visible."
            : "This community is private and visible only to active members."}
        </p>
        {isOwner ? (
          <div className="mt-8 flex flex-wrap gap-3"><Link
            href={`/communities/${encodeURIComponent(community.slug)}/settings`}
            className="inline-flex rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold hover:border-brand hover:text-brand"
          >
            Community settings
          </Link><Link href={`/communities/${encodeURIComponent(community.slug)}/sessions/new`} className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">New Session</Link></div>
        ) : null}
        {!isOwner && isMember && (gmState === "active" || (gmState === "eligible" && gmAdmission === "self_service")) ? <Link href={`/communities/${encodeURIComponent(community.slug)}/sessions/new`} className="mt-8 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">New Session</Link> : null}
        {isPublic && !isMember && !isOwner ? (
          isSignedIn ? (
            <AdmissionForm slug={community.slug} pendingRequestId={pendingRequestId} />
          ) : (
            <Link
              href={`/sign-in?callbackURL=${encodeURIComponent(`/communities/${community.slug}`)}`}
              className="mt-8 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand"
            >
              Sign in to request membership
            </Link>
          )
        ) : null}
        {isMember && !isOwner && gmState ? <section className="mt-8 border-t border-border pt-6"><h2 className="text-lg font-semibold">Game Master access</h2>{gmState === "active" ? <p className="mt-2 text-sm text-success">You’re an approved GM.</p> : gmState === "pending" ? <GmAdmissionForm slug={community.slug} pendingRequestId={pendingGmRequestId} /> : gmState === "revoked" ? <><p className="mt-2 text-sm text-text-muted">Your previous GM access was revoked. It cannot be restored through self-service.</p>{gmAdmission === "approved_only" ? <GmAdmissionForm slug={community.slug} /> : null}</> : gmAdmission === "self_service" ? <p className="mt-2 text-sm text-text-muted">GM access is granted when you create a game that you will GM. There is no separate request.</p> : gmState === "rejected" ? <><p className="mt-2 text-sm text-text-muted">Your previous GM request was not approved. You may submit a new request.</p><GmAdmissionForm slug={community.slug} /></> : <GmAdmissionForm slug={community.slug} />}</section> : null}
      </section>
      {drafts.length ? <section className="responsive-card mt-6 rounded-3xl border border-border bg-surface sm:mt-8"><h2 className="text-xl font-semibold sm:text-2xl">Session drafts</h2><p className="mt-2 text-sm text-text-muted">Drafts are visible only to authorized community staff.</p><ul className="mt-5 space-y-3">{drafts.map((draft) => { const href = `/communities/${encodeURIComponent(community.slug)}/sessions/${draft.id}`; return <li key={draft.id}><GameCard href={href} scenarioCode={draft.code} scenarioTitle={draft.title} startsAt={new Date(draft.startsAt)} status="draft" communityName={community.name} actions={<Link href={href} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold hover:border-brand">View draft</Link>} /></li>; })}</ul></section> : null}
      {canViewSchedule ? <div className="mt-6 grid gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-2"><section className="responsive-card rounded-3xl border border-border bg-surface" aria-labelledby="upcoming-sessions-heading"><h2 id="upcoming-sessions-heading" className="text-xl font-semibold sm:text-2xl">Upcoming Sessions</h2>{separatedSessions.upcoming.length ? <SessionList communitySlug={community.slug} sessions={separatedSessions.upcoming} isSignedIn={isSignedIn} /> : <p className="mt-4 text-sm text-text-muted">No upcoming sessions are scheduled.</p>}</section><section className="responsive-card rounded-3xl border border-border bg-surface" aria-labelledby="past-sessions-heading"><h2 id="past-sessions-heading" className="text-xl font-semibold sm:text-2xl">Past Sessions</h2>{separatedSessions.past.length ? <SessionList communitySlug={community.slug} sessions={separatedSessions.past} isSignedIn={isSignedIn} /> : <p className="mt-4 text-sm text-text-muted">No past sessions yet.</p>}</section></div> : null}
    </main>
  );
}
