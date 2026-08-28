import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityCard } from "@/app/community-card";
import { EmptyState } from "@/app/empty-state";
import { StatusBadge } from "@/app/status-badge";

describe("shared UI patterns", () => {
  it("renders an empty state with semantic content and optional composition", () => {
    const markup = renderToStaticMarkup(<EmptyState as="section" align="center" title="Nothing here" description="Add the first item." action={<a href="/new">Add item</a>} />);
    expect(markup).toContain("<section");
    expect(markup).toContain("Nothing here");
    expect(markup).toContain("Add item");
    expect(markup).toContain("text-center");
  });

  it("maps badge tones to semantic theme colors", () => {
    const markup = renderToStaticMarkup(<StatusBadge tone="warning">Needs review</StatusBadge>);
    expect(markup).toContain("border-warning/30");
    expect(markup).toContain("text-warning");
  });

  it("renders community variants without changing the domain structure", () => {
    const markup = renderToStaticMarkup(<CommunityCard name="Nexus" slug="nexus" href="/communities/nexus" metadata="Archived" muted />);
    expect(markup).toContain('href="/communities/nexus"');
    expect(markup).toContain("Nexus");
    expect(markup).toContain("Archived");
    expect(markup).toContain("bg-surface/70");
  });
});
