/** Parse + validate list query params (pagination, search, sort) for route handlers. */

export interface ListQuery {
  q: string;
  page: number;
  pageSize: number;
  sort: string;
  order: "asc" | "desc";
  skip: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function parseListQuery(
  url: string,
  opts: { sortFields: string[]; defaultSort: string },
): ListQuery {
  const sp = new URL(url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 10));
  const requestedSort = sp.get("sort") ?? "";
  const sort = opts.sortFields.includes(requestedSort)
    ? requestedSort
    : opts.defaultSort;
  const order = sp.get("order") === "asc" ? "asc" : "desc";
  return {
    q: (sp.get("q") ?? "").trim(),
    page,
    pageSize,
    sort,
    order,
    skip: (page - 1) * pageSize,
  };
}
