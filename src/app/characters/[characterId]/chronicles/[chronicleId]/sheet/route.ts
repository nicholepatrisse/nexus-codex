import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterChronicleSheet } from "@/session/chronicle-sheets";

export async function GET(_request: Request, { params }: { params: Promise<{ characterId: string; chronicleId: string }> }) {
  const actor = await getAuthenticatedActor();
  if (!actor) return new Response("Not found", { status: 404 });
  const { characterId, chronicleId } = await params;
  const sheet = await getCharacterChronicleSheet(actor, characterId, chronicleId);
  if (!sheet) return new Response("Not found", { status: 404 });
  const safeName = sheet.originalFilename.replace(/["\\\r\n]/g, "_");
  return new Response(new Uint8Array(sheet.contents), { headers: { "Content-Type": sheet.contentType, "Content-Length": String(sheet.byteSize), "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
}
