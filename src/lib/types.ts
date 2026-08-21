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

/** An S3 bucket. */
export interface BucketDTO {
  id: string;
  name: string;
  createdAt: string;
  objectCount: number;
}

/** An S3 access key (the secret is shown only once, on creation). */
export interface AccessKeyDTO {
  id: string;
  accessKeyId: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Returned once when a key is created. */
export interface CreatedKeyDTO {
  id: string;
  accessKeyId: string;
  secretAccessKey: string;
  label: string;
}

/** A linked Google Drive storage account. */
export interface AccountDTO {
  id: string;
  email: string;
  status: string;
  weight: number;
  storageLimit: number;
  /** Bytes used across the whole Google account, G3's share included. */
  storageUsage: number;
  /** Bytes G3 itself stores on this account. */
  g3Usage: number;
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
