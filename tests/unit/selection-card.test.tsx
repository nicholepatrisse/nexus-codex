import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectionCard } from "@/app/selection-card";

describe("SelectionCard", () => {
  it("preserves native radio semantics and visible choice context", () => {
    const markup = renderToStaticMarkup(<SelectionCard name="characterId" value="character-1" title="Navasi" description="123456-2701" metadata="Level 3" checked onChange={() => undefined} />);

    expect(markup).toContain('type="radio"');
    expect(markup).toContain('name="characterId"');
    expect(markup).toContain('value="character-1"');
    expect(markup).toContain("Navasi");
    expect(markup).toContain("123456-2701");
    expect(markup).toContain("Level 3");
    expect(markup).toContain("checked");
  });

  it("passes unavailable state to the native control", () => {
    const markup = renderToStaticMarkup(<SelectionCard name="choice" value="closed" title="Unavailable" disabled />);

    expect(markup).toContain("disabled");
  });
});
