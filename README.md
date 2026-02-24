# Releaseboard

A central changelog service that aggregates releases and commits across multiple repositories (public and private) into one user-facing changelog page.

## Features

- Unified release feed across services
- Multi-provider Git support: GitHub, GitLab, Bitbucket (Cloud + Server commits), and Gitea
- Multi-changelog pages with unique path names (for example `/payments`, `/infra`, `/mobile`)
- Landing page + configurable root mode (`/` can point to landing or changelog)
- Automatic commit-derived entries when a repository has no managed releases
- Persistent changelog snapshot storage in SQLite (survives restarts)
- Private repo support via admin-managed tokens
- Admin UI for source management
- JSON API endpoint: `/api/changelog`
- Optional "Sign in with PipeOps" CTA for landing and admin auth screens
- Modern dark theme inspired by PipeOps

## Local setup

```bash
npm install
npm run dev
```

`npm run dev` now prewarms key routes/assets to avoid first-load `_next/static` 404s in dev mode.
Use `npm run dev:raw` if you want plain `next dev`.

Open:

- `http://localhost:3000` root page (landing by default)
- `http://localhost:3000/changelog` for the unified changelog feed
- `http://localhost:3000/admin` for source management

## Environment variables

Create `.env.local` in the project root:

```bash
ADMIN_PASSWORD=change-me
ADMIN_SESSION_SECRET=replace-with-long-random-secret
TOKEN_ENCRYPTION_KEY=replace-with-long-random-secret
CHANGELOG_API_KEY=replace-with-api-key-for-json-endpoint
PIPEOPS_SIGNIN_URL=https://pipeops.example.com/oauth/authorize?redirect_uri={returnTo}
APP_BASE_URL=http://localhost:3000
```

Notes:

- `ADMIN_PASSWORD` protects `/admin`. If unset, admin is open (development mode).
- `TOKEN_ENCRYPTION_KEY` encrypts stored provider access tokens at rest.
- `CHANGELOG_API_KEY` protects `/api/changelog`. Send it in `x-api-key` or `Authorization: Bearer ...`.
- `PIPEOPS_SIGNIN_URL` overrides the default PipeOps sign-in URL. `{returnTo}` is replaced automatically, or `return_to` is appended when missing.
- If `PIPEOPS_SIGNIN_URL` is not set, the app defaults to `https://pipeops.sh/auth/signin`.
- `APP_BASE_URL` defines the absolute callback base used when building PipeOps sign-in redirects.

## API examples

```bash
curl http://localhost:3000/api/changelog
curl http://localhost:3000/api/changelog?path=changelog
curl http://localhost:3000/api/changelog?force=1
curl -H "x-api-key: $CHANGELOG_API_KEY" http://localhost:3000/api/changelog
curl -H "Authorization: Bearer $CHANGELOG_API_KEY" http://localhost:3000/api/changelog?force=1
```
