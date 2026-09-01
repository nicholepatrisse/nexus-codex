/** Pure material-name helpers shared by server and browser code. */
export function normalizeMaterialIdentity(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Archives of Nethys appends page references to source labels; they are not part of a material's identity. */
export function materialTitleWithoutCitation(value: string) {
  return value.replace(/\s+(?:p(?:age)?|pg)\.?\s*\d+(?:\s*[-–]\s*\d+)?\s*$/i, "").trim();
}

export function isFreeAccessMaterial(title: string | null | undefined) {
  if (!title) return false;
  const normalized = materialTitleWithoutCitation(title);
  return /^(?:Starfinder\s+)?Player Core$/i.test(normalized) || /\bStarfinder Society\b.*\b(?:Player'?s?\s+)?Guide\b/i.test(normalized);
}
