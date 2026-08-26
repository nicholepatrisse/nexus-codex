import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionSignupControl } from "@/app/communities/[slug]/session-signup-control";
import { parseSessionReturnTo } from "@/character/character-creation-return";

describe("character creation return destinations", () => {
  it("accepts only canonical session paths", () => {
    expect(parseSessionReturnTo("/communities/star-finders/sessions/session_123")).toEqual({ slug: "star-finders", sessionId: "session_123" });
  });

  it.each([
    "https://evil.example/communities/test/sessions/1",
    "//evil.example/communities/test/sessions/1",
    "/characters",
    "/communities/test/sessions/1?next=https://evil.example",
    "/communities/../sessions/1",
  ])("rejects unsafe or unrelated destination %s", (value) => {
    expect(parseSessionReturnTo(value)).toBeNull();
  });

  it("includes the originating session in the create-character link", () => {
    const markup = renderToStaticMarkup(<SessionSignupControl slug="star-finders" sessionId="session_123" characters={[]} />);
    expect(markup).toContain("/characters/new?returnTo=%2Fcommunities%2Fstar-finders%2Fsessions%2Fsession_123");
  });

  it("offers character creation when eligible characters already exist", () => {
    const markup = renderToStaticMarkup(<SessionSignupControl slug="star-finders" sessionId="session_123" characters={[{ id: "character-1", name: "Navasi", societyNumber: "123456-2701", currentLevel: 1 }]} />);
    expect(markup).toContain("Add another character");
    expect(markup).toContain("Level 1");
    expect(markup).toContain("/characters/new?returnTo=%2Fcommunities%2Fstar-finders%2Fsessions%2Fsession_123");
  });
});
