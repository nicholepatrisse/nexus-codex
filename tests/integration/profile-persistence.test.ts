import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { getDb } from "@/db/client";
import { authUsers, people } from "@/db/schema";
import { getProfile, updateProfile } from "@/profile/profile";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const createdUserIds: string[] = [];

describeWithDatabase("profile persistence", () => {
  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) await getDb().delete(authUsers).where(eq(authUsers.id, id));
  });

  it("persists, updates, and removes only the actor's profile details", async () => {
    const first = await createTestIdentity({ name: "Account One", sessions: 0 });
    const second = await createTestIdentity({ name: "Account Two", sessions: 0 });
    createdUserIds.push(first.authUser.id, second.authUser.id);
    const actor = { personId: first.person.id, authUserId: first.authUser.id, sessionId: "test" };

    await updateProfile(actor, { displayName: "Nova", discordHandle: "nova.play", societyPlayNumber: "12345" });
    expect(await getProfile(actor)).toMatchObject({ displayName: "Nova", discordHandle: "nova.play", societyPlayNumber: "12345" });
    expect((await getDb().select().from(people).where(eq(people.id, second.person.id)))[0]?.displayName).toBe("Account Two");

    await updateProfile(actor, { displayName: "", discordHandle: "", societyPlayNumber: "" });
    expect(await getProfile(actor)).toMatchObject({ displayName: "Account One", discordHandle: null, societyPlayNumber: null });
  });
});
