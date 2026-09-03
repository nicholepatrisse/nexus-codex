import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalendarLink } from "@/app/communities/[slug]/sessions/[sessionId]/calendar-link";

describe("calendar link", () => {
  it("links to the encoded session calendar download", () => {
    const markup = renderToStaticMarkup(<CalendarLink slug="absalom lodge" sessionId="session/one" />);
    expect(markup).toContain('href="/communities/absalom%20lodge/sessions/session%2Fone/calendar"');
    expect(markup).toContain("Add to calendar");
  });
});
