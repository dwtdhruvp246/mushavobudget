# PWA Stage 10 — Push display, secure clicks, and app badges

Stage 10 makes every Web Push payload pass through a safe display layer, opens
only an approved Mushavo Budget app route when the notification is tapped, and
keeps the installed-app badge aligned with the in-app unread count where the
device supports the Badging API.

The Stage 9 Edge Function, VAPID secrets, database migration, and one-minute
test rate limit are unchanged. Do not redeploy the function or rerun its SQL.

## Included safeguards

- Notification title, body, tag, and timestamp are validated and bounded.
- Malformed payloads fall back to private, non-financial wording.
- Click targets must use the Mushavo Budget origin and `/app.html`.
- Only approved family dashboard, payment, and settings hashes are retained.
- Payment and notification identifiers are retained only when they are UUIDs.
- An existing app window is navigated and focused; otherwise the PWA opens.
- Normal Supabase authentication and Row Level Security still authorize data.
- App badges are optional and never block notification display or app loading.

## 1. Publish the web release

After these files reach `main`, wait for the Cloudflare deployment to pass. No
Supabase command is required for this stage.

The expected release markers are:

- `app.js?v=59`
- `Version 4.3.0`
- `pwa-shell-v10`

## 2. Activate the updated service worker

Open Mushavo Budget. When the update banner appears, choose **Reload page**.
If a form has unsaved changes, save it first and then apply the update.

## 3. Verify the new Stage 10 behavior

This is a click-routing test, not a repeat of the completed Stage 9 delivery
test:

1. Sign in to the same test account in the installed PWA.
2. Open **Settings** and confirm the device still says notifications are
   connected.
3. Press **Send test notification** once, then put the PWA in the background.
4. When the operating-system notification appears, tap the notification.
5. Confirm Mushavo Budget focuses an existing app window or opens a new one.
6. Confirm it lands safely on the signed-in **Settings** route.
7. Where the operating system supports app badges, confirm the badge is cleared
   or recalculated after the app opens.

Do not press the test button a second time within one minute.

## 4. Verify the signed-out return path without removing the subscription

Use a separate browser window that is signed out and open:

```text
https://mushavobudget.com/app.html?source=push#family/settings
```

Confirm the sign-in screen appears. After signing in, confirm the Settings route
opens. This proves a push link cannot bypass authentication and safely preserves
its intended route.

## Completion check

Stage 10 is complete when the notification tap opens the approved route, a
signed-out visit still requires authentication, and badge behavior does not
interfere on unsupported devices.

Stage 11 will add the idempotent reminder outbox and retry logic. It is not part
of this release.
