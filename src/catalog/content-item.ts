import { normalizeContentCode, normalizeContentTitle } from "@/catalog/normalization";

export const contentItemTypes = ["scenario", "special", "adventure"] as const;
export type ContentItemType = (typeof contentItemTypes)[number];

interface ContentItemInput {
  id: string;
  programId: string;
  code: string;
  title: string;
  contentType: ContentItemType;
  minimumLevel: number;
  maximumLevel: number;
}

export function prepareContentItem(input: ContentItemInput) {
  return {
    ...input,
    code: input.code.trim(),
    title: input.title.normalize("NFKC").trim().replace(/\s+/g, " "),
    normalizedCode: normalizeContentCode(input.code),
    normalizedTitle: normalizeContentTitle(input.title),
  };
}
