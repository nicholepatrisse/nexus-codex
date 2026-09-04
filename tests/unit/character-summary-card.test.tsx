import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterSummaryCard } from "@/app/character-summary-card";

const character = { id: "character/one", name: "Veyra Sable", societyNumber: "123-2701", level: 2, className: "Witchwarper", totalXp: 12 };

describe("character summary card", () => {
  it.each([
    ["Validated", "border-l-success", "text-success"],
    ["Needs Review", "border-l-warning", "text-warning"],
    ["Rules Issue Found", "border-l-danger", "text-danger"],
  ] as const)("styles the %s validation state", (validation, rail, tone) => {
    const markup = renderToStaticMarkup(<CharacterSummaryCard character={character} validation={validation} />);
    expect(markup).toContain(rail);
    expect(markup).toContain(tone);
    expect(markup).toContain(validation);
    expect(markup).toContain('href="/characters/character%2Fone"');
  });
});
