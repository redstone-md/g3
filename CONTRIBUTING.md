# Contributing to G3

Thanks for your interest in improving G3! This document covers the essentials.

## Getting set up

See the [Quick start](./README.md#quick-start) in the README. You need Node 20+ and a
MongoDB replica set.

## Before you open a PR

Run the full local check — all must pass:

```bash
npm run lint        # Biome
npx tsc --noEmit    # types
npm test            # Vitest
npm run build       # production build
```

## Project conventions (non-negotiable)

These are enforced by review — read [`AGENTS.md`](./AGENTS.md) (§4.1, §4.2) first:

- **No hardcoded UI strings.** Every user-facing string goes through `next-intl`, and every new
  key is added to **both** `messages/en.json` and `messages/ru.json`.
- **Cache-aware skeletons.** Don't show a skeleton over cached data; don't add a route-level
  `loading.tsx` for client-fetched pages.
- **Server vs client state.** TanStack Query for server data, Zustand for UI state — never mixed.
- **Animations** via GSAP (`useGSAP`) and the page `template.tsx`; transform/opacity only.
- **Security at the data source.** Every mutation re-checks the session and permission in the
  route handler / server action — never trust the client.

## Commits & PRs

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …).
- Keep commits atomic and focused.
- Describe the "why" in the PR, link related issues, and include screenshots for UI changes.

## Adding a permission, role capability, or locale

- **Permission:** add the key to `src/lib/permissions.ts` and its labels to the `permissions`
  namespace in both message catalogs. Re-run `scripts/sync-admin-permissions.mjs` locally.
- **Locale:** add it to `LOCALES`/`LOCALE_LABELS` in `src/lib/locales.ts` and create
  `messages/<locale>.json` with the full key set.

By contributing, you agree your contributions are licensed under the project's
[Apache-2.0](./LICENSE) license.
