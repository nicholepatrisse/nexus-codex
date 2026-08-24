import { describe, expect, it } from "vitest";
import { canPerformCommunityOperation, canPerformSessionOperation } from "@/authorization/policy";

describe("self-service GM authorization matrix", () => {
  it("does not turn GM authority into community administration", () => {
    expect(canPerformSessionOperation("gm", "session.create")).toBe(true);
    expect(canPerformSessionOperation("gm", "session.manage.assigned")).toBe(true);
    expect(canPerformSessionOperation("gm", "session.publish.assigned")).toBe(true);
    expect(canPerformSessionOperation("gm", "session.manage.any")).toBe(false);
    expect(canPerformSessionOperation("gm", "session.publish.any")).toBe(false);
    expect(canPerformSessionOperation("gm", "session.staff.any")).toBe(false);
    expect(canPerformSessionOperation("gm", "session.capacity.override")).toBe(false);
    expect(canPerformCommunityOperation("gm", "membership.manage", { visibility: "private", scheduleVisibility: "members" })).toBe(false);
    expect(canPerformCommunityOperation("gm", "gm.manage", { visibility: "private", scheduleVisibility: "members" })).toBe(false);
    expect(canPerformCommunityOperation("gm", "community.policy.manage", { visibility: "private", scheduleVisibility: "members" })).toBe(false);
  });

  it("does not authorize an ordinary member to create a standalone game", () => {
    expect(canPerformSessionOperation("member", "session.create")).toBe(false);
  });
});
