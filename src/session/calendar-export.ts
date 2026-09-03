import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import { characters, communities, contentItems, sessionSignups, sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

export interface CalendarEvent {
  sessionId: string;
  title: string;
  communityName: string;
  characterName: string | null;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  status: "published" | "completed" | "cancelled";
  sessionUrl: string;
}

export async function getCalendarEventForParticipant(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  siteOrigin: string,
  database: Database = getDb(),
): Promise<CalendarEvent | null> {
  const access = await resolveCommunityAccessBySlug(slug, actor.personId, database);
  if (access.status !== "available") return null;

  const [row] = await database.select({
    sessionId: sessions.id,
    scenarioCode: contentItems.code,
    scenarioTitle: contentItems.title,
    communityName: communities.name,
    startsAt: sessions.startsAt,
    endsAt: sessions.endsAt,
    timeZone: sessions.displayTimeZone,
    status: sessions.status,
    characterName: characters.name,
    pregenName: sessionSignups.pregenName,
  }).from(sessions)
    .leftJoin(sessionSignups, and(
      eq(sessionSignups.sessionId, sessions.id),
      eq(sessionSignups.personId, actor.personId),
      inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
    ))
    .innerJoin(communities, eq(communities.id, sessions.communityId))
    .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
    .leftJoin(characters, eq(characters.id, sessionSignups.characterId))
    .where(and(
      eq(sessions.id, sessionId),
      eq(sessions.communityId, access.community.id),
      inArray(sessions.status, ["published", "completed", "cancelled"]),
      or(eq(sessions.gmPersonId, actor.personId), isNotNull(sessionSignups.id)),
    )).limit(1);
  if (!row) return null;

  return {
    sessionId: row.sessionId,
    title: `${row.scenarioCode} — ${row.scenarioTitle}`,
    communityName: row.communityName,
    characterName: row.pregenName ?? row.characterName,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timeZone: row.timeZone,
    status: row.status === "cancelled" ? "cancelled" : row.status === "completed" ? "completed" : "published",
    sessionUrl: new URL(`/communities/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}`, siteOrigin).href,
  };
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function formatUtc(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldLine(line: string) {
  const chunks: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 74) {
      chunks.push(current);
      current = ` ${character}`;
      bytes = 1 + size;
    } else {
      current += character;
      bytes += size;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n");
}

export function serializeCalendarEvent(event: CalendarEvent, generatedAt: Date = new Date()) {
  const description = [
    `Community: ${event.communityName}`,
    event.characterName ? `Character: ${event.characterName}` : null,
    `Session: ${event.sessionUrl}`,
    `Scheduled timezone: ${event.timeZone}`,
  ].filter((line): line is string => Boolean(line)).join("\n");
  const uidHost = new URL(event.sessionUrl).hostname || "nexus-codex";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexus Codex//Session Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${escapeText(event.timeZone)}`,
    "BEGIN:VEVENT",
    `UID:${escapeText(event.sessionId)}@${escapeText(uidHost)}`,
    `DTSTAMP:${formatUtc(generatedAt)}`,
    `DTSTART:${formatUtc(event.startsAt)}`,
    `DTEND:${formatUtc(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${event.sessionUrl}`,
    ...(event.status === "cancelled" ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function calendarFilename(title: string) {
  const base = title.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${base || "nexus-codex-session"}.ics`;
}
