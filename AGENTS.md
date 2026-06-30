<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The Pragmatic Architect Specification

## 1. Core Persona and Operational Philosophy

<core_principles>
* **OOP & Encapsulation:** Utilize strict Object-Oriented Programming practices and encapsulation WHEREVER appropriate. Isolate data states and expose only the strictly necessary interfaces. Protect internal module states from global mutation.
* **DRY (Don't Repeat Yourself):** Abstract repetitive logic into unified, authoritative modules, hooks, or utility classes.
* **Orthogonality:** Keep components fundamentally independent. Changes in one domain must not cause cascading side effects in another.
* **Tracer Bullets:** Build small, end-to-end functional increments to prove an architectural concept before bulk-generating features.
* **Eradicate AI Slop:** Never output massive, tangled code dumps. Never recreate components that already exist in the repository. Stop and think before you generate. ALWAYS output your reasoning steps inside a `<thinking>` XML block before outputting executable code.
</core_principles>

## 2. Architectural Guardrails and File Constraints
*(Add specific file size limits, line counts, or directory structures here if needed)*

## 3. Frontend State Management Architecture

<state_management>
You must strictly and flawlessly separate server state from client state. NEVER conflate the two.

**Server State (TanStack Query):**
* Use TanStack Query (formerly React Query) for ALL asynchronous data fetching, caching, API synchronization, background updates, and server mutations.
* NEVER use `useEffect` combined with `useState` for data fetching or loading indicators. This is an anti-pattern.
* Encapsulate all queries and mutations within custom hooks (e.g., `useUserProfileQuery()`). Components must only consume the `data`, `isLoading`, and `error` objects.

**Client State (Zustand):**
* Use Zustand for ALL synchronous, ephemeral, and UI-driven global state (e.g., modal visibility, theme switching, multi-step form progression).
* Keep Zustand stores highly granular and modular. Do not create a single monolithic store.
* **Critical:** Always use selectors to extract state from Zustand stores to prevent unnecessary component re-renders (e.g., `const isOpen = useModalStore((state) => state.isOpen)`).
</state_management>

## 4. Animation and Performance Protocol (transitions.dev)

<animation_protocol>
Animations use **transitions.dev** — portable CSS transitions namespaced under `t-*` with semantic custom properties. CSS-first (no JS motion library). Browser performance and 60fps fluidity are non-negotiable.

* **Single source of tokens:** All durations/eases/distances live in the `:root` block in `src/app/transitions.css`. Snippets read those semantic names (`--modal-*`, `--dropdown-*`, `--panel-*`, `--shake-*`, …); never hardcode timings inline.
* **Use the catalog:** Reach for the matching transition — modal, menu-dropdown, panel-reveal, page-enter, icon-swap, text-swap, number-pop-in, success-check, error-state-shake, etc. Don't invent ad-hoc keyframes when one fits.
* **Prevent Layout Thrashing:** Only animate composite properties (`transform`, `opacity`, `filter`). NEVER animate layout properties (`width`, `height`, `top/left`, `margin`, `padding`).
* **Hardware Acceleration:** Apply `will-change: transform` to elements under heavy/continuous animation. Not global.
* **Reduced motion:** Every animation MUST keep its `@media (prefers-reduced-motion: reduce)` guard.
* **Radix/shadcn:** Components driven by Radix (`data-state`) animate via keyframes (so Radix Presence's `animationend` fires before unmount) — retuned to the transitions.dev easing/scale tokens, not the snippet's `.is-closing` JS orchestration.
* **Replay pattern:** To replay an animation (shake, pop-in), remove the class → force reflow (`void el.offsetWidth`) → re-add. Use the `useShake`-style hook, not raw GSAP.
* GSAP has been removed. Smooth scrolling still uses Lenis (§4.1) — that is scroll, not element animation.
</animation_protocol>

### 4.1 Mandatory UX Conventions (NON-NEGOTIABLE)

<ux_conventions>
These apply to every component and route. Do not ship UI that violates them.

* **Skeleton loaders for genuine loads:** A real loading state (no data yet) MUST render a skeleton placeholder (shadcn `Skeleton`), never a spinner or blank screen. The skeleton must mirror the final layout's shape.
* **Skeletons are cache-aware:** Only show a skeleton when there is genuinely no data. For client-fetched data, drive it off the query's `isLoading` (which is `false` when TanStack Query serves from cache) — never show a skeleton over cached content. Do NOT add a route-level `loading.tsx` for client-fetched pages: the server Suspense fallback can't see the client cache and flashes a skeleton on every navigation, defeating the cache. Reserve `loading.tsx` for pages whose data is fetched on the server.
* **Skeletons mirror final layout:** Match the loaded content's shape AND dimensions (row heights, column count, header, search bar, pagination). Give table rows a fixed height and reserve a full page of rows so skeleton↔data swaps cause zero layout shift. A skeleton that resizes on load is a bug.
* **Animate the skeleton, not the content:** The entrance animation belongs on the first paint (the skeleton), provided by the page `template.tsx`. Loaded data must swap in place with NO entrance animation of its own, or the skeleton→data transition reads as a jarring double animation.
* **Page transitions ALWAYS:** Route changes MUST animate via the `.t-enter` CSS transition (transitions.dev tokens) in the relevant `template.tsx` (transform + opacity only). `template.tsx` (not `layout.tsx`) is the correct boundary because it re-mounts on navigation.
* **Smooth scrolling ALWAYS:** Smooth (inertia) scrolling is mandated globally via Lenis (`<ReactLenis root>`), mounted once at the app root. Use `allowNestedScroll` so Radix scroll areas and the sidebar keep working. Import `lenis/dist/lenis.css`.
</ux_conventions>

### 4.2 Internationalization (i18n) — NON-NEGOTIABLE

<i18n_rules>
The project uses **next-intl** (cookie-based, no URL routing; RU default + EN, synced to the account). Follow it strictly:

* **No hardcoded UI strings.** Every user-facing string goes through `useTranslations` (client) or `getTranslations` (server). Never inline literal copy in JSX.
* **Always update BOTH catalogs.** Any new key MUST be added to `messages/en.json` AND `messages/ru.json` in the same change. A key missing from one locale is a bug.
* **Namespaced keys** mirror the feature (e.g. `users.*`, `oauth.*`, `settings.*`, `common.*`). Reuse `common.*` for shared verbs (save/cancel/delete/…).
* **Use ICU** for plurals/interpolation (e.g. `{count, plural, ...}`, `{email}`) rather than string concatenation.
* **Adding a locale:** add it to `LOCALES` + `LOCALE_LABELS` in `src/lib/locales.ts`, create `messages/<locale>.json` with the full key set, and it appears in the Settings → Language switcher automatically. The locale persists to `User.locale` and a cookie.
* Locale is resolved in `src/i18n/request.ts` from the `ribbon_locale` cookie; DB is the cross-device source of truth.
</i18n_rules>

## 5. Deterministic Knowledge Retrieval (Context7)

<knowledge_retrieval>
As an AI, you are mathematically prone to hallucinating APIs and relying on outdated training data. To actively prevent this, you MUST use Context7 whenever the MCP (Model Context Protocol) is available in your environment.

* **Action Directive:** If Context7 MCP is active, and you are asked to implement a library, framework, or complex API, immediately call the Context7 tools (e.g., `resolve-library-id`, `get-library-docs`).
* **Syntax:** Use the specific library routing (e.g., `/library/supabase/` or `/library/nextjs/`) to pull exact, version-matched documentation and functional code snippets directly into your context window BEFORE writing a single line of code.
* **No Guessing:** If you are unsure of a method signature in a modern framework, do not guess. Query Context7.
</knowledge_retrieval>

## 6. Operational Workflows: Git, Commits, and Documentation

<operational_hygiene>
You are actively responsible for the health of the repository's working tree, version control history, and documentation structure.

* **Repository Initialization:** If a `.git` directory does not exist and version control is logically required for the project, execute `git init` automatically.
* **Atomic Commits:** Commit early and commit frequently. Each commit MUST be atomic, addressing a single, highly specific logical change. Use Conventional Commits formatting (e.g., `feat: build auth component`, `fix: resolve Zustand hydration error`). NEVER combine unrelated architectural changes into a massive "AI dump" commit.
* **Pristine Working Tree:** Keep the directory flawlessly clean. Add necessary exclusions to `.gitignore` immediately. Delete temporary debugging scripts or logs immediately after they serve their purpose.
* **Living Documentation:** Maintain project documentation as a first-class citizen. Before executing complex multi-step architectures, outline your plan in a `roadmap.md` file or update `instructions.md`. Ensure that your internal structural decisions are codified for future AI sessions and human developers.
* **Modular Rulesets:** If you are writing specific language rules (e.g., Python, TypeScript), defer to externalized documentation files like `docs/TYPESCRIPT.md` to keep this primary instruction file focused.
</operational_hygiene>

## 7. Execution Protocol

When receiving a prompt from the user, you MUST follow this exact execution sequence:

1. **Analyze:** Read the prompt and rigorously identify the core requirements.
2. **Contextualize:** Read relevant existing files to understand the project architecture. Call Context7 if framework docs are needed.
3. **Plan (Tracer Bullet):** Output a `<thinking>` block detailing your exact plan. You must explicitly state how you will uphold OOP, keep files strictly under 500 lines, properly separate Zustand/TanStack state, use transitions.dev animations safely, and avoid AI slop.
4. **Execute:** Write the requested code.
5. **Verify & Commit:** Review your own generated code against the constraints in this file. If it passes, execute the atomic git commit. If it fails, fix it before the user sees it.

<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
Run Context7 CLI requests outside Codex's default sandbox. If a Context7 CLI command fails with DNS or network errors such as ENOTFOUND, host resolution failures, or fetch failed, rerun it outside the sandbox instead of retrying inside the sandbox.
<!-- context7 -->

