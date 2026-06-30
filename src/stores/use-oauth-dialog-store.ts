import { create } from "zustand";
import type { OAuthClientDTO } from "@/lib/types";

/** UI state for the OAuth client editor sheet + the one-time credentials dialog. */
interface OAuthDialogState {
  open: boolean;
  client: OAuthClientDTO | null; // null => create mode
  // Shown once after creation.
  credentials: { clientId: string; clientSecret: string | null } | null;
  openCreate: () => void;
  openEdit: (client: OAuthClientDTO) => void;
  close: () => void;
  showCredentials: (creds: {
    clientId: string;
    clientSecret: string | null;
  }) => void;
  clearCredentials: () => void;
}

export const useOAuthDialogStore = create<OAuthDialogState>((set) => ({
  open: false,
  client: null,
  credentials: null,
  openCreate: () => set({ open: true, client: null }),
  openEdit: (client) => set({ open: true, client }),
  close: () => set({ open: false, client: null }),
  showCredentials: (credentials) => set({ credentials }),
  clearCredentials: () => set({ credentials: null }),
}));
