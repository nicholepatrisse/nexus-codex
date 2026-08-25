import Link from "next/link";

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

function formatInstant(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

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
    <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8">
      <h2 className="text-2xl font-semibold">Members and owner grants</h2>
      {members.length ? <ul className="mt-5 divide-y divide-white/10">{members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{member.displayName}</p><p className="text-sm capitalize text-[var(--muted)]">{member.status}</p></div><div className="flex flex-wrap gap-2">{member.roles.map((role) => <span key={role} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold capitalize">{role}</span>)}</div></li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">No members.</p>}
    </section>
  );
}

export function SessionsOverview({ slug, sessions, readOnly = false }: { slug: string; sessions: AdministrationSession[]; readOnly?: boolean }) {
  const upcoming = sessions.filter(({ status }) => status !== "cancelled");
  const cancelled = sessions.filter(({ status }) => status === "cancelled");
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">Sessions</h2><p className="mt-2 text-sm text-[var(--muted)]">Upcoming and cancelled games are separated for quick review.</p></div>{readOnly ? null : <Link href={`/communities/${encodeURIComponent(slug)}/sessions/new`} className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#07110f]">New Session</Link>}</div>
      <h3 className="mt-8 text-lg font-semibold">Upcoming sessions</h3>
      <SessionList slug={slug} sessions={upcoming} empty="No upcoming sessions." />
      <h3 className="mt-8 text-lg font-semibold">Cancelled sessions</h3>
      <SessionList slug={slug} sessions={cancelled} empty="No cancelled sessions." />
    </section>
  );
}

function SessionList({ slug, sessions, empty }: { slug: string; sessions: AdministrationSession[]; empty: string }) {
  if (!sessions.length) return <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>;
  return <ul className="mt-3 space-y-3">{sessions.map((session) => <li key={session.id} className={`rounded-xl border p-4 ${session.status === "cancelled" ? "border-red-300/20 bg-red-950/10" : "border-white/10"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold">{session.code} — {session.title}</p><p className="mt-1 text-sm text-[var(--muted)]">{formatInstant(session.startsAt, session.displayTimeZone)} · GM: {session.gmName}</p><span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${session.status === "cancelled" ? "bg-red-300/10 text-red-100" : "bg-emerald-300/10 text-emerald-100"}`}>{session.status}</span></div><div className="flex gap-3"><Link href={`/communities/${encodeURIComponent(slug)}/sessions/${session.id}`} className="text-sm font-semibold text-[var(--accent)] hover:underline">View</Link>{session.status === "draft" ? <Link href={`/communities/${encodeURIComponent(slug)}/sessions/${session.id}/edit`} className="text-sm font-semibold text-[var(--accent)] hover:underline">Edit</Link> : null}</div></div></li>)}</ul>;
}
