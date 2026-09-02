"use server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedActor } from "@/auth/actor";
import { addCatalogOwnedMaterial, addKnownOwnedMaterial, addOwnedMaterial, addReferencedOwnedMaterial, removeOwnedMaterial } from "@/materials/materials";

export type MaterialActionState = { error?: string; added?: boolean };
export async function addMaterialAction(_state: MaterialActionState, formData: FormData): Promise<MaterialActionState> {
  const actor = await getAuthenticatedActor(); if (!actor) return { error: "Sign in to manage materials." };
  try { await addOwnedMaterial(actor, String(formData.get("sourceUrl") ?? "")); revalidatePath("/profile"); return { added: true }; }
  catch (error) { return { error: error instanceof Error ? error.message : "The material could not be added." }; }
}
export async function removeMaterialAction(id: string) { const actor = await getAuthenticatedActor(); if (actor) { await removeOwnedMaterial(actor, id); revalidatePath("/profile"); } }

export async function addCatalogMaterialAction(_state: MaterialActionState, formData: FormData): Promise<MaterialActionState> {
  const actor = await getAuthenticatedActor(); if (!actor) return { error: "Sign in to manage materials." };
  try { const material = await addCatalogOwnedMaterial(actor, String(formData.get("sourceMaterialId") ?? "")); if (!material) return { error: "Choose a source material from the catalog." }; revalidatePath("/profile"); return { added: true }; }
  catch { return { error: "The catalog material could not be added." }; }
}

export type ResolveMaterialState = { ok: true; identities: string[]; duplicate: boolean } | { ok: false; error: string };
export async function resolveMaterialAction(sourceUrl: string, expectedIdentity: string, expectedTitle: string): Promise<ResolveMaterialState> {
  const actor = await getAuthenticatedActor(); if (!actor) return { ok: false, error: "Sign in to manage materials." };
  try { const result = await addReferencedOwnedMaterial(actor, sourceUrl, expectedIdentity, expectedTitle); revalidatePath("/profile"); return { ok: true, identities: result.identities, duplicate: result.duplicate }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The material could not be added." }; }
}

export type ResolveKnownMaterialState = { found: true; identities: string[]; duplicate: boolean } | { found: false; error?: string };
export async function resolveKnownMaterialAction(expectedIdentity: string, expectedTitle: string): Promise<ResolveKnownMaterialState> {
  const actor = await getAuthenticatedActor(); if (!actor) return { found: false, error: "Sign in to manage materials." };
  try { const result = await addKnownOwnedMaterial(actor, expectedIdentity, expectedTitle); if (!result) return { found: false }; revalidatePath("/profile"); return { found: true, ...result }; }
  catch { return { found: false, error: "Materials Owned could not be checked right now." }; }
}
