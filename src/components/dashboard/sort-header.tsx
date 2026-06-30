"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface SortHeaderProps {
  label: string;
  field: string;
  sort: string;
  order: "asc" | "desc";
  onSort: (field: string) => void;
}

export function SortHeader({
  label,
  field,
  sort,
  order,
  onSort,
}: SortHeaderProps) {
  const active = sort === field;
  const icon = !active
    ? UnfoldMoreIcon
    : order === "asc"
      ? ArrowUp01Icon
      : ArrowDown01Icon;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
    >
      {label}
      <HugeiconsIcon icon={icon} className="size-3.5 opacity-60" />
    </button>
  );
}
