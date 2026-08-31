import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GmCreditForm } from "@/app/communities/[slug]/sessions/[sessionId]/gm-credit-form";

describe("GmCreditForm", () => {
  it("uses the themed character selector and preserves form submission", () => {
    const markup = renderToStaticMarkup(<GmCreditForm slug="nexus" sessionId="session-1" current={{ characterId: "character-1", characterName: "Navasi" }} characters={[{ id: "character-1", name: "Navasi", societyNumber: "123-2001", currentLevel: 3, className: "Envoy" }]} />);

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-required="true"');
    expect(markup).toContain('type="hidden" name="characterId" value="character-1"');
    expect(markup).toContain("Navasi");
    expect(markup).toContain("Society # 123-2001");
    expect(markup).toContain("Level 3");
    expect(markup).toContain("Class Envoy");
    expect(markup).not.toContain("<select");
  });
});
