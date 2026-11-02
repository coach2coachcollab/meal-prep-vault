# Moving off Lovable: runbook

Target setup:

| | Staging | Production |
|---|---|---|
| Supabase project | `macro-staging` (free plan is fine) | `macro-prod` (free now, **Pro before real users**: backups, no pausing) |
| Web app (Cloudflare Worker) | `macro-app-staging` | `macro-app` |
| Mobile builds | TestFlight / Play internal testing | App Store / Google Play |
| Deployed by | every merge to `main` | publishing a GitHub release |
| Data | fake test data | real users |

The code side is done on branch `chore/migrate-off-lovable`. The steps below need your accounts.
Never paste secrets into chat, code or commits; enter them in the dashboards or the CLI yourself.

## 1. Supabase projects

Organisation: **Coach Nutrition** (free plan), region us-east-1.

| | Ref | Status |
|---|---|---|
| `macro-staging` | `igfxefpkauqofwnifmlh` | ✅ created 2026-10-31 |
| `macro-prod` | n/a | ⏳ blocked: the owner account already has 2 free projects elsewhere. Create it when the org moves to Pro. |

For CI you will also need a personal access token (**Account → Access Tokens**) and each project's
database password (**Project Settings → Database → Reset password** if you don't have it).

## 2. Schema

✅ Staging: all 31 migrations applied (2026-10-31) and the migration history matches the files in
`supabase/migrations`, so `supabase db push` from CI only applies new ones.

Production: apply the same way once the project exists (`npx supabase link` + `npx supabase db push`).

## 3. Edge functions and secrets (each project)

✅ Staging: `extract-recipe-from-image`, `generate-meal-plan`, `generate-weekly-summary` deployed.

Add the AI key yourself in the dashboard (**Edge Functions → Secrets**) or with the CLI:

```bash
npx supabase secrets set --project-ref <ref> GEMINI_API_KEY=...
```

- `GEMINI_API_KEY`: Google AI Studio. Replaces `LOVABLE_API_KEY`. Without it the three AI
  features return "GEMINI_API_KEY not configured".

`send-streak-reminders` (email) is **not deployed**. Streak reminders will become push
notifications in the iOS/Android apps (Capacitor phase), so there is no cron job, Resend key or
`CRON_SECRET` to set up for now.

## 4. Auth settings (each project)

**Authentication → URL Configuration**
- Site URL: the environment's web address (e.g. `https://staging.<domain>` / `https://app.<domain>`).
- Redirect URLs: the same plus `http://localhost:8443` on staging. Mobile deep links get added in the Capacitor phase.

**Authentication → SMTP**: connect Resend. The built-in sender has a very low hourly limit.

## 5. Cloudflare

1. Create a Cloudflare account; note the **Account ID**.
2. Create an API token with the **Edit Cloudflare Workers** template.
3. Optional: add your domain and attach custom domains to `macro-app` and `macro-app-staging`
   after the first deploy.

## 6. GitHub settings

**Settings → Environments**: create `staging` and `production`. On `production` add yourself as a
required reviewer, so production deploys wait for approval.

| Where | Name | Value |
|---|---|---|
| each environment, variable | `VITE_SUPABASE_URL` | project URL |
| each environment, variable | `VITE_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key |
| each environment, variable | `SUPABASE_PROJECT_REF` | project ref |
| each environment, secret | `SUPABASE_DB_PASSWORD` | database password |
| repository, variable | `CLOUDFLARE_ACCOUNT_ID` | account ID |
| repository, secret | `CLOUDFLARE_API_TOKEN` | API token |
| repository, secret | `SUPABASE_ACCESS_TOKEN` | personal access token |
| repository, variable | `DEPLOYS_ENABLED` | `true` (turns the deploy workflow on) |

Then run **Actions → Deploy → Run workflow → staging** once by hand and check the staging site.

## 7. Move the data (after staging works)

1. In Lovable use Cloud **Export** (download it before removing Cloud) or the open-source
   Dreamlit exporter, into `macro-prod`.
2. Check whether password hashes came across. If not, plan a "reset your password" email.
3. Copy Storage files (recipe images, progress photos) if the export didn't.
4. Load the parsed recipes (`scripts/recipe-import`) into staging, review, then production.

## 8. Go live

1. Upgrade `macro-prod` to Pro.
2. Publish a GitHub release; approve the production deploy.
4. Remove Lovable Cloud only after production is verified.

## Next phase: iOS and Android (Capacitor)

The web build is what goes inside the apps, so the environment split carries over: staging builds
for TestFlight/internal testing, production builds for the stores. Native work still to do: push
notifications, deep links for auth emails, file saving/sharing, Sign in with Apple, in-app purchases.
