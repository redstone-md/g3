# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub Security Advisories:
<https://github.com/redstone-md/ribbon/security/advisories/new>

Include a description, reproduction steps, affected version/commit, and impact. We aim to
acknowledge reports within a few days.

## Scope notes for self-hosters

Ribbon is a boilerplate — review these before deploying:

- **Secrets:** never commit `.env`. Use a real secret manager in production.
- **Rate limiting** is in-memory (single instance). For multi-instance/serverless, back it with
  Redis/Upstash before relying on it.
- **Sessions** are opaque, hashed-at-rest tokens in httpOnly cookies; set `secure` cookies behind
  HTTPS (handled automatically in production).
- **OAuth provider:** issued tokens are opaque and hashed at rest. Rotate client secrets if leaked
  (delete + recreate the client).
- Keep dependencies updated and run `npm audit` periodically.
