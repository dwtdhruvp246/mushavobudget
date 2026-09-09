# PWA Stage 13 — Production hardening and controlled rollout

Stage 13 closes the PWA build with a release gate, privacy-safe operational
monitoring, same-device account-switch protection, and a documented rollback
path. It does not change the Stage 11 database schema, the dispatcher, VAPID
secrets, Vault secrets, or the active 15-minute Cron schedule.

## Included safeguards

- A browser push subscription that is not owned by the account currently
  signed in is unsubscribed before that account can enable reminders.
- Revoking notification permission removes the current user's protected
  subscription row and browser subscription when the app next checks Settings.
- Every `main` deployment waits for the complete automated suite to pass.
- The monitoring query exposes aggregate health only—never endpoints, browser
  keys, user IDs, payment names, notification text, routes, or secrets.
- Existing update protection, session validation, bounded dispatch, retry,
  duplicate prevention, invalid-device cleanup, and safe caching remain active.

## Release markers

- App version: `4.4.3`
- App script: `app.js?v=63`
- PWA helper: `pwa.js?v=12`
- Service-worker cache: `pwa-shell-v16`

Version 4.4.3 stores the session-aware entry shell and generic offline page
under redirect-independent cache keys. This preserves safe cold launches on
hosts that canonicalize `/app-entry.html` to `/app-entry`, while continuing to
exclude the authenticated application and Supabase traffic from the cache.

No Supabase migration or Edge Function deployment is required for this web
release.

## Production monitoring

Run `supabase/pwa-stage-13-monitoring.sql` in the Supabase SQL Editor. It returns
one result table so no result tab is hidden by a later statement.

Healthy baseline:

- `Cron configuration`: `PASS`
- `Latest Cron run`: `PASS`
- `Due queue age`: `PASS`
- `Retry and failed jobs`: normally `PASS`
- `Expired processing claims`: `PASS`
- `Duplicate prevention`: `PASS`
- `Subscription health`: normally `PASS`

`INFO` rows are operational totals, not failures. A temporary push failure can
briefly produce `ATTENTION`; investigate if it remains after the documented
5-minute and 30-minute retries.

The SQL diagnostic proves database and Cron health, but a successful Cron row
means the HTTP invocation was queued—not that every Edge invocation completed.
Also open Supabase Dashboard → Edge Functions → `dispatch-push-reminders` →
Logs and check the preceding 24 hours for non-200 responses, execution errors,
or an unusual rise in execution duration. Never copy request headers or secret
values into an incident note.

## Manual device matrix

Record the device/browser and result for each applicable check. Never use a
real sensitive payment name or amount for lock-screen tests.

### Android Chrome

- Install from Chrome and confirm the installed icon opens `app-entry` and then
  the correct signed-in or signed-out app state.
- Confirm the install promotion is hidden after installation.
- Test permission allowed, denied, and later revoked in Android site settings.
- Confirm one scheduled reminder appears while the app is foregrounded,
  backgrounded, and closed.
- Tap a payment reminder and confirm Payments opens with the matching payment
  highlighted.

### iPhone/iPad Safari

- Use Share → Add to Home Screen and open from the new icon.
- Confirm Web Push is offered only inside the installed Home Screen app.
- Test permission allowed, denied, and later revoked in iOS Settings.
- Confirm one scheduled reminder appears with the app backgrounded or closed.
- Tap it and confirm the signed-in Payments route opens safely.

### Authentication and privacy

- Signed-in, signed-out, refreshable-session, and expired-session launches show
  only the correct state.
- Normal logout removes this device before signing out.
- On the same device, sign out of account A, sign in to account B, and confirm
  Settings does not show account A's device as linked.
- Confirm private preview mode shows only generic wording.
- Enable detailed previews only on a non-sensitive test workspace and confirm
  payment name, real currency, amount, and due timing are correct.
- Open a payment reminder while signed out and confirm sign-in is required
  before any payment data is shown.

### Updates, offline and recovery

- A new deployment shows the update banner without reloading automatically.
- With a form containing unsaved changes, confirm the update requires a second
  explicit “Update and discard changes” action.
- After updating, confirm the prior `mushavo-budget-*` cache is removed.
- Offline launch must state that the session cannot be verified and must not
  present financial data as current.
- Reconnect and retry; the current session and latest server data must load.

## Rollback and emergency stop

### Stop automatic reminders immediately

Run `supabase/rollback-push-dispatcher.sql` in the SQL Editor. This removes the
Cron schedule first and keeps outbox history for diagnosis. The protected Edge
Function remains deployed but receives no scheduled invocation.

Verify afterward:

```sql
select exists (
  select 1 from cron.job
  where jobname = 'mushavo-budget-dispatch-push-reminders'
) as dispatcher_job_still_exists;
```

Expected: `false`.

### Restore automatic reminders

After correcting the incident, rerun `supabase/cron-push-reminders.sql`, then
run the Stage 13 monitoring diagnostic. Do not rotate or paste the Cron secret
unless investigation shows that it was exposed.

### Roll back only the web release

Revert the Stage 13 merge commit through GitHub, wait for the test and deploy
jobs to pass, then select **Reload page** in the PWA update banner. This does not
alter subscriptions, the outbox, the dispatcher, or Cron.

## Completion gate

Stage 13 is complete only when:

1. The automated release suite passes on the published commit.
2. The Stage 13 monitoring table has no unexplained `ATTENTION` rows.
3. The applicable Android and iOS checks pass on real installed devices.
4. Authentication, privacy, update, offline, and rollback checks are recorded.
5. The controlled rollout is observed for several days before broad promotion.
