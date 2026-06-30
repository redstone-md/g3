/** Client-safe DTOs returned by the API route handlers. */

export interface RoleDTO {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  parentIds: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  current: boolean;
}

export interface AuditLogDTO {
  id: string;
  action: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
}

/** A linked Google Drive storage account. */
export interface AccountDTO {
  id: string;
  email: string;
  status: string;
  weight: number;
  storageLimit: number;
  storageUsage: number;
  createdAt: string;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
  avatar: string | null;
  createdAt: string;
  roles: { id: string; name: string }[];
}
