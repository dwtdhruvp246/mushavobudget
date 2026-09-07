# PWA Stage 7 — Push-subscription database layer

Stage 7 adds protected storage for one Web Push subscription per browser/device.
It does not request notification permission, deploy an Edge Function, schedule a
job, or send a notification.

## Files

- `supabase/migrations/20260907150000_push_subscriptions.sql`
- `supabase/pwa-stage-7-diagnostic.sql`
- `supabase/rollback-push-subscriptions.sql`
- `supabase/schema.sql` (fresh-project schema updated with the same objects)

## Apply to the existing Supabase project

1. Confirm the local Git working tree is clean and the project is linked to the
   correct Supabase project.
2. Open Supabase Dashboard → SQL Editor → New query.
3. Paste the complete migration file
   `supabase/migrations/20260907150000_push_subscriptions.sql`.
4. Review it, then select **Run** once.
5. Open a second new query and run
   `supabase/pwa-stage-7-diagnostic.sql`.

Do not run the complete `supabase/schema.sql` on the existing database. That
file is only the consolidated starting schema for a new Supabase project.

## Expected diagnostic result

- `push_subscriptions_table` is `push_subscriptions`.
- `rls_enabled` and `rls_forced` are both `true`.
- Twelve columns are listed.
- Four user policies are listed: select, insert, update and delete.
- No `anon` table or column privilege is listed.
- `authenticated` has table-level `SELECT` and `DELETE`.
- The column privilege report includes `SELECT` inherited from the table grant;
  `INSERT` is limited to the six browser-supplied columns and `UPDATE` is
  limited to the four refreshable metadata/key columns.
- `subscription_rows` is `0` before Stage 8.

## Security behaviour to verify at the Stage 8 gate

Using two different signed-in test accounts:

1. Account A can create, read, refresh and delete A's subscription.
2. Account A cannot read, update or delete B's subscription.
3. Account A cannot insert a row whose `user_id` belongs to B.
4. A signed-out browser cannot read or write subscriptions.
5. Re-enabling the same endpoint does not create a duplicate row.

Stage 8 will add the browser controls needed to perform these runtime checks.
The database should remain empty at the end of Stage 7.

## Rollback

`supabase/rollback-push-subscriptions.sql` removes only the Stage 7 table and
timestamp function. It refuses to proceed if subscription rows exist, avoiding
accidental device-data loss after Stage 8 begins.
