"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import { importNethysOption, NethysOptionError, searchCharacterOptions, searchNethysOptions, type FeatCategory } from "@/nethys/options";

export async function searchCharacterOptionsAction(query: string, expectedType: "heritage" | "feat", category?: FeatCategory) {
  try {
    await requireAuthenticatedActor();
    const catalog = (await searchCharacterOptions(expectedType, query)).filter((option) => !category || option.metadata.featCategory === category).map((option) => ({ id: option.id, name: option.name, sourceMaterialIdentity: option.sourceMaterialIdentity, sourceMaterialTitle: option.sourceMaterialTitle, sourceUrl: option.sourceUrl, metadata: option.metadata }));
    let remote: Awaited<ReturnType<typeof searchNethysOptions>> = []; let remoteError: string | undefined;
    try { remote = await searchNethysOptions(query, expectedType, category); }
    catch (error) { remoteError = error instanceof NethysOptionError ? error.message : "Archives of Nethys search is unavailable right now. Manual entry and link import are still available."; }
    const catalogUrls = new Set(catalog.map(({ sourceUrl }) => sourceUrl));
    return { ok: true as const, catalog, remote: remote.filter(({ sourceUrl }) => !catalogUrls.has(sourceUrl)), remoteError };
  } catch (error) {
    if (error instanceof NethysOptionError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t search Archives of Nethys. Manual entry and link import are still available." };
  }
}

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
