"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import type { IdentitySelectionType } from "@/character/identity-validation";
import { importNethysOption, NethysOptionError } from "@/nethys/options";

export async function importIdentityOptionAction(url: string, expectedType: Exclude<IdentitySelectionType, "class">) {
  try {
    await requireAuthenticatedActor();
    const option = await importNethysOption(url, undefined, undefined, expectedType);
    return { ok: true as const, option: { optionType: expectedType, name: option.name, sourceMaterialIdentity: option.sourceMaterialIdentity, sourceMaterialTitle: option.sourceMaterialTitle, metadata: option.metadata } };
  } catch (error) {
    if (error instanceof NethysOptionError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t import that Archives of Nethys option. Your current selection is unchanged." };
  }
}
