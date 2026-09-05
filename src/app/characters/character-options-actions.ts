"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import { importNethysOption, NethysOptionError } from "@/nethys/options";

export async function importCharacterOptionAction(url: string, expectedType: "heritage" | "feat") {
  try {
    await requireAuthenticatedActor();
    const option = await importNethysOption(url, undefined, undefined, expectedType);
    return { ok: true as const, option: { id: option.id, name: option.name, sourceMaterialIdentity: option.sourceMaterialIdentity, sourceMaterialTitle: option.sourceMaterialTitle, sourceUrl: option.sourceUrl, metadata: option.metadata } };
  } catch (error) {
    if (error instanceof NethysOptionError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t import that Archives of Nethys option. You can still enter it manually." };
  }
}
