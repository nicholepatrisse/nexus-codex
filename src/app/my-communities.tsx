import Link from "next/link";
import { getAuthenticatedActor } from "@/auth/actor";
import {
  listHomepageAdmissionStatusesForPerson,
  listHomepageCommunitiesForPerson,
} from "@/community/repository";

interface CommunitySummary {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  lifecycleStatus: string;
}

interface AdmissionSummary {
  id: string;
  communityName: string;
  communitySlug: string;
  communityVisibility: string;
  status: string;
  updatedAt: Date;
}

const admissionBadges: Record<string, { label: string; className: string; message: string }> = {
  pending: {
    label: "Pending",
    className: "border-amber-200/30 bg-amber-300/10 text-amber-100",
    message: "An owner is reviewing your membership request.",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-200/30 bg-emerald-300/10 text-emerald-100",
    message: "Your membership request was approved.",
  },
  rejected: {
    label: "Not approved",
    className: "border-red-200/30 bg-red-300/10 text-red-100",
    message: "Your membership request was not approved.",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-white/15 bg-white/5 text-[var(--muted)]",
    message: "You cancelled this membership request.",
  },
};

export function AdmissionStatusList({ admissions }: { admissions: AdmissionSummary[] }) {
  if (admissions.length === 0) return null;

  return (
    <section aria-labelledby="admission-status-heading" className="mt-10">
      <h3 id="admission-status-heading" className="text-xl font-semibold">
        Membership requests
      </h3>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {admissions.map((admission) => {
          const badge = admissionBadges[admission.status] ?? {
            label: "Updated",
            className: "border-white/15 bg-white/5 text-[var(--muted)]",
            message: "Your membership request has been updated.",
          };
          const content = (
            <>
              <span className="flex items-start justify-between gap-4">
                <span className="font-semibold text-white">{admission.communityName}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </span>
              <span className="mt-3 block text-sm text-[var(--muted)]">{badge.message}</span>
            </>
          );

          return (
            <li key={admission.id} role={admission.status === "pending" ? "status" : undefined}>
              {admission.communityVisibility === "public" ? (
                <Link
                  href={`/communities/${encodeURIComponent(admission.communitySlug)}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--accent)]"
                >
                  {content}
                </Link>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CommunityList({
  communities,
  admissions = [],
}: {
  communities: CommunitySummary[];
  admissions?: AdmissionSummary[];
}) {
  const activeCommunities = communities.filter(({ lifecycleStatus }) => lifecycleStatus === "active");
  const archivedCommunities = communities.filter(
    ({ lifecycleStatus }) => lifecycleStatus === "archived",
  );

  return (
    <section aria-labelledby="my-communities-heading" className="mt-14 border-t border-white/10 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
            Your space
          </p>
          <h2 id="my-communities-heading" className="mt-2 text-3xl font-semibold tracking-tight">
            Your communities
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/communities"
            className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Find communities
          </Link>
          <Link
            href="/communities/new"
            className="inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#07110f] transition hover:brightness-110"
          >
            Create a community
          </Link>
        </div>
      </div>

      {activeCommunities.length === 0 && archivedCommunities.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
          <p className="font-semibold">No communities yet</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Create a community to start organizing Society games.
          </p>
        </div>
      ) : null}

      {activeCommunities.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {activeCommunities.map((community) => (
            <li key={community.id}>
              <Link
                href={`/communities/${community.slug}`}
                className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-[var(--accent)] hover:bg-white/[0.08]"
              >
                <span className="block text-lg font-semibold text-white">{community.name}</span>
                <span className="mt-2 block text-sm capitalize text-[var(--muted)]">
                  {community.visibility} community
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <AdmissionStatusList admissions={admissions} />

      {archivedCommunities.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-xl font-semibold">Archived communities</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Only owners can see archived communities and restore them.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {archivedCommunities.map((community) => (
              <li key={community.id}>
                <Link
                  href={`/communities/${community.slug}/settings`}
                  className="block rounded-2xl border border-amber-200/20 bg-amber-300/[0.04] p-5 transition hover:border-amber-200/50"
                >
                  <span className="block text-lg font-semibold text-white">{community.name}</span>
                  <span className="mt-2 block text-sm text-amber-100">Open settings to restore</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export async function MyCommunities() {
  const actor = await getAuthenticatedActor();
  if (!actor) return null;

  const [communities, admissions] = await Promise.all([
    listHomepageCommunitiesForPerson(actor.personId),
    listHomepageAdmissionStatusesForPerson(actor.personId),
  ]);
  return <CommunityList communities={communities} admissions={admissions} />;
}
