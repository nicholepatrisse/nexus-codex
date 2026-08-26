import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NexusCodexMark } from "@/app/nexus-codex-mark";
import manifest from "@/app/manifest";

describe("NexusCodexMark", () => {
  it("renders the compact brand mark using semantic theme colors", () => {
    const markup = renderToStaticMarkup(<NexusCodexMark />);

    expect(markup).toContain('viewBox="0 0 48 48"');
    expect(markup).toContain("var(--theme-brand)");
    expect(markup).toContain("var(--theme-accent)");
    expect(markup).toContain('aria-hidden="true"');
  });
});

describe("Nexus Codex app icons", () => {
  it("publishes standard and maskable PWA icons", () => {
    const metadata = manifest();

    expect(metadata.name).toBe("Nexus Codex");
    expect(metadata.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
  });
});
