import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterSummaryCard } from "@/app/character-summary-card";

const character = { id: "character/one", name: "Veyra Sable", societyNumber: "123-2701", level: 2, className: "Witchwarper", totalXp: 12 };

describe("character summary card", () => {
  it.each([
    ["Validated", "text-success", "text-success"],
    ["Needs Review", "text-warning", "text-warning"],
    ["Rules Issue Found", "text-danger", "text-danger"],
  ] as const)("styles the %s validation state", (validation, rail, tone) => {
    const markup = renderToStaticMarkup(<CharacterSummaryCard character={character} validation={validation} />);
    expect(markup).toContain(rail);
    expect(markup).toContain(tone);
    expect(markup).toContain("select-none");
    expect(markup).toContain(validation);
    expect(markup).toContain('href="/characters/character%2Fone"');
    expect(markup).toContain("%2Fcharacter-portrait-placeholder.png");
    expect(markup.indexOf("character-card-portrait")).toBeLessThan(markup.indexOf("character-card-class-icon"));
    expect(markup).toContain('d="M36 0 L7 32 L7 144 L22 172"');
    expect(markup).toContain("linearGradient");
    expect(markup).toContain("character-card-rail-cutout");
    expect(markup).toContain("character-card-rail-mask");
    expect(markup).toContain("character-card-shell-frame");
    expect(markup).toContain('d="M0 1 H988 L999 12 V88 L988 99 H0"');
  });
});
