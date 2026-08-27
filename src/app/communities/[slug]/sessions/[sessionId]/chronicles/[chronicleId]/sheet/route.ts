import { getAuthenticatedActor } from "@/auth/actor";
import { getChronicleSheet } from "@/session/chronicle-sheets";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; sessionId: string; chronicleId: string }> }) {
  const actor = await getAuthenticatedActor();
  if (!actor) return new Response("Not found", { status: 404 });
  const { slug, sessionId, chronicleId } = await params;
  const sheet = await getChronicleSheet(actor, slug, sessionId, chronicleId);
  if (!sheet) return new Response("Not found", { status: 404 });
  const safeName = sheet.originalFilename.replace(/["\\\r\n]/g, "_");
  return new Response(new Uint8Array(sheet.contents), { headers: { "Content-Type": sheet.contentType, "Content-Length": String(sheet.byteSize), "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
}
