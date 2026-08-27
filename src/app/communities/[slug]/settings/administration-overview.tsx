import Link from "next/link";
import { GameCard } from "@/app/game-card";

export type AdministrationMember = {
  id: string;
  displayName: string;
  status: string;
  roles: string[];
};

export type AdministrationSession = {
  id: string;
  code: string;
  title: string;
  gmName: string;
  gmPersonId: string;
  status: string;
  startsAt: Date;
  displayTimeZone: string;
};

export function AdministrationOverview({
  slug,
  members,
  sessions,
  readOnly = false,
}: {
  slug: string;
  members: AdministrationMember[];
  sessions: AdministrationSession[];
  readOnly?: boolean;
}) {
  return <>
    <MembersOverview members={members} />
    <SessionsOverview slug={slug} sessions={sessions} readOnly={readOnly} />
  </>;
}

export function MembersOverview({ members }: { members: AdministrationMember[] }) {
  return (
    <section className="mt-8 rounded-3xl border border-border bg-surface p-8">
      <h2 className="text-2xl font-semibold">Members and owner grants</h2>
      {members.length ? <ul className="mt-5 divide-y divide-border">{members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{member.displayName}</p><p className="text-sm capitalize text-text-muted">{member.status}</p></div><div className="flex flex-wrap gap-2">{member.roles.map((role) => <span key={role} className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold capitalize text-text-muted">{role}</span>)}</div></li>)}</ul> : <p className="mt-3 text-sm text-text-muted">No members.</p>}
    </section>
  );
}

export function SessionsOverview({ slug, sessions, readOnly = false }: { slug: string; sessions: AdministrationSession[]; readOnly?: boolean }) {
  const upcoming = sessions.filter(({ status }) => status !== "cancelled");
  const cancelled = sessions.filter(({ status }) => status === "cancelled");
  return (
    <section className="mt-8 rounded-3xl border border-border bg-surface p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">Sessions</h2><p className="mt-2 text-sm text-text-muted">Upcoming and cancelled games are separated for quick review.</p></div>{readOnly ? null : <Link href={`/communities/${encodeURIComponent(slug)}/sessions/new`} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">New Session</Link>}</div>
      <h3 className="mt-8 text-lg font-semibold">Upcoming sessions</h3>
      <SessionList slug={slug} sessions={upcoming} empty="No upcoming sessions." />
      <h3 className="mt-8 text-lg font-semibold">Cancelled sessions</h3>
      <SessionList slug={slug} sessions={cancelled} empty="No cancelled sessions." />
    </section>
  );
}

function SessionList({ slug, sessions, empty }: { slug: string; sessions: AdministrationSession[]; empty: string }) {
  if (!sessions.length) return <p className="mt-3 text-sm text-text-muted">{empty}</p>;
  return <ul className="mt-3 space-y-3">{sessions.map((session) => { const href = `/communities/${encodeURIComponent(slug)}/sessions/${session.id}`; const status = session.status === "draft" || session.status === "completed" || session.status === "cancelled" ? session.status : "published"; return <li key={session.id}><GameCard href={href} scenarioCode={session.code} scenarioTitle={session.title} startsAt={session.startsAt} displayTimeZone={session.displayTimeZone} status={status} gmName={session.gmName} actions={<><Link href={href} className="text-sm font-semibold text-brand hover:underline">View</Link>{session.status === "draft" ? <Link href={`${href}/edit`} className="text-sm font-semibold text-brand hover:underline">Edit</Link> : null}</>} /></li>; })}</ul>;
}
