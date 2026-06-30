# Ribbon — Dashboard Roadmap

Auth-gated admin dashboard. Dark theme, shadcn UI, GSAP animations, custom RBAC.

## Stack decisions (locked)

- **Next.js 16.2.7** (App Router). Breaking: `middleware.ts` → `proxy.ts` (Node runtime), `cookies()` is async.
- **DB**: MongoDB via Prisma 7 (`provider = "prisma-client"`, generated to `src/generated/prisma`).
  - Transactions need a replica set — seed avoids interactive transactions.
- **Auth**: custom, DB-backed sessions. `bcryptjs` password hashing, SHA-256-hashed session token in cookie.
- **RBAC**: fixed permission catalog (code) + custom `Role` rows storing granted permission keys. One role per user.
- **Admin seed**: first-run only (no users exist). Random password generated + printed to console once.
- **State**: TanStack Query = server state (users/roles CRUD). Zustand = UI state (sidebar, dialogs). Never mixed.
- **Animation**: GSAP via `@gsap/react` `useGSAP`. Only transform/opacity. Stagger for lists.

## Data model

- `User`: email, name, passwordHash, mustChangePassword, roleId → Role.
- `Role`: name (unique), description, permissions String[], isSystem.
- `Session`: tokenHash (unique), userId → User, expiresAt.

## Permission catalog (code, `src/lib/permissions.ts`)

Groups → keys: `users.{read,create,update,delete}`, `roles.{read,create,update,delete}`, `styleguide.view`.
Admin role = all keys + isSystem. Member role = `styleguide.view`.

## Routes

- `/login` — credentials form (server action + useActionState), GSAP entrance.
- `/dashboard` — Style Guide (primary content for now).
- `/dashboard/access/roles` — role CRUD + permission editor (admin).
- `/dashboard/access/users` — user CRUD + role assignment (admin).
- `proxy.ts` — optimistic cookie-presence redirect; secure checks live in DAL + route handlers.

## Security layers

1. `proxy.ts` optimistic redirect (cookie presence only).
2. `src/lib/dal.ts` `verifySession()` / `getCurrentUser()` (cached) — DB-backed, used in layouts/pages.
3. Route handlers `/api/roles`, `/api/users` re-check session + permission before every mutation.

## Build order (atomic commits)

1. Deps + roadmap.
2. Prisma schema + client generate.
3. Libs: db singleton, permissions catalog, session, dal, validators.
4. Seed (first-run admin + system roles).
5. shadcn components.
6. Auth: login page + server actions + proxy + root layout dark.
7. Dashboard shell: layout (auth guard), sidebar, header, providers, Zustand stores.
8. Style Guide page (GSAP).
9. Roles management (route handlers + TanStack hooks + UI).
10. Users management (route handlers + TanStack hooks + UI).
