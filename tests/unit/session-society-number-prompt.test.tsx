import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SocietyNumberPrompt } from "@/app/communities/[slug]/sessions/new/society-number-prompt";

describe("session society-number prompt", () => {
  it("asks the authorized owner to add their number without leaving session creation", () => {
    const markup = renderToStaticMarkup(<SocietyNumberPrompt action={async () => ({})} />);
    expect(markup).toContain("Add your society number");
    expect(markup).toContain('name="societyPlayNumber"');
    expect(markup).toContain("Save and continue");
    expect(markup).toContain('href="/profile"');
    expect(markup).not.toContain("No eligible Game Master");
  });
});
