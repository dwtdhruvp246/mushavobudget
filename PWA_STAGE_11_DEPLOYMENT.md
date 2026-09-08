# PWA Stage 11 — Idempotent scheduled reminder outbox

Stage 11 converts active, unpaid payment reminders into protected delivery jobs
without enabling automatic push sending. Running the enqueue process repeatedly
for the same payment, due date, and local reminder day creates only one outbox
row and one in-app bell notification.

## Included safeguards

- Personal payments go to their owner; assigned household payments go to the
  active assigned user's account.
- Inactive payments and fully paid occurrences are excluded.
- Workspace reminder preferences and IANA timezone settings are respected.
- Detailed previews use the payment's actual currency; private wording remains
  the default.
- A unique idempotency key prevents duplicate jobs and duplicate bell entries.
- `FOR UPDATE SKIP LOCKED` prevents overlapping dispatchers from claiming the
  same row.
- Failed claims retry after 5 minutes and then 30 minutes, with no more than
  three attempts.
- Browser clients cannot read the queue or invoke its administrative functions.
- Stage 11 creates no Cron job and sends no operating-system notification.

## 1. Review the Stage 11 files

- `supabase/migrations/20260908170000_notification_outbox.sql`
- `supabase/pwa-stage-11-diagnostic.sql`
- `supabase/rollback-notification-outbox.sql`
- `tests/notification-outbox.test.mjs`

## 2. Apply the migration

In the Supabase SQL Editor, run the complete contents of:

```text
supabase/migrations/20260908170000_notification_outbox.sql
```

Expected result: `Success. No rows returned`.

This creates the outbox, queue functions, and a 09:00 local reminder-delivery
default. It does not deploy or invoke an Edge Function.

## 3. Run the Stage 11 diagnostic

In the SQL Editor, run the complete contents of:

```text
supabase/pwa-stage-11-diagnostic.sql
```

Expected values in the first result:

- `outbox_table_exists`: `true`
- `rls_enabled_and_forced`: `true`
- all three function-existence values: `true`
- `browser_queue_access_blocked`: `true`
- `enqueue_access_correct`: `true`
- `claim_access_correct`: `true`

The rolled-back exercise should also report:

- `duplicate_insert_was_ignored`: `true`
- `first_claim_returned_one_row`: `true`
- `second_claim_returned_no_rows`: `true`

The diagnostic never invokes Web Push and leaves no synthetic queue row behind.

## 4. Stage boundary

Do not create a Supabase Cron job and do not deploy
`dispatch-push-reminders` yet. Those are Stage 12 changes, after the Stage 11
database checks pass.

## Rollback

Before Stage 12 is enabled, run `supabase/rollback-notification-outbox.sql` only
when intentionally removing Stage 11. Existing in-app notifications are kept.
