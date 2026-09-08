"use server";

import { requireAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { getIdentityValidationContext } from "@/character/identity-validation-context";
import { listOwnedCharacterOptionSelections } from "@/character/option-selections";
import { validateCharacterOptionSelection } from "@/character/option-selection-validation";
import { parsePathbuilderImportV1, PathbuilderImportError } from "@/import/pathbuilder-v1";
import { resolvePathbuilderImportV1 } from "@/import/pathbuilder-resolution-v1";
import { validateIdentitySelection } from "@/character/identity-validation";

export type PathmuncherPreviewState =
  | { ok: false; error: string }
  | { ok: true; preview: Awaited<ReturnType<typeof previewPathmuncherImportAction>> extends { ok: true; preview: infer P } ? P : never };

export async function previewPathmuncherImportAction(json: string, characterId?: string) {
  try {
    const actor = await requireAuthenticatedActor();
    const [context, character, existingOptions] = await Promise.all([
      getIdentityValidationContext(actor),
      characterId ? getCharacterDetail(actor, characterId) : null,
      characterId ? listOwnedCharacterOptionSelections(actor, characterId) : Promise.resolve([]),
    ]);
    if (characterId && (!character || !character.isOwner || existingOptions === null)) return { ok: false as const, error: "You do not have permission to import into this character." };
    const review = resolvePathbuilderImportV1(parsePathbuilderImportV1(json), context.options);
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
      ...review.feats.map((feat, index) => ({
        key: `import-feat-${index}`, selectionKind: "feat" as const, name: value(feat.match), acquiredLevel: Math.max(1, feat.raw.acquiredLevel),
        featCategory: feat.featCategory, acquisitionMethod: feat.acquisitionMethod,
        grantOrigin: feat.likelyOrigins.map(({ name }) => name).join(", "), characterOptionId: feat.match.option?.id ?? null,
        sourceMaterialIdentity: feat.match.option?.sourceMaterialIdentity ?? null, sourceMaterialTitle: feat.match.option?.sourceMaterialTitle ?? null,
        sourceUrl: feat.match.option?.sourceUrl ?? null,
      })),
    ];
    const identityValidation = {
      ancestry: validateIdentitySelection("ancestry", ancestry, context),
      background: validateIdentitySelection("background", background, context),
    };
    const optionValidation = options.map((option) => validateCharacterOptionSelection({
      id: option.key, characterId: characterId ?? "preview", selectionKind: option.selectionKind, nameSnapshot: option.name,
      acquiredLevel: option.acquiredLevel, featCategory: option.featCategory, acquisitionMethod: option.acquisitionMethod,
      grantOrigin: option.grantOrigin || null, characterOptionId: option.characterOptionId, sourceMaterialIdentitySnapshot: option.sourceMaterialIdentity,
      sourceMaterialTitleSnapshot: option.sourceMaterialTitle, sourceUrlSnapshot: option.sourceUrl, validationNote: null,
      sourceChronicleId: null, createdAt: new Date(0), updatedAt: new Date(0),
    }, { className, ancestry }, context));
    const oldOptions = existingOptions ?? [];
    const normalized = (text: string) => text.trim().toLocaleLowerCase("en-US");
    const importedKeys = new Set(options.map((option) => `${option.selectionKind}:${normalized(option.name)}`));
    const oldKeys = new Set(oldOptions.map((option) => `${option.selectionKind}:${normalized(option.nameSnapshot)}`));
    const optionChanges: Array<{ name: string; kind: "heritage" | "feat"; change: "unchanged" | "addition" | "removal" }> = options.map((option) => ({ name: option.name, kind: option.selectionKind, change: oldKeys.has(`${option.selectionKind}:${normalized(option.name)}`) ? "unchanged" : "addition" }));
    optionChanges.push(...oldOptions.filter((option) => !importedKeys.has(`${option.selectionKind}:${normalized(option.nameSnapshot)}`)).map((option) => ({ name: option.nameSnapshot, kind: option.selectionKind as "heritage" | "feat", change: "removal" as const })));
    return { ok: true as const, preview: {
      review, proposed: { name: review.character.name, className, ancestry, background, options }, identityValidation, optionValidation,
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
