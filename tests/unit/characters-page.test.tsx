import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: { personId: "person-1" } as { personId: string } | null,
  characters: [] as Array<{
    id: string;
    name: string;
    societyNumber: string | null;
    currentLevel: number;
    className: string | null;
    ancestry: string | null;
    background: string | null;
    totalXp: number;
  }>,
  redirect: vi.fn(),
  validation: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/auth/actor", () => ({ getAuthenticatedActor: vi.fn(async () => mocks.actor) }));
vi.mock("@/character/characters", () => ({ listCharacters: vi.fn(async () => mocks.characters) }));
vi.mock("@/character/character-validation-review", () => ({ getCharacterValidationReview: mocks.validation }));

import CharactersPage from "@/app/characters/page";

describe("characters page", () => {
  beforeEach(() => {
    mocks.actor = { personId: "person-1" };
    mocks.characters = [];
    mocks.redirect.mockReset();
    mocks.validation.mockReset();
    mocks.validation.mockResolvedValue(null);
  });

  it("renders the themed hero, primary action, and empty-state action", async () => {
    const markup = renderToStaticMarkup(await CharactersPage());

    expect(markup).toContain("Account");
    expect(markup).toContain("Your characters");
    expect(markup).toContain("Your crew, your story.");
    expect(markup).toContain('href="/characters/new"');
    expect(markup).toContain("Add character");
    expect(markup).toContain("No characters yet");
    expect(markup).toContain("Create a character");
  });

  it("renders each character with its validation state and navigation", async () => {
    mocks.characters = [{
      id: "character/one",
      name: "Veyra Sable",
      societyNumber: "123456-2701",
      currentLevel: 42,
      className: null,
      ancestry: "Human",
      background: "Scholar",
      totalXp: 987654,
    }];
    mocks.validation.mockResolvedValue({ summary: { presentation: "Rules Issue Found" } });

    const markup = renderToStaticMarkup(await CharactersPage());

    expect(markup).toContain('href="/characters/character%2Fone"');
    expect(markup).toContain("Veyra Sable");
    expect(markup).toContain("Level 42");
    expect(markup).toContain("XP 987654");
    expect(markup).toContain("Rules Issue Found");
    expect(markup).not.toContain("No characters yet");
    expect(mocks.validation).toHaveBeenCalledWith(mocks.actor, "character/one");
  });

  it("redirects unauthenticated visitors back to the characters page", async () => {
    mocks.actor = null;
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });

    await expect(CharactersPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?returnTo=%2Fcharacters");
  });
});
