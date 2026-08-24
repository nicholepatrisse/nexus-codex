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
};

describe("community settings UI", () => {
  it("renders current settings and supported programs", () => {
    const markup = renderToStaticMarkup(
      <CommunitySettingsForm
        settings={settings}
        programs={[
          { id: "sfs2", name: "Starfinder Society Second Edition" },
          { id: "other", name: "Other Program" },
        ]}
        selectedProgramIds={["sfs2"]}
      />,
    );

    expect(markup).toContain('value="Absalom Lodge"');
    expect(markup).not.toContain("Default time zone");
    expect(markup).toMatch(/name="supportedProgramIds"[^>]*checked=""[^>]*value="sfs2"/);
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
