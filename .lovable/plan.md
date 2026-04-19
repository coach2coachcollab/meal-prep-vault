
CRON_SECRET is confirmed in secrets. Plan is straightforward — implement the two fixes.

Scope:
1. `send-streak-reminders`: require `x-cron-secret` header matching `CRON_SECRET` env var. Remove the anon-key fallback.
2. Update the pg_cron schedule (if any) to send `x-cron-secret` header. Need to check existing cron jobs first via SQL.
3. Add input validation with Zod to the three AI functions:
   - `generate-meal-plan`: limit `meals` array length (e.g. ≤500), validate macros are positive numbers within sane bounds, cap `dietPrefs`/`allergies` array sizes/string lengths.
   - `extract-recipe-from-image`: limit `imageBase64` size (e.g. ≤8MB decoded ≈ ~11M base64 chars), validate `mimeType` against allowlist (png/jpeg/webp).
   - `generate-weekly-summary`: validate any input body (need to check what it accepts).

No client changes needed — clients already send Authorization headers via supabase-js. The cron job (if scheduled) needs the header added.

Per project rules: no rate limiting.

Keep diffs minimal.
