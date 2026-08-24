export type AppNotificationKind =
  | "owner.membership.pending"
  | "applicant.membership.status"
  | "session.changed"
  | "session.cancelled";

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  message: string;
  href: string | null;
  occurredAt: Date;
  actionable: boolean;
}

export function notificationBadgeCount(notifications: AppNotification[], seen: ReadonlySet<string>) {
  return notifications.filter((item) => item.actionable || !seen.has(item.id)).length;
}

export function applicantNotificationDestination(
  visibility: string,
  hasActiveMembership: boolean,
  slug: string,
) {
  return visibility === "public" || hasActiveMembership
    ? `/communities/${encodeURIComponent(slug)}`
    : null;
}
