import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityLifecycleForm } from "@/app/communities/[slug]/settings/lifecycle-form";
import { CommunitySettingsForm } from "@/app/communities/[slug]/settings/settings-form";

const settings = {
  name: "Absalom Lodge",
  slug: "absalom-lodge",
  description: "Organized play in Absalom Station.",
  visibility: "private",
  membershipApproval: "manual",
  gmAdmission: "approved_only",
  scheduleVisibility: "members",
  eventName: "Absalom Station Organized Play",
  eventCode: "EV-12345",
};

describe("community settings UI", () => {
  it("renders current settings without a redundant program selector", () => {
    const markup = renderToStaticMarkup(
      <CommunitySettingsForm settings={settings} />,
    );

    expect(markup).toContain('value="Absalom Lodge"');
    expect(markup).toContain('name="eventName"');
    expect(markup).toContain('value="Absalom Station Organized Play"');
    expect(markup).toContain('name="eventCode"');
    expect(markup).toContain('value="EV-12345"');
    expect(markup).not.toContain("Default time zone");
    expect(markup).not.toContain("Supported programs");
    expect(markup).not.toContain('name="supportedProgramIds"');
    expect(markup).toContain("Save settings");
  });

  it.each(["archive", "restore"] as const)(
    "requires typed confirmation for the %s action",
    (action) => {
      const markup = renderToStaticMarkup(
        <CommunityLifecycleForm slug="absalom-lodge" action={action} />,
      );

      expect(markup).toContain("absalom-lodge");
      expect(markup).toContain('name="confirmation"');
      expect(markup).toContain(action === "archive" ? "Archive community" : "Restore community");
    },
  );
});
