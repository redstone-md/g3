# Ribbon

A production-grade **Next.js dashboard boilerplate** with batteries included: custom
authentication, role-based access control with inheritance, an OAuth2 provider **and**
SSO client, audit logging, internationalization, theming, and a polished UI.

> Built on Next.js 16 (App Router), React 19, Prisma + MongoDB, Tailwind v4 and shadcn/ui.

## Features

- **Authentication** — custom, DB-backed sessions (hashed-token cookie, bcrypt), brute-force
  rate limiting, forced first-login password change.
- **RBAC** — custom roles with a fixed permission catalog, **multiple roles per user**, and
  **role inheritance** (effective permissions = transitive union, cycle-safe). System roles are
  editable (permissions) but protected from rename/delete. Last-admin lockout protection.
- **OAuth2 provider** — Authorization Code + PKCE (`/oauth/authorize`, `/oauth/token`,
  `/oauth/userinfo`) with a consent screen and client management UI. Other apps can SSO through
  this one.
- **SSO client** — "Sign in with SSO" via a generic OAuth2 + PKCE client (env-configured).
- **Audit log** — security/admin events recorded and browsable (read-only).
- **Account self-service** — profile + preset avatar, change email, change password, export data,
  delete account, active-session management (revoke devices).
- **i18n** — `next-intl`, cookie-based (no URL routing), RU + EN, synced to the account.
- **Theming** — 13 themes (from [tweakcn](https://tweakcn.com)), synced to the account.
- **UX** — TanStack Query (cache-aware skeletons), Zustand, GSAP page transitions, Lenis smooth
  scrolling, command palette (⌘K), breadcrumbs, nav progress bar, toast + native notifications.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| Database | MongoDB via Prisma 6 |
| Styling | Tailwind CSS v4, shadcn/ui (radix-ui), Hugeicons |
| Server state | TanStack Query |
| Client state | Zustand |
| i18n | next-intl |
| Animation | GSAP (`@gsap/react`), Lenis |
| Tests | Vitest |

## Quick start

### Prerequisites

- Node.js 20+
- A MongoDB database **with a replica set** (e.g. MongoDB Atlas — required by Prisma for
  transactions). A standalone `mongod` will not work.

### Setup

```bash
git clone https://github.com/redstone-md/ribbon.git
cd ribbon
npm install

cp .env.example .env        # then edit DATABASE_URL (and optional SSO_* vars)

npm run db:setup            # push schema + seed the first admin (prints a random password)
npm run dev                 # http://localhost:3000
```

The seed runs **once** (only when no users exist) and prints the admin email + a random
password to the console. Sign in, and you'll be prompted to set a new password.

## Environment variables

See [`.env.example`](./.env.example). Summary:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | MongoDB connection string (replica set). |
| `ADMIN_EMAIL` | no | Email for the seeded admin (default `admin@ribbon.local`). |
| `SSO_ISSUER` | no | Base URL of the OAuth provider for "Sign in with SSO". |
| `SSO_CLIENT_ID` / `SSO_CLIENT_SECRET` | no | Credentials issued by the provider. |
| `SSO_REDIRECT_URI` | no | Must match a registered redirect URI. |
| `SSO_SCOPES` | no | Default `openid profile email`. |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `format` | Biome check / format |
| `npm test` / `test:watch` | Vitest unit tests |
| `npm run db:push` | Push the Prisma schema to MongoDB |
| `npm run db:seed` | First-run seed (admin + system roles) |
| `npm run db:setup` | `db:push` + `db:seed` |

## Project conventions

This repo follows strict UX/i18n conventions documented in [`AGENTS.md`](./AGENTS.md)
(skeleton loaders, page transitions, smooth scrolling, no hardcoded strings, etc.). Please
read it before contributing.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues: see [SECURITY.md](./SECURITY.md).

## License

[Apache-2.0](./LICENSE) © redstone-md
