"use client";

import { createContext, useContext } from "react";

/** The signed-in user, as returned by `GET /api/me`. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  theme: string;
  motion: string;
  locale: string;
  notificationsEnabled: boolean;
  mustChangePassword: boolean;
  /** Effective permission keys (union across inherited roles). */
  permissions: string[];
  roles: { id: string; name: string }[];
  /** True if this account is the only remaining administrator. */
  isLastAdmin: boolean;
}

const AuthContext = createContext<AuthUser | null>(null);

/** Provides the loaded user to the dashboard subtree (set by the AppShell). */
export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

/** Read the signed-in user. Throws if used outside the authenticated shell. */
export function useAuth(): AuthUser {
  const user = useContext(AuthContext);
  if (!user) {
    throw new Error("useAuth must be used within an authenticated AppShell");
  }
  return user;
}

/** Convenience permission check against the signed-in user. */
export function useHasPermission(): (permission: string) => boolean {
  const user = useAuth();
  return (permission: string) => user.permissions.includes(permission);
}
