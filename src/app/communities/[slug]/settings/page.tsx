import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { listCommunityInvitations } from "@/community/community-invitations";
import { communities, communityGmRequests, communityMembershipRequests, communityMemberships, communityRoleGrants, contentItems, people, sessions } from "@/db/schema";
import { authorizeOwnerSettings } from "./access";
import { CommunityLifecycleForm } from "./lifecycle-form";
import { CommunitySettingsForm } from "./settings-form";
import { AdmissionManagement } from "./admission-management";
import { GmManagement } from "./gm-management";
import { MembersOverview, SessionsOverview } from "./administration-overview";
import { AdministrationTabs } from "./administration-tabs";

export default async function CommunitySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?callbackURL=${encodeURIComponent(`/communities/${slug}/settings`)}`);
  const authorization = await authorizeOwnerSettings(actor, slug);
  if (authorization.status !== "authorized") notFound();

  const database = getDb();
  const [settings] = await database.select().from(communities).where(eq(communities.id, authorization.access.community.id)).limit(1);
  if (!settings) notFound();
  const [invitationResult, pendingRequests, pendingGmRequests, gmGrants, memberRows, activeRoleRows, futureSessions] = await Promise.all([
    listCommunityInvitations(actor, slug, { database }),
    database.select({ id: communityMembershipRequests.id, displayName: people.displayName, requestedAt: communityMembershipRequests.requestedAt }).from(communityMembershipRequests).innerJoin(people, eq(people.id, communityMembershipRequests.personId)).where(and(eq(communityMembershipRequests.communityId, settings.id), eq(communityMembershipRequests.status, "pending"))).orderBy(asc(communityMembershipRequests.requestedAt)),
    database.select({ id: communityGmRequests.id, displayName: people.displayName, requestedAt: communityGmRequests.requestedAt }).from(communityGmRequests).innerJoin(people, eq(people.id, communityGmRequests.personId)).where(and(eq(communityGmRequests.communityId, settings.id), eq(communityGmRequests.status, "pending"))).orderBy(asc(communityGmRequests.requestedAt)),
    database.select({ id: communityRoleGrants.id, personId: communityRoleGrants.personId, displayName: people.displayName, status: communityRoleGrants.status }).from(communityRoleGrants).innerJoin(people, eq(people.id, communityRoleGrants.personId)).where(and(eq(communityRoleGrants.communityId, settings.id), eq(communityRoleGrants.role, "gm"), inArray(communityRoleGrants.status, ["active", "revoked"]))).orderBy(asc(people.displayName)),
    database.select({ id: communityMemberships.id, personId: communityMemberships.personId, displayName: people.displayName, status: communityMemberships.status }).from(communityMemberships).innerJoin(people, eq(people.id, communityMemberships.personId)).where(eq(communityMemberships.communityId, settings.id)).orderBy(asc(people.displayName)),
    database.select({ personId: communityRoleGrants.personId, role: communityRoleGrants.role }).from(communityRoleGrants).where(and(eq(communityRoleGrants.communityId, settings.id), eq(communityRoleGrants.status, "active"), isNull(communityRoleGrants.revokedAt))),
    database.select({ id: sessions.id, code: contentItems.code, title: contentItems.title, gmName: people.displayName, gmPersonId: sessions.gmPersonId, status: sessions.status, startsAt: sessions.startsAt, displayTimeZone: sessions.displayTimeZone }).from(sessions).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).innerJoin(people, eq(people.id, sessions.gmPersonId)).where(and(eq(sessions.communityId, settings.id), gt(sessions.startsAt, new Date()))).orderBy(asc(sessions.startsAt)),
  ]);
  const archived = settings.lifecycleStatus === "archived";
  const members = memberRows.map((member) => ({ ...member, roles: activeRoleRows.filter(({ personId }) => personId === member.personId).map(({ role }) => role) }));
  const grantsWithImpact = gmGrants.map((grant) => ({ ...grant, futureSessions: grant.status === "active" ? futureSessions.filter(({ gmPersonId }) => gmPersonId === grant.personId).map((session) => ({ id: session.id, label: `${session.code} — ${session.title}` })) : [] }));

  const profile = <section className="responsive-card mt-6 rounded-3xl border border-border bg-surface sm:mt-8"><h2 className="mb-5 text-xl font-semibold sm:mb-6 sm:text-2xl">Profile, policies, and lifecycle state</h2><p className="mb-6 text-sm capitalize text-text-muted">Status: {settings.lifecycleStatus}</p>{archived ? <p className="text-sm text-text-muted">Restore this community from the Lifecycle tab to edit its profile and policies.</p> : <CommunitySettingsForm settings={settings} />}</section>;
  const peopleTab = <><MembersOverview members={members} />{archived ? null : <><AdmissionManagement slug={settings.slug} invitations={invitationResult.status === "found" ? invitationResult.invitations : []} requests={pendingRequests} /><GmManagement slug={settings.slug} requests={pendingGmRequests} grants={grantsWithImpact} /></>}</>;
  const lifecycle = <section className="responsive-card mt-6 rounded-3xl border border-danger/30 bg-danger/10 sm:mt-8"><h2 className="text-xl font-semibold sm:text-2xl">{archived ? "Restore community" : "Archive community"}</h2><p className="mt-3 text-text-muted">{archived ? "Restoring makes this community active again. Its memberships and records are preserved." : "Archiving hides this community and prevents normal use. It does not permanently delete any data."}</p><CommunityLifecycleForm slug={settings.slug} action={archived ? "restore" : "archive"} /></section>;

  return <main className="page-shell mx-auto min-h-screen max-w-4xl">{!archived ? <Link href={`/communities/${settings.slug}`} className="text-sm text-brand hover:underline">← {settings.name}</Link> : null}<h1 className={`responsive-title break-words font-semibold ${archived ? "" : "mt-6 sm:mt-8"}`}>Community administration</h1>{archived ? <p className="mt-4 rounded-xl bg-warning/10 p-4 text-warning">This community is archived. Its administration data is read-only until an owner restores it.</p> : null}<AdministrationTabs tabs={[{ id: "profile", label: "Profile", content: profile }, { id: "people", label: "People", badge: pendingRequests.length + pendingGmRequests.length, content: peopleTab }, { id: "sessions", label: "Sessions", content: <SessionsOverview slug={settings.slug} sessions={futureSessions} readOnly={archived} /> }, { id: "lifecycle", label: "Lifecycle", content: lifecycle }]} /></main>;
}
