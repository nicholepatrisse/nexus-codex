"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedActor } from "@/auth/actor";
import { characterOptionSelectionInputSchema, createCharacterOptionSelection, deleteCharacterOptionSelection, updateCharacterOptionSelection } from "@/character/option-selections";

export type OptionCardState = { error?: string; saved?: boolean };

const optionInput = (formData: FormData) => characterOptionSelectionInputSchema.safeParse({
  selectionKind: formData.get("selectionKind"), name: formData.get("name"), acquiredLevel: formData.get("acquiredLevel"), featCategory: formData.get("featCategory") || null,
  acquisitionMethod: formData.get("acquisitionMethod") || null, grantOrigin: formData.get("grantOrigin") || null, validationNote: formData.get("validationNote") || null,
  characterOptionId: formData.get("characterOptionId") || null, sourceMaterialIdentity: formData.get("sourceMaterialIdentity") || null, sourceMaterialTitle: formData.get("sourceMaterialTitle") || null,
  sourceUrl: formData.get("sourceUrl") || null, sourceChronicleId: formData.get("sourceChronicleId") || null,
});

export async function createOptionCardAction(characterId: string, formData: FormData): Promise<OptionCardState> {
  const parsed = optionInput(formData); if (!parsed.success) return { error: z.prettifyError(parsed.error) };
  try {
    const created = await createCharacterOptionSelection(await requireAuthenticatedActor(), characterId, parsed.data);
    if (!created) return { error: "You do not have permission to add this selection." };
    revalidatePath(`/characters/${characterId}`); return { saved: true };
  } catch { return { error: "We couldn’t add this selection. A character can have only one heritage." }; }
}

export async function updateOptionCardAction(characterId: string, selectionId: string, _state: OptionCardState, formData: FormData): Promise<OptionCardState> {
  const parsed = optionInput(formData);
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };
  try {
    const updated = await updateCharacterOptionSelection(await requireAuthenticatedActor(), characterId, selectionId, parsed.data);
    if (!updated) return { error: "You do not have permission to edit this selection." };
    revalidatePath(`/characters/${characterId}`);
    return { saved: true };
  } catch { return { error: "We couldn’t save this selection. Please review the details and try again." }; }
}

export async function deleteOptionCardAction(characterId: string, selectionId: string) {
  try {
    const deleted = await deleteCharacterOptionSelection(await requireAuthenticatedActor(), characterId, selectionId);
    if (!deleted) return { ok: false as const, error: "You do not have permission to remove this selection." };
    revalidatePath(`/characters/${characterId}`);
    return { ok: true as const };
  } catch { return { ok: false as const, error: "We couldn’t remove this selection. Please try again." }; }
}
