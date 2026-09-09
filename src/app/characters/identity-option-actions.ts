"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import type { IdentitySelectionType } from "@/character/identity-validation";
import { importNethysOption, NethysOptionError, searchCharacterOptions, searchNethysOptions } from "@/nethys/options";

type IdentityType = Exclude<IdentitySelectionType, "class">;

export async function searchIdentityOptionsAction(query: string, expectedType: IdentityType) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { ok: false as const, error: "Enter at least 2 characters to search." };
  try {
    await requireAuthenticatedActor();
    const catalog = (await searchCharacterOptions(expectedType, trimmed)).map((option) => ({ id: option.id, optionType: expectedType, name: option.name, sourceMaterialIdentity: option.sourceMaterialIdentity, sourceMaterialTitle: option.sourceMaterialTitle, sourceUrl: option.sourceUrl, metadata: option.metadata }));
    let remote: Awaited<ReturnType<typeof searchNethysOptions>> = []; let remoteError: string | undefined;
    try { remote = await searchNethysOptions(trimmed, expectedType); }
    catch (error) { remoteError = error instanceof NethysOptionError ? error.message : "Archives of Nethys search is unavailable right now. Exact-link import and manual entry are still available."; }
    const catalogUrls = new Set(catalog.map(({ sourceUrl }) => sourceUrl));
    return { ok: true as const, catalog, remote: remote.filter(({ sourceUrl }) => !catalogUrls.has(sourceUrl)).map((option) => ({ ...option, optionType: expectedType, sourceMaterialIdentity: null, sourceMaterialTitle: option.sourceMaterialTitle ?? null, metadata: {} })), remoteError };
  } catch (error) {
    if (error instanceof NethysOptionError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t search Archives of Nethys. Exact-link import and manual entry are still available." };
  }
}

export async function importIdentityOptionAction(url: string, expectedType: IdentityType) {
  try {
    await requireAuthenticatedActor();
    const option = await importNethysOption(url, undefined, undefined, expectedType);
    return { ok: true as const, option: { id: option.id, optionType: expectedType, name: option.name, sourceMaterialIdentity: option.sourceMaterialIdentity, sourceMaterialTitle: option.sourceMaterialTitle, sourceUrl: option.sourceUrl, metadata: option.metadata } };
  } catch (error) {
    if (error instanceof NethysOptionError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t import that Archives of Nethys option. Your current selection is unchanged." };
  }
}
