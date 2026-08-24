import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { getDb } from "@/db/client";
import { authUsers, notificationReads } from "@/db/schema";
import { clearNotifications, markNotificationsRead } from "@/notifications/repository";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const createdUserIds: string[] = [];

describeWithDatabase("notification state persistence", () => {
  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await getDb().delete(authUsers).where(eq(authUsers.id, id));
    }
  });

  it("persists reads per person while leaving new notifications unread", async () => {
    const first = await createTestIdentity({ sessions: 2 });
    const second = await createTestIdentity({ sessions: 1 });
    createdUserIds.push(first.authUser.id, second.authUser.id);

    await markNotificationsRead(first.person.id, ["existing-notification"]);
    await markNotificationsRead(first.person.id, ["existing-notification"]);

    const firstReads = await getDb().select().from(notificationReads)
      .where(eq(notificationReads.personId, first.person.id));
    expect(firstReads.map(({ notificationId }) => notificationId)).toEqual(["existing-notification"]);

    expect(await getDb().select().from(notificationReads).where(and(
      eq(notificationReads.personId, second.person.id),
      eq(notificationReads.notificationId, "existing-notification"),
    ))).toHaveLength(0);
    expect(await getDb().select().from(notificationReads).where(and(
      eq(notificationReads.personId, first.person.id),
      eq(notificationReads.notificationId, "new-notification"),
    ))).toHaveLength(0);
  });

  it("persists cleared notifications without clearing another person's state", async () => {
    const first = await createTestIdentity({ sessions: 1 });
    const second = await createTestIdentity({ sessions: 1 });
    createdUserIds.push(first.authUser.id, second.authUser.id);

    await markNotificationsRead(first.person.id, ["cleared-notification"]);
    await clearNotifications(first.person.id, ["cleared-notification"]);

    const [firstState] = await getDb().select().from(notificationReads).where(and(
      eq(notificationReads.personId, first.person.id),
      eq(notificationReads.notificationId, "cleared-notification"),
    ));
    expect(firstState?.clearedAt).toBeInstanceOf(Date);
    expect(await getDb().select().from(notificationReads).where(and(
      eq(notificationReads.personId, second.person.id),
      eq(notificationReads.notificationId, "cleared-notification"),
    ))).toHaveLength(0);
  });
});
