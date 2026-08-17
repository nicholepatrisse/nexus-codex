import { describe, expect, it } from "vitest";
import { prepareContentItem } from "@/catalog/content-item";
import { normalizeContentCode, normalizeContentTitle } from "@/catalog/normalization";

describe("catalog normalization", () => {
  it("normalizes spacing, case, number signs, and Unicode dashes in codes", () => {
    expect(normalizeContentCode("  #1 – 01 ")).toBe("1-01");
    expect(normalizeContentCode("1-01")).toBe("1-01");
  });

  it("normalizes titles for case-insensitive lookup", () => {
    expect(normalizeContentTitle("  Mystery   of the Frozen Moon ")).toBe(
      "mystery of the frozen moon",
    );
  });

  it("prepares canonical and normalized values together", () => {
    expect(
      prepareContentItem({
        id: "content-1",
        programId: "sfs2",
        code: " 1–01 ",
        title: " Invasion’s   Edge ",
        contentType: "scenario",
        minimumLevel: 1,
        maximumLevel: 2,
      }),
    ).toMatchObject({
      code: "1–01",
      normalizedCode: "1-01",
      title: "Invasion’s Edge",
      normalizedTitle: "invasion’s edge",
    });
  });
});
