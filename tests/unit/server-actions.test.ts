import { describe, expect, it } from "vitest";
import * as communityActions from "@/app/communities/new/actions";
import * as communitySettingsActions from "@/app/communities/[slug]/settings/actions";
import * as communityAdmissionActions from "@/app/communities/[slug]/admission-actions";
import * as ownerAdmissionActions from "@/app/communities/[slug]/settings/admission-actions";
import * as invitationActions from "@/app/invitations/actions";
import * as communityGmActions from "@/app/communities/[slug]/gm-actions";
import * as ownerGmActions from "@/app/communities/[slug]/settings/gm-actions";
import * as notificationActions from "@/app/notification-actions";

describe("server action modules", () => {
  it("export only functions at runtime", () => {
    for (const actions of [communityActions, communitySettingsActions, communityAdmissionActions, ownerAdmissionActions, invitationActions, communityGmActions, ownerGmActions, notificationActions]) {
      expect(Object.values(actions)).not.toHaveLength(0);
      expect(Object.values(actions).every((value) => typeof value === "function")).toBe(true);
    }
  });
});
