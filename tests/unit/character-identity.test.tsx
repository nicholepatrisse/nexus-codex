import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterIdentity, characterIdentityFields, formatCharacterIdentityText } from "@/character/character-identity";

const character = { name: "A Very Long Character Name", societyNumber: "123-2001", level: 3, className: "Envoy", ancestry: "Human", background: "Icon" };

describe("CharacterIdentity", () => {
  it("uses one canonical field order and labels", () => {
    expect(characterIdentityFields(character)).toEqual([
      { label: "Society #", value: "123-2001" }, { label: "Level", value: "3" }, { label: "Class", value: "Envoy" }, { label: "Ancestry", value: "Human" }, { label: "Background", value: "Icon" },
    ]);
    expect(formatCharacterIdentityText(character)).toBe("A Very Long Character Name · Society # 123-2001 · Level 3 · Class Envoy · Ancestry Human · Background Icon");
  });

  it.each(["compact", "selection", "dropdown-option", "detail"] as const)("renders the %s composition safely", (variant) => {
    const markup = renderToStaticMarkup(<CharacterIdentity character={character} variant={variant} />);
    expect(markup).toContain("A Very Long Character Name");
    expect(markup).toContain("Society #");
    expect(markup).toContain("Background");
    expect(markup).toMatch(/break-words|truncate/);
  });

  it("omits absent optional fields without empty separators", () => {
    expect(formatCharacterIdentityText({ name: "Navasi", level: 1 })).toBe("Navasi · Level 1");
  });
});
