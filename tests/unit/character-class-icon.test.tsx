import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterClassIcon, getCharacterClassIcon } from "@/character/character-class-icon";

describe("CharacterClassIcon", () => {
  it.each(["Envoy", "Mystic", "Operative", "Solarian", "Soldier", "Witchwarper"])("maps the supported %s class", (className) => {
    expect(getCharacterClassIcon(className)?.label).toBe(className);
    expect(getCharacterClassIcon(className)?.src).toBe(`/character-class-icons/${className.toLowerCase()}.png`);
  });

  it("normalizes class names before matching", () => {
    expect(getCharacterClassIcon("  SOLARIAN ")?.label).toBe("Solarian");
  });

  it("renders no image when the class is missing or unsupported", () => {
    expect(renderToStaticMarkup(<CharacterClassIcon className={null} />)).toBe("");
    expect(renderToStaticMarkup(<CharacterClassIcon className="  " />)).toBe("");
    expect(renderToStaticMarkup(<CharacterClassIcon className="Vanguard" />)).toBe("");
  });
});
