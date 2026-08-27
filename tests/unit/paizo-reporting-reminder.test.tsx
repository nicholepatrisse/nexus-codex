import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaizoReportingReminder } from "@/app/communities/[slug]/sessions/[sessionId]/paizo-reporting-reminder";
import { PAIZO_ORGANIZED_PLAY_URL } from "@/app/external-links";

describe("Paizo reporting reminder", () => {
  it("reminds a GM that Nexus completion does not submit Paizo reporting", () => {
    const markup = renderToStaticMarkup(<PaizoReportingReminder justCompleted />);
    expect(markup).toContain("One more reporting step");
    expect(markup).toContain("Your Nexus Chronicles are ready");
    expect(markup).toContain("GM/Event Coordinator");
    expect(markup).toContain(`href="${PAIZO_ORGANIZED_PLAY_URL}"`);
    expect(markup).toContain('target="_blank"');
  });
});
