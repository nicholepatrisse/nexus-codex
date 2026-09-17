import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionButton, AngularPanel, CoverFrame, PageHero, SectionEyebrow, StarfieldMotif } from "@/app/visual-system";

describe("Nexus presentation primitives", () => {
  it("renders reusable frames without changing semantic content", () => {
    const markup = renderToStaticMarkup(<><AngularPanel>Panel</AngularPanel><CoverFrame ratio="square">Cover</CoverFrame></>);
    expect(markup).toContain("nexus-panel");
    expect(markup).toContain("nexus-cover-square");
    expect(markup).toContain("Panel");
  });

  it("supports link and button actions with shared visual states", () => {
    const markup = renderToStaticMarkup(<><ActionButton href="/games">Browse</ActionButton><ActionButton variant="secondary" disabled>Wait</ActionButton></>);
    expect(markup).toContain('href="/games"');
    expect(markup).toContain("nexus-action-primary");
    expect(markup).toContain("nexus-action-secondary");
    expect(markup).toContain("disabled");
  });

  it("keeps ambient decoration out of the accessibility tree", () => {
    const markup = renderToStaticMarkup(<><SectionEyebrow>Signal</SectionEyebrow><StarfieldMotif /><PageHero title="Characters" eyebrow="Roster">Ready.</PageHero></>);
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(6);
    expect(markup).toContain("Characters");
    expect(markup).toContain("Ready.");
  });
});
