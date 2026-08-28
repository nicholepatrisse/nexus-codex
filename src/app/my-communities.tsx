import Link from "next/link";
import { SparkAccent } from "@/app/accent-primitives";
import { CommunityCard } from "@/app/community-card";
import { EmptyState } from "@/app/empty-state";
import { StatusBadge } from "@/app/status-badge";
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

const admissionBadges: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger"; message: string }> = {
  pending: {
    label: "Pending",
    tone: "warning",
    message: "An owner is reviewing your membership request.",
  },
  approved: {
    label: "Approved",
    tone: "success",
    message: "Your membership request was approved.",
  },
  rejected: {
    label: "Not approved",
    tone: "danger",
    message: "Your membership request was not approved.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "neutral",
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
        {admissions.slice(0, 2).map((admission) => {
          const badge = admissionBadges[admission.status] ?? {
            label: "Updated",
            tone: "neutral" as const,
            message: "Your membership request has been updated.",
          };
          const content = (
            <>
              <span className="flex items-start justify-between gap-4">
                <span className="font-semibold text-text-primary">{admission.communityName}</span>
                <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
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
            className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition hover:bg-brand-hover"
          >
            Create a community
          </Link>
        </div>
      </div>

      {activeCommunities.length === 0 && archivedCommunities.length === 0 ? (
        <EmptyState className="accent-brand-gradient mt-6" icon={<SparkAccent size={14} />} title="No communities yet" description="Create a community to start organizing Society games." />
      ) : null}

      {activeCommunities.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {activeCommunities.slice(0, 2).map((community) => (
            <li key={community.id}>
              <CommunityCard name={community.name} slug={community.slug} href={`/communities/${community.slug}`} metadata={<span className="capitalize">{community.visibility} community</span>} />
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
            {archivedCommunities.slice(0, 2).map((community) => (
              <li key={community.id}>
                <CommunityCard name={community.name} slug={community.slug} href={`/communities/${community.slug}/settings`} metadata="Archived · Open settings to restore" muted />
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
