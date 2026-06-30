import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Fixed table row height — shared by skeletons and data rows so swaps never shift. */
export const ROW_H = "h-14";
/** Same height in px (h-14 = 3.5rem) for computing spacer rows. */
export const ROW_PX = 56;
/** Rows per page — the table reserves this many row-heights so it never resizes. */
export const PAGE_SIZE = 8;

/**
 * Pads a table body so it always occupies a full page of rows — keeps the card
 * height constant whether 1 or PAGE_SIZE rows are loaded (no shift after load).
 * `count` = rows currently rendered (use 1 for an empty-state message row).
 */
export function SpacerRow({
  colSpan,
  count,
}: {
  colSpan: number;
  count: number;
}) {
  const height = Math.max(0, PAGE_SIZE - count) * ROW_PX;
  if (height <= 0) return null;
  return (
    <TableRow aria-hidden className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0" style={{ height }} />
    </TableRow>
  );
}

/** Header block matching PageHeader's title/description/action layout exactly. */
function HeaderSkeleton() {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

/** Loading placeholder for the table pages (roles/users/oauth). Mirrors the
 *  search bar, bordered table card, fixed-height rows, and pagination footer. */
export function TablePageSkeleton({
  rows = PAGE_SIZE,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      <HeaderSkeleton />
      <div className="mb-4">
        <Skeleton className="h-9 w-full max-w-xs" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRow key={i} className={ROW_H}>
                <TableCell colSpan={columns}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
    </>
  );
}

/** Loading placeholder for the card-grid Style Guide page. */
export function CardsPageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <>
      <HeaderSkeleton />
      <div className="grid gap-6">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="space-y-4 rounded-xl border border-border/60 bg-card p-6"
          >
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    </>
  );
}
