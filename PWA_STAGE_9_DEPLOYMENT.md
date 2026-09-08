# PWA Stage 9 — Authenticated test push

Stage 9 sends one genuine Web Push test to active devices belonging to the
currently authenticated user. It does not create reminder scheduling or Cron.

## Included safeguards

- The user identity comes from `auth.getUser()` using the bearer token.
- Request bodies cannot select another user.
- Only active subscriptions for that verified user are queried.
- CORS is restricted to `APP_ORIGIN`.
- A durable database claim limits each account to one test request per minute.
- VAPID private material is read only from Supabase Edge Function secrets.
- Expired endpoints returning HTTP 404/410 are disabled automatically.
- Browser clients receive no access to the rate-limit table or claim function.

## 1. Review the Stage 9 files

- `supabase/migrations/20260908130000_push_test_rate_limit.sql`
- `supabase/functions/send-test-push/index.ts`
- `supabase/pwa-stage-9-diagnostic.sql`
- `supabase/rollback-push-test.sql`
- `app.html`, `app.js`, and `sw.js`

## 2. Apply the migration

In the Supabase SQL Editor, run the complete contents of:

```text
supabase/migrations/20260908130000_push_test_rate_limit.sql
```

Expected result: `Success. No rows returned`.

Then run `supabase/pwa-stage-9-diagnostic.sql`. Expected values:

- `rate_limit_table_exists`, `rls_enabled`, and `rls_forced`: `true`
- `claim_function_exists`: `true`
- anonymous and authenticated execute access: `false`
- service-role execute access: `true`

The number of rate-limit rows may initially be zero.

## 3. Confirm protected secrets

In Supabase Dashboard → Edge Functions → Secrets, confirm these names exist:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `APP_ORIGIN`

`APP_ORIGIN` must be exactly:

```text
https://mushavobudget.com
```

Do not paste, print, screenshot, or commit the private-key value. Do not create
the reserved `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or
`SUPABASE_SERVICE_ROLE_KEY` secrets manually; Supabase supplies them.

## 4. Deploy only the test function

From the project root in PowerShell:

```powershell
npx.cmd supabase functions deploy send-test-push --use-api
npx.cmd supabase functions list
```

Confirm `send-test-push` appears as `ACTIVE`. This does not redeploy the
exchange-rate function and does not create a schedule.

## 5. Test safely

1. Wait for the Cloudflare deployment of the Stage 9 web files to succeed.
2. Open or install Mushavo Budget on the Android test device.
3. Sign in with the test account and enable notifications on that device.
4. Open Settings and press **Send test notification** once.
5. Move the PWA to the background and confirm an operating-system notification
   titled **Mushavo Budget** appears.
6. Pressing the button again within one minute must show the rate-limit message.
7. Confirm `last_success_at` was populated for the successful subscription.

Stage 10 will add notification click routing and app badges. The Stage 9 test
notification is intentionally fixed and harmless.

## Rollback

Delete or disable only the remote `send-test-push` function, remove its local
folder only when intentionally abandoning Stage 9, and run
`supabase/rollback-push-test.sql`. Existing Stage 7 subscriptions and Stage 8
device controls remain intact.
