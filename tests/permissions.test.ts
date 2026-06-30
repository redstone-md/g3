import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  isPermissionKey,
  sanitizePermissions,
} from "@/lib/permissions";

describe("permissions catalog", () => {
  it("includes core keys", () => {
    expect(ALL_PERMISSIONS).toContain("users.read");
    expect(ALL_PERMISSIONS).toContain("roles.update");
    expect(ALL_PERMISSIONS).toContain("oauth.read");
    expect(ALL_PERMISSIONS).toContain("audit.read");
  });

  it("recognizes valid keys only", () => {
    expect(isPermissionKey("users.read")).toBe(true);
    expect(isPermissionKey("users.fly")).toBe(false);
  });

  it("sanitize drops unknown keys and dedups", () => {
    const out = sanitizePermissions([
      "users.read",
      "users.read",
      "nope",
      "audit.read",
    ]);
    expect(out.sort()).toEqual(["audit.read", "users.read"]);
  });

  it("sanitize returns empty for all-invalid input", () => {
    expect(sanitizePermissions(["x", "y"])).toEqual([]);
  });
});
