# PWA Stage 12 — Protected dispatcher and Supabase Cron

Stage 12 processes the Stage 11 outbox automatically. A dedicated secret
authenticates Cron, the dispatcher revalidates every payment before sending,
and Supabase invokes the function every 15 minutes.

## Safety boundary

Do not create the Cron job until the function secret is stored and the function
is deployed. Never paste the Cron secret into Git, frontend code, screenshots,
chat, or the version-controlled Cron SQL.

## Files

- `supabase/functions/dispatch-push-reminders/index.ts`
- `supabase/functions/dispatch-push-reminders/deno.json`
- `supabase/cron-push-reminders.sql`
- `supabase/pwa-stage-12-diagnostic.sql`
- `supabase/rollback-push-dispatcher.sql`
- `tests/dispatch-push-reminders.test.mjs`

## Deployment order

1. Generate one 32-byte random Cron secret locally.
2. Store it as the Edge Function secret `CRON_SECRET`.
3. Deploy only `dispatch-push-reminders`.
4. Verify an unauthenticated request receives HTTP 401.
5. Store the project URL and matching Cron secret in Supabase Vault.
6. Run `supabase/cron-push-reminders.sql` to create the 15-minute job.
7. Run `supabase/pwa-stage-12-diagnostic.sql`.
8. Create one controlled near-due payment and confirm one push, one bell entry,
   one sent outbox row, and no duplicate on the next run.

The exact PowerShell and Dashboard instructions are provided one step at a time
during deployment so the protected value is never copied into chat.
