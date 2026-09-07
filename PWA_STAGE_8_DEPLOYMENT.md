# PWA Stage 8 — Device notification controls

Stage 8 lets a signed-in user intentionally enable or disable Web Push for the
current browser/device. It stores the browser subscription in the protected
Stage 7 table. It does not send a notification, deploy a push-delivery Edge
Function, or create a reminder schedule.

## What changes

- Settings contains a dedicated **Payment reminder notifications** card.
- Permission is never requested on page load.
- **Enable notifications** is the only action that can open the browser or
  operating-system permission prompt.
- Existing `default`, `granted`, and `denied` permission states have distinct
  explanations.
- iPhone and iPad users must open the installed Home Screen app before enabling
  Web Push.
- The browser subscription is inserted once and refreshed without changing its
  owner or protected delivery-health fields.
- **Disable on this device** removes the signed-in user's row and unsubscribes
  the browser.
- Sign-out removes this browser's subscription before ending the Supabase
  session, preventing account crossover on shared devices.
- No notification is sent in this stage.

## Files

- `.github/workflows/pages.yml`
- `about.html`
- `app-entry.html`
- `app.html`
- `app.js`
- `config.js`
- `contact.html`
- `index.html`
- `offline.html`
- `pricing.html`
- `push-notifications.js`
- `pwa.js`
- `signup.html`
- `styles.css`
- `sw.js`
- `tests/push-notifications.test.mjs`
- `tests/pwa-entry.test.mjs`
- `tests/pwa-install.test.mjs`
- `tests/pwa-update.test.mjs`

There is no Stage 8 database migration. The existing
`public.push_subscriptions` table from Stage 7 is required.

## Automated checks

From the project folder, run:

```powershell
node --check .\push-notifications.js
node --test .\tests\push-notifications.test.mjs
node --test .\tests\pwa-entry.test.mjs .\tests\pwa-install.test.mjs .\tests\pwa-update.test.mjs
git diff --check main..HEAD
```

## Browser acceptance test

Use one signed-in non-admin test account first.

1. Open **Settings**.
2. Confirm no browser permission prompt appears by itself.
3. Confirm the new card reports the current device and permission state.
4. Press **Enable notifications**.
5. If the browser asks, choose **Allow**.
6. Confirm the card says **Notifications enabled on this device**.
7. In Supabase SQL Editor, run:

   ```sql
   select user_id, device_label, created_at, updated_at, disabled_at
   from public.push_subscriptions
   order by created_at desc;
   ```

   Expected: exactly one active row for this test device. Do not copy or share
   the endpoint, `p256dh`, or `auth` values.
8. Press **Enable notifications** again only if the interface offers it after a
   reload. Expected: the same row is refreshed; a duplicate is not created.
9. Press **Disable on this device**. Expected: the row is deleted and the card
   confirms the device is disabled.
10. Enable again, then sign out. Expected: the row is removed before the sign-in
    screen appears.

## iPhone and iPad

Web Push setup must be tested from the installed Mushavo Budget Home Screen
app. Opening the normal Safari tab should show **Install required** and must not
request permission.

## Two-account security gate

On one test browser/device:

1. Sign in as Account A and enable notifications.
2. Sign out normally. Confirm Account A's device row was removed.
3. Sign in as Account B and enable notifications. Confirm the new row belongs
   only to Account B.
4. Disable notifications and confirm the table is empty again.

This completes the deferred Stage 7 runtime RLS check without sending a push.

## Rollback

Revert only the Stage 8 frontend commit. Do not run the Stage 7 database
rollback while any subscription rows exist. If reverting after a test, disable
notifications on every test device first and confirm the table is empty.
