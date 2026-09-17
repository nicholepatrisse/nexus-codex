"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail, updateCharacterInputSchema } from "@/character/characters";
import { getIdentityValidationContext } from "@/character/identity-validation-context";
import { characterOptionSelectionInputSchema, listOwnedCharacterOptionSelections } from "@/character/option-selections";
import { validateCharacterOptionSelection } from "@/character/option-selection-validation";
import { parsePathbuilderImportV1, PathbuilderImportError } from "@/import/pathbuilder-v1";
import { resolvePathbuilderImportV1 } from "@/import/pathbuilder-resolution-v1";
import { validateIdentitySelection } from "@/character/identity-validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchNethysOption, normalizeOptionName } from "@/nethys/options";
import { getDb } from "@/db/client";
import { characterOptionSelections, characterOptions, characters } from "@/db/schema";

const IMPORT_SOURCE = "pathbuilder-pathmuncher";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const selectionRevision = (rows: Array<{ id: string; updatedAt: Date }>) => digest(rows.map(({ id, updatedAt }) => [id, updatedAt.toISOString()]));

export type PathmuncherPreviewState =
  | { ok: false; error: string }
  | { ok: true; preview: Awaited<ReturnType<typeof previewPathmuncherImportAction>> extends { ok: true; preview: infer P } ? P : never };

