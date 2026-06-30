import { describe, expect, it } from "vitest";
import { parseListQuery } from "@/lib/list-query";

const opts = { sortFields: ["createdAt", "name"], defaultSort: "createdAt" };

describe("parseListQuery", () => {
  it("applies defaults", () => {
    const q = parseListQuery("https://x/api?", opts);
    expect(q).toMatchObject({
      q: "",
      page: 1,
      pageSize: 10,
      sort: "createdAt",
      order: "desc",
      skip: 0,
    });
  });

  it("clamps page and pageSize", () => {
    expect(parseListQuery("https://x/api?page=0&pageSize=999", opts).page).toBe(
      1,
    );
    expect(parseListQuery("https://x/api?pageSize=999", opts).pageSize).toBe(
      100,
    );
    expect(parseListQuery("https://x/api?pageSize=-5", opts).pageSize).toBe(1);
    // 0 / non-numeric fall back to the default page size.
    expect(parseListQuery("https://x/api?pageSize=0", opts).pageSize).toBe(10);
  });

  it("computes skip from page", () => {
    expect(parseListQuery("https://x/api?page=3&pageSize=10", opts).skip).toBe(
      20,
    );
  });

  it("whitelists sort and normalizes order", () => {
    expect(parseListQuery("https://x/api?sort=evil", opts).sort).toBe(
      "createdAt",
    );
    expect(
      parseListQuery("https://x/api?sort=name&order=asc", opts),
    ).toMatchObject({
      sort: "name",
      order: "asc",
    });
  });

  it("trims the query string", () => {
    expect(parseListQuery("https://x/api?q=%20hi%20", opts).q).toBe("hi");
  });
});
