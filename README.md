<div align="center">

# G3

**An S3-compatible object storage server whose disk is Google Drive.**

`G` = Google Drive · `3` = S3

Point any S3 client or legacy app at G3, and every object is stored across one or
more Google accounts' Drive — pooled, balanced, and encrypted at rest. Nothing
touches the local filesystem except a single SQLite metadata file. Ships as **one
binary**: the Go server embeds a polished web panel.

</div>

---

## Why

Plenty of old software can only export to **S3** — but you may not want to pay for
S3. G3 speaks the S3 API on the front and writes the bytes to the free 15 GB Drive
of each Google account you connect. Add several accounts and G3 spreads load and
storage across the pool.

## Features

- **S3-compatible API** — buckets, objects, multipart upload, `ListObjectsV2`,
  ranged `GetObject`, batch delete, and full **AWS Signature V4** (header *and*
  presigned-URL auth).
- **Google Drive as the backend** — link accounts via OAuth (offline refresh
  tokens, encrypted with AES-256-GCM). Object bytes live on Drive; only metadata
  is local.
- **Pooling & balancing** — `round-robin`, `least-used`, `fill-first`, or
  `hash(key)`. Respects Drive's 750 GB/day per-account upload cap.
- **Large files** — objects over 64 MiB are chunked across accounts and streamed
  on read (lazy, part-by-part).
- **Web panel** — dashboard with live storage stats, a **file manager** (browse,
  upload, download, delete, bucket policies), Drive accounts, buckets, access
  keys, users/roles (RBAC), audit log, themes, and i18n (EN/RU).
- **Single binary** — Next.js panel exported to static HTML and embedded in the Go
  server. SQLite for metadata. No external database.

## How it works

```
                ┌──────────────────────── g3 (one binary) ───────────────────────┐
   S3 client ──▶│  :9000  S3 API  ──┐                                             │
                │                   ├─▶ engine ─▶ balancer ─▶ Google Drive pool   │
   Browser   ──▶│  :8787  Panel  ───┘            │                  (accounts)    │
                │         + embedded static UI   └─▶ SQLite (metadata only)       │
                └─────────────────────────────────────────────────────────────────┘
```

## Quick start

### Docker

```bash
docker build -t g3 .
docker run -d --name g3 \
  -p 8787:8787 -p 9000:9000 \
  -v g3-data:/data \
  -e G3_ADMIN_EMAIL=you@example.com \
  -e G3_ADMIN_PASSWORD=change-me \
  -e G3_GOOGLE_CLIENT_ID=... \
  -e G3_GOOGLE_CLIENT_SECRET=... \
  -e G3_GOOGLE_REDIRECT_URI=https://your-domain/api/accounts/callback \
  g3
```

### Nixpacks / Dokploy

The repo ships a `nixpacks.toml`, so a Nixpacks-based platform (e.g. Dokploy)
builds the single binary directly. Set the env vars above, mount a volume at the
data dir, and expose **8787** (panel) and **9000** (S3).

### Local

```bash
bash build.sh   # next export -> embed -> go build -> ./g3.exe
./g3.exe        # panel http://localhost:8787 , S3 http://localhost:9000
```

First run seeds an admin from `G3_ADMIN_EMAIL` / `G3_ADMIN_PASSWORD` (you'll be
asked to change the password on first login).

## Configuration

All settings are environment variables (an optional `.env` is read too — see
`.env.example`).

| Variable | Default | Description |
| --- | --- | --- |
| `G3_ADDR` | `:8787` | Panel + static UI listen address |
| `G3_S3_ADDR` | `:9000` | S3-compatible API listen address |
| `G3_DATA_DIR` | `./g3-data` | Directory for the SQLite DB + encryption key |
| `G3_ADMIN_EMAIL` | `admin@g3.local` | First-run admin email |
| `G3_ADMIN_PASSWORD` | `change-me-now` | First-run admin password |
| `G3_ENCRYPTION_KEY` | *(auto)* | base64 32-byte key for Drive tokens (auto-generated in the data dir if unset) |
| `G3_GOOGLE_CLIENT_ID` | | Google OAuth client (Drive API) |
| `G3_GOOGLE_CLIENT_SECRET` | | Google OAuth client secret |
| `G3_GOOGLE_REDIRECT_URI` | | `https://<panel>/api/accounts/callback` |
| `G3_DEV` | `true` | `false` in production → session cookie `Secure` (requires HTTPS) |

To link Google accounts: create an OAuth client in the Google Cloud Console with
the **Drive API** enabled, set the three `G3_GOOGLE_*` vars, then use **Storage →
Accounts → Add Google account** in the panel.

## Using the S3 API

Create an access key in **Storage → Access Keys**, then point any S3 tool at
`G3_S3_ADDR` with **path-style** addressing:

```bash
aws s3 mb   s3://my-bucket            --endpoint-url http://localhost:9000
aws s3 cp   ./big.iso s3://my-bucket/ --endpoint-url http://localhost:9000
aws s3 ls   s3://my-bucket            --endpoint-url http://localhost:9000
aws s3 cp   s3://my-bucket/big.iso .  --endpoint-url http://localhost:9000
```

Works with the AWS CLI, S3 Browser, rclone, and other S3 clients (presigned URLs
included).

## Project layout

```
src/                 Next.js panel (static export)
server/              Go module (module: g3)
  cmd/g3/            entrypoint
  internal/
    httpd/           router + embedded SPA + panel REST API
    s3/              S3 protocol, SigV4, storage engine, balancer
    drive/           Google OAuth + Drive client
    store/           SQLite schema + queries
    crypto/          AES-GCM token encryption
    config/          env loading
build.sh · Makefile  next export -> embed -> go build
Dockerfile · nixpacks.toml  deployment
```

## Tech stack

Go · SQLite (pure-Go, `modernc.org/sqlite`) · Google Drive API ·
Next.js (static export) · React · TanStack Query · Zustand · Tailwind · shadcn ·
next-intl.

## License

Apache-2.0 — see [LICENSE](LICENSE).
