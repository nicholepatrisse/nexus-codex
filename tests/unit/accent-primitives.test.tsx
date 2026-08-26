import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccentDivider, AccentSurface, OrbitMotif, SparkAccent } from "@/app/accent-primitives";

describe("accent primitives", () => {
  it("applies optional surface treatments without changing its content", () => {
    const decorated = renderToStaticMarkup(<AccentSurface>Welcome</AccentSurface>);
    const plain = renderToStaticMarkup(<AccentSurface enabled={false}>Welcome</AccentSurface>);

    expect(decorated).toContain("accent-illuminated-border");
    expect(decorated).toContain("accent-brand-gradient");
    expect(decorated).toContain("accent-radial-glow");
    expect(plain).toBe("<div>Welcome</div>");
  });

  it("renders decorative motifs with semantic theme colors", () => {
    const markup = renderToStaticMarkup(<><SparkAccent /><OrbitMotif /></>);

    expect(markup).toContain("var(--theme-accent)");
    expect(markup).toContain("var(--theme-accent-secondary)");
    expect(markup).toContain("var(--theme-border-strong)");
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it("renders a semantic branded divider", () => {
    const markup = renderToStaticMarkup(<AccentDivider label="Next transmission" />);

    expect(markup).toContain('role="separator"');
    expect(markup).toContain("Next transmission");
  });
});
