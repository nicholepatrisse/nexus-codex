import { describe, expect, it } from "vitest";
import {
  applicantNotificationDestination,
  notificationBadgeCount,
  type AppNotification,
} from "@/notifications/model";

const notification = (id: string, actionable: boolean): AppNotification => ({
  id,
  actionable,
  kind: "applicant.membership.status",
  title: "Lodge",
  message: "Updated",
  href: null,
  occurredAt: new Date(0),
});

describe("notifications", () => {
  it("keeps actionable items counted after they are seen and clears informational updates", () => {
    const items = [notification("pending", true), notification("approved", false)];
    expect(notificationBadgeCount(items, new Set())).toBe(2);
    expect(notificationBadgeCount(items, new Set(["pending", "approved"]))).toBe(1);
  });

  it("does not link a private community until the applicant has authorized member access", () => {
    expect(applicantNotificationDestination("private", false, "secret-lodge")).toBeNull();
    expect(applicantNotificationDestination("private", true, "secret-lodge")).toBe("/communities/secret-lodge");
    expect(applicantNotificationDestination("public", false, "open lodge")).toBe("/communities/open%20lodge");
  });
});
