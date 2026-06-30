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

export interface OAuthClientDTO {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  scopes: string[];
  isPublic: boolean;
  createdAt: string;
}

/** Returned only on creation — includes the one-time plaintext secret. */
export interface OAuthClientCreatedDTO extends OAuthClientDTO {
  clientSecret: string | null;
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
