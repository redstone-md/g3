import { create } from "zustand";
import type { RoleDTO } from "@/lib/types";

/** UI-only state for the role create/edit sheet. Consume with selectors. */
interface RoleDialogState {
  open: boolean;
  role: RoleDTO | null; // null => create mode
  openCreate: () => void;
  openEdit: (role: RoleDTO) => void;
  close: () => void;
}

export const useRoleDialogStore = create<RoleDialogState>((set) => ({
  open: false,
  role: null,
  openCreate: () => set({ open: true, role: null }),
  openEdit: (role) => set({ open: true, role }),
  close: () => set({ open: false, role: null }),
}));
