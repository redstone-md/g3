import { create } from "zustand";
import type { UserDTO } from "@/lib/types";

/** UI-only state for the user create/edit sheet. Consume with selectors. */
interface UserDialogState {
  open: boolean;
  user: UserDTO | null; // null => create mode
  openCreate: () => void;
  openEdit: (user: UserDTO) => void;
  close: () => void;
}

export const useUserDialogStore = create<UserDialogState>((set) => ({
  open: false,
  user: null,
  openCreate: () => set({ open: true, user: null }),
  openEdit: (user) => set({ open: true, user }),
  close: () => set({ open: false, user: null }),
}));
