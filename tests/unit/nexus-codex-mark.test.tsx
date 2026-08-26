import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NexusCodexMark } from "@/app/nexus-codex-mark";

describe("NexusCodexMark", () => {
  it("renders the compact brand mark using semantic theme colors", () => {
    const markup = renderToStaticMarkup(<NexusCodexMark />);

    expect(markup).toContain('viewBox="0 0 48 48"');
    expect(markup).toContain("var(--theme-brand)");
    expect(markup).toContain("var(--theme-accent)");
    expect(markup).toContain('aria-hidden="true"');
  });
});
