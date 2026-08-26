import Link from "next/link";
import { SparkAccent } from "@/app/accent-primitives";
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
    className: "border-warning/30 bg-warning/10 text-warning",
    message: "An owner is reviewing your membership request.",
  },
  approved: {
    label: "Approved",
    className: "border-success/30 bg-success/10 text-success",
    message: "Your membership request was approved.",
  },
  rejected: {
    label: "Not approved",
    className: "border-danger/30 bg-danger/10 text-danger",
    message: "Your membership request was not approved.",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-border-strong bg-surface-raised text-text-muted",
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
            className: "border-border-strong bg-surface-raised text-text-muted",
            message: "Your membership request has been updated.",
          };
          const content = (
            <>
              <span className="flex items-start justify-between gap-4">
                <span className="font-semibold text-text-primary">{admission.communityName}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </span>
              <span className="mt-3 block text-sm text-text-muted">{badge.message}</span>
            </>
          );

          return (
            <li key={admission.id} role={admission.status === "pending" ? "status" : undefined}>
              {admission.communityVisibility === "public" ? (
                <Link
                  href={`/communities/${encodeURIComponent(admission.communitySlug)}`}
                  className="block rounded-2xl border border-border bg-surface p-5 transition hover:border-brand"
                >
                  {content}
                </Link>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-5">
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
    <section aria-labelledby="my-communities-heading" className="mt-14 border-t border-border pt-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
            Your space
          </p>
          <h2 id="my-communities-heading" className="mt-2 text-3xl font-semibold tracking-tight">
            Your communities
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/communities"
            className="inline-flex rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand"
          >
            Find communities
          </Link>
          <Link
            href="/communities/new"
            className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-hover"
          >
            Create a community
          </Link>
        </div>
      </div>

      {activeCommunities.length === 0 && archivedCommunities.length === 0 ? (
        <div className="accent-brand-gradient mt-6 rounded-2xl border border-dashed border-border-strong p-6">
          <p className="flex items-center gap-2 font-semibold"><SparkAccent size={14} />No communities yet</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
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
                className="block rounded-2xl border border-border bg-surface-raised p-5 transition hover:border-brand hover:bg-surface-hover"
              >
                <span className="block text-lg font-semibold text-text-primary">{community.name}</span>
                <span className="mt-2 block text-sm capitalize text-text-muted">
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
          <p className="mt-2 text-sm text-text-muted">
            Only owners can see archived communities and restore them.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {archivedCommunities.map((community) => (
              <li key={community.id}>
                <Link
                  href={`/communities/${community.slug}/settings`}
                  className="block rounded-2xl border border-border bg-surface/70 p-5 text-text-muted transition hover:border-border-strong hover:bg-surface-hover"
                >
                  <span className="block text-lg font-semibold text-text-primary">{community.name}</span>
                  <span className="mt-2 block text-sm text-text-subtle">Archived · Open settings to restore</span>
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