export async function previewPathmuncherImportAction(json: string, characterId?: string) {
  try {
    const actor = await requireAuthenticatedActor();
    const candidate = parsePathbuilderImportV1(json);
    const [context, character, existingOptions] = await Promise.all([
      getIdentityValidationContext(actor),
      characterId ? getCharacterDetail(actor, characterId) : null,
      characterId ? listOwnedCharacterOptionSelections(actor, characterId) : Promise.resolve([]),
    ]);
    const [characterVersion] = characterId ? await getDb().select({ updatedAt: characters.updatedAt }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1) : [];
    if (characterId && (!character || !character.isOwner || existingOptions === null)) return { ok: false as const, error: "You do not have permission to import into this character." };
    const backgroundOption = context.options.find((option) => option.optionType === "background" && normalizeOptionName(option.name) === normalizeOptionName(candidate.character.background));
    const hasGrantMetadata = backgroundOption && [backgroundOption.metadata.grantedFeats, backgroundOption.metadata.awardedFeats, backgroundOption.metadata.feats].some(Array.isArray);
    const refreshedBackground = backgroundOption?.sourceUrl && !hasGrantMetadata ? await fetchNethysOption(backgroundOption.sourceUrl).catch(() => null) : null;
    const resolutionContext = refreshedBackground ? { ...context, options: context.options.map((option) => option === backgroundOption ? { ...option, metadata: refreshedBackground.metadata } : option) } : context;
    const review = resolvePathbuilderImportV1(candidate, resolutionContext.options);
    const value = (match: typeof review.character.class) => match.option?.name ?? match.rawValue;
    const className = value(review.character.class);
    const ancestry = value(review.character.ancestry);
    const background = value(review.character.background);
    const options = [
      ...review.character.heritages.map((match, index) => ({
        key: `import-heritage-${index}`, selectionKind: "heritage" as const, name: value(match), acquiredLevel: 1,
        featCategory: null, acquisitionMethod: "selected" as const, grantOrigin: "", characterOptionId: match.option?.id ?? null,
        sourceMaterialIdentity: match.option?.sourceMaterialIdentity ?? null, sourceMaterialTitle: match.option?.sourceMaterialTitle ?? null,
        sourceUrl: match.option?.sourceUrl ?? null,
      })),
      ...review.feats.map((feat, index) => {
        const name = value(feat.match);
        const previous = character?.background === background ? existingOptions?.find((option) => option.selectionKind === "feat" && option.nameSnapshot.localeCompare(name, undefined, { sensitivity: "accent" }) === 0) : null;
        return {
          key: `import-feat-${index}`, selectionKind: "feat" as const, name, acquiredLevel: Math.max(1, feat.raw.acquiredLevel),
          featCategory: feat.featCategory, acquisitionMethod: feat.acquisitionMethod,
          grantOrigin: feat.likelyOrigins.map(({ name: origin }) => origin).join(", ") || previous?.grantOrigin || "", characterOptionId: feat.match.option?.id ?? null,
          sourceMaterialIdentity: feat.match.option?.sourceMaterialIdentity ?? null, sourceMaterialTitle: feat.match.option?.sourceMaterialTitle ?? null,
          sourceUrl: feat.match.option?.sourceUrl ?? null,
        };
      }),
    ];
    const identityValidation = {
      ancestry: validateIdentitySelection("ancestry", ancestry, resolutionContext),
      background: validateIdentitySelection("background", background, resolutionContext),
    };
    const optionValidation = options.map((option) => validateCharacterOptionSelection({
      id: option.key, characterId: characterId ?? "preview", selectionKind: option.selectionKind, nameSnapshot: option.name,
      acquiredLevel: option.acquiredLevel, featCategory: option.featCategory, acquisitionMethod: option.acquisitionMethod,
      grantOrigin: option.grantOrigin || null, characterOptionId: option.characterOptionId, sourceMaterialIdentitySnapshot: option.sourceMaterialIdentity,
      sourceMaterialTitleSnapshot: option.sourceMaterialTitle, sourceUrlSnapshot: option.sourceUrl, validationNote: null,
      sourceChronicleId: null, importSource: null, importKey: null, createdAt: new Date(0), updatedAt: new Date(0),
    }, { className, ancestry, background }, resolutionContext));
    const oldOptions = existingOptions ?? [];
    const normalized = (text: string) => text.trim().toLocaleLowerCase("en-US");
    const importedKeys = new Set(options.map((option) => `${option.selectionKind}:${normalized(option.name)}`));
    const oldKeys = new Set(oldOptions.map((option) => `${option.selectionKind}:${normalized(option.nameSnapshot)}`));
    const optionChanges: Array<{ id?: string; name: string; kind: "heritage" | "feat"; change: "unchanged" | "addition" | "removal" }> = options.map((option) => ({ name: option.name, kind: option.selectionKind, change: oldKeys.has(`${option.selectionKind}:${normalized(option.name)}`) ? "unchanged" : "addition" }));
    optionChanges.push(...oldOptions.filter((option) => !importedKeys.has(`${option.selectionKind}:${normalized(option.nameSnapshot)}`)).map((option) => ({ id: option.id, name: option.nameSnapshot, kind: option.selectionKind as "heritage" | "feat", change: "removal" as const })));
    const proposed = { name: review.character.name, className, ancestry, background, options };
    return { ok: true as const, preview: {
      review, proposed, identityValidation, optionValidation,
      approval: { sourceJson: json, digest: digest({ candidate, proposed }), characterUpdatedAt: characterVersion?.updatedAt.toISOString() ?? null, selectionRevision: selectionRevision(existingOptions ?? []) },
      changes: character ? {
        fields: (["name", "className", "ancestry", "background"] as const).map((field) => ({ field, before: character[field] ?? "", after: ({ name: review.character.name, className, ancestry, background })[field], change: (character[field] ?? "") === ({ name: review.character.name, className, ancestry, background })[field] ? "unchanged" as const : "change" as const })),
        options: optionChanges,
        protected: ["Society number", "starting level and wealth", "Chronicles", "credit ledger", "inventory", "backstory", "notes"],
      } : null,
    } };
  } catch (error) {
    if (error instanceof PathbuilderImportError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t preview that file. Check your session and try again." };
  }
}

export async function applyPathmuncherImportAction(characterId: string, approval: { sourceJson: string; digest: string; characterUpdatedAt: string | null; selectionRevision: string }, confirmedRemovalIds: string[]) {
  try {
    const actor = await requireAuthenticatedActor();
    const refreshed = await previewPathmuncherImportAction(approval.sourceJson, characterId);
    if (!refreshed.ok) return refreshed;
    if (refreshed.preview.approval.digest !== approval.digest) return { ok: false as const, error: "The catalog or import payload changed. Review a fresh preview before applying." };
    const proposed = refreshed.preview.proposed;
    const options = z.array(characterOptionSelectionInputSchema).max(100).safeParse(proposed.options);
    const character = await getCharacterDetail(actor, characterId);
    if (!character?.isOwner) return { ok: false as const, error: "You do not have permission to import into this character." };
    const details = updateCharacterInputSchema.safeParse({
      name: proposed.name, className: proposed.className, ancestry: proposed.ancestry, background: proposed.background,
      classValidationNote: character.classValidationNote, ancestryValidationNote: character.ancestryValidationNote,
      ancestrySourceChronicleId: character.ancestrySourceChronicleId, backgroundValidationNote: character.backgroundValidationNote,
      backgroundSourceChronicleId: character.backgroundSourceChronicleId, backstory: character.backstory, notes: character.notes,
    });
    if (!options.success || !details.success) return { ok: false as const, error: "The reviewed import contains values that can’t be saved." };
    const database = getDb();
    const outcome = await database.transaction(async (tx) => {
      const [owned] = await tx.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
      if (!owned) return "unauthorized" as const;
      if (owned.importDigest === approval.digest) return "ok" as const;
      const existing = await tx.select().from(characterOptionSelections).where(eq(characterOptionSelections.characterId, characterId));
      if (owned.updatedAt.toISOString() !== approval.characterUpdatedAt || selectionRevision(existing) !== approval.selectionRevision) return "stale" as const;
      const removals = refreshed.preview.changes?.options.filter((change) => change.change === "removal") ?? [];
      const removable = existing.filter((row) => removals.some((change) => change.name === row.nameSnapshot && change.kind === row.selectionKind));
      if (removable.some(({ id }) => !confirmedRemovalIds.includes(id))) return "confirmation" as const;
      const byKey = new Map(existing.map((row) => [`${row.selectionKind}:${normalizeOptionName(row.nameSnapshot)}`, row]));
      const incomingKeys = new Set(options.data.map((option) => `${option.selectionKind}:${normalizeOptionName(option.name)}`));
      const deleteIds = removable.filter((row) => !incomingKeys.has(`${row.selectionKind}:${normalizeOptionName(row.nameSnapshot)}`)).map(({ id }) => id);
      if (deleteIds.length) await tx.delete(characterOptionSelections).where(inArray(characterOptionSelections.id, deleteIds));
      for (const [index, option] of options.data.entries()) {
        const key = `${option.selectionKind}:${normalizeOptionName(option.name)}`;
        if (byKey.has(key)) continue;
        const catalog = option.characterOptionId ? (await tx.select().from(characterOptions).where(eq(characterOptions.id, option.characterOptionId)).limit(1))[0] : null;
        await tx.insert(characterOptionSelections).values({ id: randomUUID(), characterId, selectionKind: option.selectionKind, featCategory: option.selectionKind === "feat" ? option.featCategory : null, acquiredLevel: option.acquiredLevel, acquisitionMethod: option.acquisitionMethod, grantOrigin: option.grantOrigin, characterOptionId: catalog?.id ?? null, nameSnapshot: catalog?.name ?? option.name, sourceMaterialIdentitySnapshot: catalog?.sourceMaterialIdentity ?? option.sourceMaterialIdentity, sourceMaterialTitleSnapshot: catalog?.sourceMaterialTitle ?? option.sourceMaterialTitle, sourceUrlSnapshot: catalog?.sourceUrl ?? option.sourceUrl, validationNote: option.validationNote, sourceChronicleId: option.sourceChronicleId, importSource: IMPORT_SOURCE, importKey: `${index}:${key}` });
      }
      const now = new Date();
      await tx.update(characters).set({ name: details.data.name, className: details.data.className, ancestry: details.data.ancestry, background: details.data.background, importAdapterVersion: 1, importedAt: now, importDigest: approval.digest, updatedAt: now }).where(eq(characters.id, characterId));
      return "ok" as const;
    });
    if (outcome === "unauthorized") return { ok: false as const, error: "You do not have permission to update this character." };
    if (outcome === "stale") return { ok: false as const, error: "This preview is stale because the character changed. Review the import again." };
    if (outcome === "confirmation") return { ok: false as const, error: "Confirm every removal shown in the preview before applying." };
    revalidatePath(`/characters/${characterId}`);
    return { ok: true as const };
  } catch { return { ok: false as const, error: "We couldn’t apply that import. Please try again." }; }
}
