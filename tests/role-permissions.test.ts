import { describe, expect, it } from "vitest";
import {
  ancestorIds,
  effectivePermissions,
  toRoleMap,
} from "@/lib/role-permissions";

const map = toRoleMap([
  { id: "support", permissions: ["tickets.read"], parentIds: [] },
  { id: "mod", permissions: ["tickets.close"], parentIds: ["support"] },
  { id: "lead", permissions: ["users.read"], parentIds: ["mod"] },
]);

describe("role inheritance", () => {
  it("unions own + inherited permissions transitively", () => {
    expect(effectivePermissions(["mod"], map).sort()).toEqual([
      "tickets.close",
      "tickets.read",
    ]);
    expect(effectivePermissions(["lead"], map).sort()).toEqual([
      "tickets.close",
      "tickets.read",
      "users.read",
    ]);
  });

  it("unions across multiple starting roles", () => {
    const m = toRoleMap([
      { id: "a", permissions: ["x"], parentIds: [] },
      { id: "b", permissions: ["y"], parentIds: [] },
    ]);
    expect(effectivePermissions(["a", "b"], m).sort()).toEqual(["x", "y"]);
  });

  it("survives cycles", () => {
    const cyclic = toRoleMap([
      { id: "a", permissions: ["x"], parentIds: ["b"] },
      { id: "b", permissions: ["y"], parentIds: ["a"] },
    ]);
    expect(effectivePermissions(["a"], cyclic).sort()).toEqual(["x", "y"]);
  });

  it("ancestorIds reflects reachability (cycle detection)", () => {
    expect(ancestorIds(["mod"], map).has("support")).toBe(true);
    expect(ancestorIds(["support"], map).has("mod")).toBe(false);
  });

  it("ignores unknown role ids", () => {
    expect(effectivePermissions(["ghost"], map)).toEqual([]);
  });
});
