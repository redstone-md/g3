# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub Security Advisories:
<https://github.com/redstone-md/g3/security/advisories/new>

Include a description, reproduction steps, affected version/commit, and impact. We aim to
acknowledge reports within a few days.

## Scope notes for self-hosters

- **Secrets:** never commit `.env`. Provide `G3_*` values via your platform's secret manager.
- **Encryption key:** `G3_ENCRYPTION_KEY` encrypts stored Google refresh tokens. If unset, a key is
  generated in the data dir — keep that directory private and backed up.
- **Sessions** are opaque, hashed-at-rest tokens in httpOnly cookies. Run the panel behind HTTPS and
  set `G3_DEV=false` so the session cookie is `Secure`.
- **S3 access keys:** secrets are shown once on creation and stored encrypted. Rotate (revoke +
  recreate) if leaked.
- Keep dependencies updated and run `npm audit` / `go vet` periodically.
