import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityCard } from "@/app/community-card";
import { EmptyState } from "@/app/empty-state";
import { StatusBadge } from "@/app/status-badge";
import { DescriptionItem, DescriptionList } from "@/app/description-list";

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

  it("renders compact multi-column description lists with composable values", () => {
    const markup = renderToStaticMarkup(<DescriptionList density="compact" columns={2}>
      <DescriptionItem label="Website"><a href="/rules">Rules</a></DescriptionItem>
      <DescriptionItem label="Status"><StatusBadge tone="success">Ready</StatusBadge></DescriptionItem>
    </DescriptionList>);
    expect(markup).toContain("<dl");
    expect(markup).toContain("gap-y-2");
    expect(markup).toContain("sm:grid-cols-2");
    expect(markup).toContain('<a href="/rules">Rules</a>');
    expect(markup).toContain("Ready");
  });

  it("wraps long values and applies the explicit missing-value policy", () => {
    const markup = renderToStaticMarkup(<DescriptionList>
      <DescriptionItem label="Notes">A very long value that remains readable without overflowing its container</DescriptionItem>
      <DescriptionItem label="Omitted">{null}</DescriptionItem>
      <DescriptionItem label="Unavailable" empty="placeholder" placeholder="Not provided">{null}</DescriptionItem>
    </DescriptionList>);
    expect(markup).toContain("break-words");
    expect(markup).not.toContain("Omitted");
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("Not provided");
  });
});
