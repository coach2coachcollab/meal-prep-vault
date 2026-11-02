# macro/.

Nutrition and wellness app: log food and how you feel, and see how the two connect.
React web app with a Supabase backend, hosted on Cloudflare, packaged for iOS and Android with Capacitor (planned).

## Requirements

- Node.js 22
- pnpm 10.34.3

Both are pinned in `.mise.toml`. With [mise](https://mise.jdx.dev): `mise install`. Without it: install Node 22, then `corepack enable` (the pnpm version comes from `package.json`).

pnpm is the only supported package manager; `pnpm-lock.yaml` is the only lockfile.

## Local start

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The app runs at http://localhost:8443 and talks to the **staging** Supabase project.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |

Both are public by design: they ship in the app, and access is enforced by row-level security. Secret keys never go in these files or in frontend code. See `.env.example`.

The app refuses to start if either is missing. To use different values locally, create `.env.local` (gitignored), which overrides `.env`.

## Environments

There are two backends. The environment is fixed when the app is built; a shipped build can't switch.

| | Staging | Production |
|---|---|---|
| Build command | `pnpm build:staging` | `pnpm build:production` |
| Supabase project | `macro-staging` | `macro-prod` (not created yet) |
| Cloudflare Worker | `macro-app-staging` | `macro-app` |
| Deployed by | merge to `main` | publishing a GitHub release |
| Data | test data | real users |

`pnpm dev` is local development against staging, not a third backend. Staging and local builds show a banner and allow demo mode; production builds do neither.

Setup steps that need account access are in [docs/migration-runbook.md](docs/migration-runbook.md).

## Tests and build

```bash
pnpm typecheck
pnpm test
pnpm build:staging
```

Pull requests run all three automatically ([ci.yml](.github/workflows/ci.yml)).

## Backend

- `supabase/migrations/`: database schema. Never change a deployed database by hand; add a migration.
- `supabase/functions/`: edge functions. The AI features need the `GEMINI_API_KEY` secret on each Supabase project.
- `scripts/recipe-import/`: turns the recipe PDFs into data for the admin import page at `/admin/import-recipes`.
