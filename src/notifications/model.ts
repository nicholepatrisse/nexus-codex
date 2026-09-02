export type AppNotificationKind =
  | "owner.membership.pending"
  | "applicant.membership.status"
  | "gm.session.signup"
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
  isRead: boolean;
}

export function notificationBadgeCount(notifications: AppNotification[]) {
  return notifications.filter((item) => !item.isRead).length;
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
