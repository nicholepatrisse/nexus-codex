import { getSiteUrl } from "@/app/social-metadata";
import { getAuthenticatedActor } from "@/auth/actor";
import { calendarFilename, getCalendarEventForParticipant, serializeCalendarEvent } from "@/session/calendar-export";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const actor = await getAuthenticatedActor();
  if (!actor) return new Response("Not found", { status: 404 });
  const { slug, sessionId } = await params;
  const event = await getCalendarEventForParticipant(actor, slug, sessionId, getSiteUrl().origin);
  if (!event) return new Response("Not found", { status: 404 });

  return new Response(serializeCalendarEvent(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarFilename(event.title)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
