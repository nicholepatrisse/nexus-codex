import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GmCreditBadge } from "@/app/gm-credit-badge";

describe("GM Credit badge", () => {
  it("uses visible text and an explicit accessible label", () => {
    const markup = renderToStaticMarkup(<GmCreditBadge />);
    expect(markup).toContain(">GM Credit</span>");
    expect(markup).toContain('aria-label="Earned as GM Credit"');
    expect(markup).toContain("border-info/40");
  });
});
