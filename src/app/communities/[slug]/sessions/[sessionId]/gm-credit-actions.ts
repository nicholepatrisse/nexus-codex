"use server";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedActor } from "@/auth/actor";
import { applyGmCredit } from "@/session/gm-credit";

export type GmCreditState = { status?: "saved"; error?: string };
export async function applyGmCreditAction(slug: string, sessionId: string, _state: GmCreditState, formData: FormData): Promise<GmCreditState> {
  const characterId = formData.get("characterId");
  if (typeof characterId !== "string" || !characterId) return { error: "Choose a character." };
  const result = await applyGmCredit(await requireAuthenticatedActor(), sessionId, characterId);
  if (!result) return { error: "You cannot apply GM credit to that character for this session." };
  revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
  revalidatePath("/characters", "layout");
  return { status: "saved" };
}
