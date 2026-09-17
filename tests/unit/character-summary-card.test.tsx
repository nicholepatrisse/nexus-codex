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
    expect(markup).toContain('d="M1 2 H987 L998 13 V87 L987 98 H1 Z"');
  });

  it("renders long identity values and high progression values without truncating them", () => {
    const longName = "Captain Veyra Sable of the Unreasonably Long Interstellar Expedition";
    const markup = renderToStaticMarkup(<CharacterSummaryCard character={{
      ...character,
      name: longName,
      level: 999,
      totalXp: 123456789,
    }} validation="Validated" />);

    expect(markup).toContain(longName);
    expect(markup).toContain("break-words");
    expect(markup).toContain("Level 999");
    expect(markup).toContain("XP 123456789");
  });

  it("remains readable when class data is missing", () => {
    const markup = renderToStaticMarkup(<CharacterSummaryCard character={{
      ...character,
      className: null,
    }} validation="Needs Review" />);

    expect(markup).toContain(character.name);
    expect(markup).toContain("Level 2");
    expect(markup).not.toContain("Class ");
    expect(markup).not.toContain("character-card-chip\">Envoy");
  });
});
