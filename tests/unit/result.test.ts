import { describe, expect, it } from "vitest";
import { failure, success } from "@/lib/result";

describe("Result", () => {
  it("represents success without an error branch", () => {
    expect(success("scheduled")).toEqual({ ok: true, value: "scheduled" });
  });

  it("represents failure without a value branch", () => {
    expect(failure("not-authorized")).toEqual({ error: "not-authorized", ok: false });
  });
});
