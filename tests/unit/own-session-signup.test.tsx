import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OwnSessionSignup } from "@/app/communities/[slug]/sessions/[sessionId]/own-session-signup";

describe("own session signup", () => {
  it("identifies a confirmed registration and its persisted character", () => {
    const markup = renderToStaticMarkup(<OwnSessionSignup signup={{
      status: "confirmed",
      characterName: "Navasi",
      characterSocietyNumber: "123456-2701",
      characterLevel: 4,
    }} />);

    expect(markup).toContain("You’re registered");
    expect(markup).toContain("Your character");
    expect(markup).toContain("Navasi");
    expect(markup).toContain("123456-2701");
    expect(markup).toContain("Level 4");
  });

  it("shows the persisted waitlist position with the selected character", () => {
    const markup = renderToStaticMarkup(<OwnSessionSignup signup={{
      status: "waitlisted",
      waitlistPosition: 2,
      characterName: "Chiskisk",
    }} />);

    expect(markup).toContain("You’re waitlisted at position 2");
    expect(markup).toContain("Chiskisk");
  });
});
