const LIMITS = {
  bytes: 1_000_000,
  depth: 20,
  nodes: 20_000,
  string: 10_000,
  objectKeys: 1_000,
  collection: 500,
} as const;

const SUPPORTED_BUILD_FIELDS = new Set([
  "name", "level", "class", "ancestry", "heritage", "background", "feats",
]);

export type PathbuilderFeatRelationship = {
  choiceRef: string;
  kind: "parentChoice" | "childChoice" | "standardChoice";
  parentChoiceRef: string | null;
};

export type PathbuilderImportFeat = {
  name: string;
  choice: string | null;
  exportedCategory: string;
  acquiredLevel: number;
  relationship: PathbuilderFeatRelationship | null;
  provenance: "probable-awarded" | null;
};

export type PathbuilderImportCandidateV1 = {
  adapterVersion: 1;
  source: "pathbuilder-pathmuncher";
  character: {
    name: string;
    level: number;
    className: string;
    ancestry: string;
    heritages: string[];
    background: string;
  };
  feats: PathbuilderImportFeat[];
  unsupportedFields: Array<{ path: string; valueType: string }>;
};

export class PathbuilderImportError extends Error {
  constructor(public readonly code: "malformed_json" | "too_large" | "too_deep" | "invalid_envelope" | "foundry_actor" | "invalid_build", message: string) {
    super(message);
    this.name = "PathbuilderImportError";
  }
}

function fail(code: PathbuilderImportError["code"], message: string): never {
  throw new PathbuilderImportError(code, message);
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validateJsonShape(root: unknown) {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    nodes++;
    if (nodes > LIMITS.nodes) fail("too_large", "The export contains too many values.");
    if (current.depth > LIMITS.depth) fail("too_deep", `The export exceeds the maximum depth of ${LIMITS.depth}.`);
    if (typeof current.value === "string" && current.value.length > LIMITS.string) fail("too_large", "The export contains an oversized string.");
    if (Array.isArray(current.value)) {
      if (current.value.length > LIMITS.collection) fail("too_large", "The export contains an oversized collection.");
      for (const value of current.value) pending.push({ value, depth: current.depth + 1 });
    } else if (current.value !== null && typeof current.value === "object") {
      const values = Object.values(current.value);
      if (values.length > LIMITS.objectKeys) fail("too_large", "The export contains an object with too many fields.");
      for (const value of values) pending.push({ value, depth: current.depth + 1 });
    }
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid_build", `${label} must be an object.`);
  return value as Record<string, unknown>;
}

function boundedString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) fail("invalid_build", `${label} must be a non-empty string of at most 200 characters.`);
  return value.trim();
}

function tupleString(value: unknown, label: string, nullable = false): string | null {
  if (nullable && (value === null || value === "")) return null;
  if (typeof value !== "string" || value.length > 500) fail("invalid_build", `${label} must be a string of at most 500 characters.`);
  return value;
}

function level(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 20) fail("invalid_build", `${label} must be an integer from 0 through 20.`);
  return value as number;
}

function looksLikeFoundryActor(value: Record<string, unknown>): boolean {
  return typeof value.type === "string" && value.system !== null && typeof value.system === "object" && Array.isArray(value.items);
}

function parseFeat(value: unknown, index: number): PathbuilderImportFeat {
  if (!Array.isArray(value) || (value.length !== 4 && value.length !== 7)) fail("invalid_build", `build.feats[${index}] must be a four- or seven-element tuple.`);
  const name = boundedString(value[0], `build.feats[${index}][0]`);
  const choice = tupleString(value[1], `build.feats[${index}][1]`, true);
  const exportedCategory = boundedString(value[2], `build.feats[${index}][2]`);
  const acquiredLevel = level(value[3], `build.feats[${index}][3]`);
  let relationship: PathbuilderFeatRelationship | null = null;
  if (value.length === 7) {
    const choiceRef = tupleString(value[4], `build.feats[${index}][4]`)!;
    const kind = value[5];
    if (kind !== "parentChoice" && kind !== "childChoice" && kind !== "standardChoice") fail("invalid_build", `build.feats[${index}][5] has an unsupported choice relationship.`);
    relationship = { choiceRef, kind, parentChoiceRef: tupleString(value[6], `build.feats[${index}][6]`, true) };
  }
  return { name, choice, exportedCategory, acquiredLevel, relationship, provenance: value.length === 4 || exportedCategory === "Awarded Feat" ? "probable-awarded" : null };
}

/** Parses untrusted Pathbuilder/Pathmuncher JSON without performing any I/O. */
export function parsePathbuilderImportV1(json: string): PathbuilderImportCandidateV1 {
  if (typeof json !== "string") fail("malformed_json", "The Pathbuilder export must be JSON text.");
  if (new TextEncoder().encode(json).byteLength > LIMITS.bytes) fail("too_large", `The export exceeds the ${LIMITS.bytes}-byte limit.`);
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { fail("malformed_json", "The file is not valid JSON."); }
  validateJsonShape(parsed);
  const envelope = object(parsed, "The export");
  if (looksLikeFoundryActor(envelope)) fail("foundry_actor", "Foundry actor JSON is not supported; export the character from Pathbuilder instead.");
  if (envelope.success !== true || !("build" in envelope)) fail("invalid_envelope", "Expected a successful Pathbuilder export with { success: true, build }.");
  const build = object(envelope.build, "build");
  if (looksLikeFoundryActor(build)) fail("foundry_actor", "Foundry actor JSON is not supported; export the character from Pathbuilder instead.");
  if (!Array.isArray(build.feats) || build.feats.length > LIMITS.collection) fail("invalid_build", `build.feats must be an array with at most ${LIMITS.collection} entries.`);
  const characterLevel = level(build.level, "build.level");
  if (characterLevel < 1) fail("invalid_build", "build.level must be an integer from 1 through 20.");

  return {
    adapterVersion: 1,
    source: "pathbuilder-pathmuncher",
    character: {
      name: boundedString(build.name, "build.name"),
      level: characterLevel,
      className: boundedString(build.class, "build.class"),
      ancestry: boundedString(build.ancestry, "build.ancestry"),
      heritages: [boundedString(build.heritage, "build.heritage")],
      background: boundedString(build.background, "build.background"),
    },
    feats: build.feats.map(parseFeat),
    unsupportedFields: Object.entries(build)
      .filter(([key]) => !SUPPORTED_BUILD_FIELDS.has(key))
      .map(([key, value]) => ({ path: `build.${key}`, valueType: valueType(value) })),
  };
}

export const PATHBUILDER_IMPORT_V1_LIMITS = LIMITS;
