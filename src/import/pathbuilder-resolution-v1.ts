import type { IdentityValidationOption } from "@/character/identity-validation";
import type { PathbuilderImportCandidateV1, PathbuilderImportFeat } from "@/import/pathbuilder-v1";
import { FEAT_CATEGORIES, OPTION_NAME_ALIASES, type FeatCategory, type OptionType } from "@/nethys/options";

type ResolvableType = Exclude<OptionType, "item">;
export type ImportMatchStatus = "exact" | "aliased" | "ambiguous" | "unknown" | "unsupported";
export type ImportMatch = {
  rawValue: string;
  optionType: ResolvableType;
  status: ImportMatchStatus;
  option: IdentityValidationOption | null;
  candidates: IdentityValidationOption[];
};
export type ImportOriginHint = {
  optionType: "class" | "ancestry" | "background" | "heritage";
  name: string;
  confidence: "review";
  reason: string;
};
export type ResolvedPathbuilderFeat = {
  raw: PathbuilderImportFeat;
  match: ImportMatch;
  featCategory: FeatCategory | null;
  categoryStatus: "catalog" | "exported" | "unknown" | "unsupported";
  acquisitionMethod: "selected" | "awarded";
  likelyOrigins: ImportOriginHint[];
};
export type PathbuilderImportReviewV1 = {
  reviewVersion: 1;
  source: PathbuilderImportCandidateV1["source"];
  character: {
    name: string;
    currentLevel: number;
    class: ImportMatch;
    ancestry: ImportMatch;
    background: ImportMatch;
    heritages: ImportMatch[];
  };
  feats: ResolvedPathbuilderFeat[];
  unresolvedValues: Array<{ path: string; value: string; status: "ambiguous" | "unknown" }>;
  unsupportedValues: Array<{ path: string; value: string }>;
  unsupportedFields: PathbuilderImportCandidateV1["unsupportedFields"];
};

const baseNormalize = (value: string) => value.normalize("NFKC").replace(/[’]/g, "'").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
const metadataAliases = (option: IdentityValidationOption) => Array.isArray(option.metadata.aliases)
  ? option.metadata.aliases.filter((value): value is string => typeof value === "string") : [];

function matchOption(rawValue: string, optionType: ResolvableType, catalog: readonly IdentityValidationOption[]): ImportMatch {
  const raw = baseNormalize(rawValue);
  const canonicalAliases = OPTION_NAME_ALIASES[raw]?.map(baseNormalize) ?? [];
  const typed = catalog.filter((option) => option.optionType === optionType);
  const exact = typed.filter((option) => baseNormalize(option.name) === raw);
  const aliased = exact.length ? [] : typed.filter((option) => canonicalAliases.includes(baseNormalize(option.name)) || metadataAliases(option).some((alias) => baseNormalize(alias) === raw));
  const matches = exact.length ? exact : aliased;
  if (!matches.length) return { rawValue, optionType, status: "unknown", option: null, candidates: [] };
  if (matches.length > 1) return { rawValue, optionType, status: "ambiguous", option: null, candidates: matches };
  return { rawValue, optionType, status: exact.length ? "exact" : "aliased", option: matches[0]!, candidates: matches };
}

function exportedFeatCategory(value: string): FeatCategory | null | "unsupported" {
  const normalized = baseNormalize(value).replace(/ feat$/, "");
  if (normalized === "awarded") return null;
  return FEAT_CATEGORIES.includes(normalized as FeatCategory) ? normalized as FeatCategory : "unsupported";
}

function grantNames(option: IdentityValidationOption): string[] {
  const values = [option.metadata.grantedFeats, option.metadata.awardedFeats, option.metadata.feats];
  return values.flatMap((value) => Array.isArray(value) ? value : []).filter((value): value is string => typeof value === "string");
}

function originHints(feat: PathbuilderImportFeat, context: ImportMatch[]): ImportOriginHint[] {
  const name = baseNormalize(feat.name);
  return context.flatMap((match) => {
    const option = match.option;
    if (!option || option.optionType === "feat" || !grantNames(option).some((grant) => baseNormalize(grant) === name)) return [];
    return [{ optionType: option.optionType, name: option.name, confidence: "review", reason: `${option.name}'s catalog metadata lists ${feat.name}; confirm the exported award before saving.` }];
  });
}

/** Resolves an import candidate in memory. Source ownership and Society legality remain validation concerns. */
export function resolvePathbuilderImportV1(candidate: PathbuilderImportCandidateV1, catalog: readonly IdentityValidationOption[]): PathbuilderImportReviewV1 {
  const classMatch = matchOption(candidate.character.className, "class", catalog);
  const ancestry = matchOption(candidate.character.ancestry, "ancestry", catalog);
  const background = matchOption(candidate.character.background, "background", catalog);
  const heritages = candidate.character.heritages.map((value) => matchOption(value, "heritage", catalog));
  const originContext = [classMatch, ancestry, background, ...heritages];
  const unsupportedValues: PathbuilderImportReviewV1["unsupportedValues"] = [];
  const feats = candidate.feats.map((raw, index): ResolvedPathbuilderFeat => {
    const match = matchOption(raw.name, "feat", catalog);
    const catalogCategory = match.option?.metadata.featCategory;
    const catalogFeatCategory = FEAT_CATEGORIES.includes(catalogCategory as FeatCategory) ? catalogCategory as FeatCategory : null;
    const exported = exportedFeatCategory(raw.exportedCategory);
    if (exported === "unsupported") unsupportedValues.push({ path: `build.feats[${index}][2]`, value: raw.exportedCategory });
    return {
      raw,
      match,
      featCategory: catalogFeatCategory ?? (exported === "unsupported" ? null : exported),
      categoryStatus: catalogFeatCategory ? "catalog" : exported === "unsupported" ? "unsupported" : exported ? "exported" : "unknown",
      acquisitionMethod: baseNormalize(raw.exportedCategory) === "awarded feat" ? "awarded" : "selected",
      likelyOrigins: originHints(raw, originContext),
    };
  });
  const matches = [classMatch, ancestry, background, ...heritages, ...feats.map((feat) => feat.match)];
  return {
    reviewVersion: 1,
    source: candidate.source,
    character: { name: candidate.character.name, currentLevel: candidate.character.level, class: classMatch, ancestry, background, heritages },
    feats,
    unresolvedValues: matches.flatMap((match) => match.status === "ambiguous" || match.status === "unknown" ? [{ path: match.optionType, value: match.rawValue, status: match.status }] : []),
    unsupportedValues,
    unsupportedFields: candidate.unsupportedFields.map((field) => ({ ...field })),
  };
}
