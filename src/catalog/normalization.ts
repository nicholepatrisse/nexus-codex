const dashCharacters = /[\u2010-\u2015\u2212]/g;

export function normalizeContentCode(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(dashCharacters, "-")
    .replace(/^#/, "")
    .replace(/\s+/g, "");
}

export function normalizeContentTitle(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}
