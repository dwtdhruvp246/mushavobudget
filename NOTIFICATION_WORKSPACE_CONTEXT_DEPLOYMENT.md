# Notification workspace context — Version 4.6.8

This release identifies the Personal, Family, or Business workspace on every
notification where workspace context is available. Payment-reminder clicks
select the authorized workspace before opening and highlighting the payment.
Admin subscription-payment alerts open the exact Finance payment record.

Phone lock-screen privacy remains controlled by the existing **Detailed
notification previews** setting:

- On: the push title is `Personal · name`, `Family · name`, or
  `Business · name`, and the payment detail remains visible.
- Off: the push title remains `Mushavo Budget` and the body remains generic.
- The authenticated in-app notification list always shows its workspace label.

## Deployment order

1. Pull the reviewed Version 4.6.8 release from `main`.
2. Run
   `supabase/migrations/20260921130000_notification_workspace_context.sql` in
   the Supabase SQL Editor.
3. Run `supabase/notification-workspace-context-diagnostic.sql`. It must return
   `notification_workspace_context_ready = true` and then roll back.
4. Publish the web release. No Edge Function or Cron redeployment is required.
5. Reload each test device once and confirm the footer shows Version 4.6.8.

## Live verification

1. Select one Family workspace, then trigger a reminder for a payment in a
   different authorized workspace.
2. Confirm the bell shows the correct workspace label.
3. Open the notification and confirm the app switches workspace, opens
   Payments, and highlights the matching payment.
4. Turn detailed previews off, trigger another reminder, and confirm the phone
   lock screen shows neither the workspace name nor payment details.
5. Turn detailed previews on and confirm the next push shows the workspace
   label and payment details.
6. Submit a subscription payment and confirm an authorized admin alert opens
   that exact Finance payment record.
7. Remove a test user's workspace access and confirm its old deep link is
   refused instead of opening data.

## Rollback

The database migration is additive and can remain applied if the web release
is rolled back. Version 4.6.7 safely ignores the added workspace query value
while retaining the validated payment destination. Restore Version 4.6.7 web
assets if an application rollback is required; do not delete notification or
outbox history.
