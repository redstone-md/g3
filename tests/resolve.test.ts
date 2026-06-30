import { describe, expect, it } from "vitest";
import { getAvatar, isValidAvatar } from "@/lib/avatars";
import { DEFAULT_LOCALE, resolveLocale } from "@/lib/locales";
import { DEFAULT_THEME, resolveTheme } from "@/lib/themes";

describe("resolvers fall back safely", () => {
  it("resolveLocale", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale("zz")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("resolveTheme", () => {
    expect(resolveTheme("supabase")).toBe("supabase");
    expect(resolveTheme("not-a-theme")).toBe(DEFAULT_THEME);
  });

  it("avatars", () => {
    expect(isValidAvatar("a1")).toBe(true);
    expect(isValidAvatar("zzz")).toBe(false);
    expect(isValidAvatar(null)).toBe(false);
    expect(getAvatar("a1")?.key).toBe("a1");
  });
});
