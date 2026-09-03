import { describe, expect, it } from "vitest";
import { calendarFilename, serializeCalendarEvent } from "@/session/calendar-export";

describe("calendar export", () => {
  const event = {
    sessionId: "session/one",
    title: "1-09 — Abduction",
    communityName: "Absalom; Lodge",
    characterName: "Navasi, Envoy",
    startsAt: new Date("2030-07-01T18:00:00-04:00"),
    endsAt: new Date("2030-07-01T22:00:00-04:00"),
    timeZone: "America/New_York",
    status: "published" as const,
    sessionUrl: "https://nexus.example/communities/absalom/sessions/session%2Fone",
  };

  it("serializes a valid, private-data-minimal iCalendar event with exact instants", () => {
    const calendar = serializeCalendarEvent(event, new Date("2030-01-01T00:00:00Z"));
    const unfolded = calendar.replace(/\r\n /g, "");
    expect(calendar).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(calendar).toContain("DTSTART:20300701T220000Z");
    expect(calendar).toContain("DTEND:20300702T020000Z");
    expect(calendar).toContain("X-WR-TIMEZONE:America/New_York");
    expect(calendar).toContain("SUMMARY:1-09 — Abduction");
    expect(calendar).toContain("Community: Absalom\\; Lodge");
    expect(calendar).toContain("Character: Navasi\\, Envoy");
    expect(unfolded).toContain("Session: https://nexus.example/");
    expect(calendar).toMatch(/\r\n [^\r\n]+/);
    expect(calendar.endsWith("\r\n")).toBe(true);
  });

  it("creates a safe attachment filename", () => {
    expect(calendarFilename(event.title)).toBe("1-09-abduction.ics");
  });

  it("marks a cancelled session as cancelled", () => {
    expect(serializeCalendarEvent({ ...event, status: "cancelled" })).toContain("STATUS:CANCELLED\r\n");
  });
});
