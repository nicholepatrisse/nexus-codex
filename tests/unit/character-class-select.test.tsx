import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterClassSelect } from "@/character/character-class-select";

describe("CharacterClassSelect", () => {
  it("submits and displays a supported initial class", () => {
    const markup = renderToStaticMarkup(<CharacterClassSelect defaultValue="Mystic" />);
    expect(markup).toContain('name="className" value="Mystic"');
    expect(markup).toContain(">Mystic<");
    expect(markup).toContain('aria-haspopup="listbox"');
  });

  it("clears unsupported legacy values", () => {
    const markup = renderToStaticMarkup(<CharacterClassSelect defaultValue="Vanguard" />);
    expect(markup).toContain('name="className" value=""');
    expect(markup).toContain("No class selected");
  });
});
