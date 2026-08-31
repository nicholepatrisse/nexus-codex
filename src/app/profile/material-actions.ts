"use server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedActor } from "@/auth/actor";
import { addOwnedMaterial, removeOwnedMaterial } from "@/materials/materials";

export type MaterialActionState = { error?: string; added?: boolean };
export async function addMaterialAction(_state: MaterialActionState, formData: FormData): Promise<MaterialActionState> {
  const actor = await getAuthenticatedActor(); if (!actor) return { error: "Sign in to manage materials." };
  try { await addOwnedMaterial(actor, String(formData.get("sourceUrl") ?? "")); revalidatePath("/profile"); return { added: true }; }
  catch (error) { return { error: error instanceof Error ? error.message : "The material could not be added." }; }
}
export async function removeMaterialAction(id: string) { const actor = await getAuthenticatedActor(); if (actor) { await removeOwnedMaterial(actor, id); revalidatePath("/profile"); } }
