# PWA Stage 10 — Secure notification interactions

Stage 10 makes a Web Push notification open the correct authenticated Mushavo
Budget route and adds progressive app-badge support. It does not create a
scheduled reminder queue, dispatcher, database migration, or Cron job.

## Included safeguards

- Notification text remains fixed and private at this stage.
- Click targets must be same-origin and match an explicit route allowlist.
- Query strings, external origins, unknown paths, and oversized targets fall
  back to the authenticated dashboard.
- A URL never authorizes access; the normal Supabase session and RLS checks
  still run after the app opens.
- An existing app window is navigated and focused when possible; otherwise the
  secure route opens in a new PWA window.
- Badge APIs are feature-detected and failures cannot block push display,
  navigation, logout, or notification cleanup.
- The service worker still does not cache `app.html`, `config.js`, Supabase API
  traffic, or personal financial data.

## Files changed

- `sw.js`
- `push-notifications.js`
- `app.js`
- `supabase/functions/send-test-push/index.ts`
- user-facing HTML version references
- PWA and push regression tests

No database migration is required.

## 1. Verify locally

From the project root in PowerShell:

```powershell
node --check .\app.js
node --check .\sw.js
node --check .\push-notifications.js
node --test .\tests\*.test.mjs
git diff --check main..HEAD
git diff --stat main..HEAD
```

All tests must pass and the diff check must produce no output.

## 2. Deploy in the safe order

1. Merge the reviewed Stage 10 branch into `main`.
2. Wait for the Cloudflare production deployment to report success.
3. Keep the Cloudflare deploy command set to:

```text
npx wrangler deploy --config ./wrangler.jsonc
```

4. Deploy only the updated authenticated test function:

```powershell
npx.cmd supabase functions deploy send-test-push --use-api
npx.cmd supabase functions list
```

Confirm `send-test-push` remains `ACTIVE`. This does not deploy or change the
currency-rate function.

## 3. Test the notification route on Android

1. Open the installed Mushavo Budget app and accept the Version 4.3.0 update.
2. Sign in with the dedicated test account.
3. Confirm notifications are enabled on the Android device.
4. Open Settings and press **Send test notification** once.
5. After the notification arrives, move to another Mushavo tab or the Android
   Home screen without signing out.
6. Tap the operating-system notification.
7. Confirm the existing Mushavo Budget app is focused and opens:

```text
Settings → Payment reminder notifications
```

The URL will end in `#family/settings`. If the saved session has expired, the
app must show its normal sign-in screen first and must not display financial
data until authentication and RLS checks succeed.

## 4. Check badge behavior

When the installed browser and operating system support the Badging API:

- a push sets an app badge;
- opening the notification clears the temporary push badge;
- the app recalculates the badge from its current in-app alert count;
- reading an in-app notification or resolving a due reminder updates the count;
- disabling notifications or signing out clears the badge.

Some browsers and Android launchers display only a dot or do not display a PWA
badge. That is acceptable because badging is a progressive enhancement; push
display and click routing must still work.

## Completion evidence

- A test push still arrives.
- Tapping it opens the allowlisted Settings route.
- An already-open PWA window is reused where supported.
- External and unapproved routes fall back to the dashboard in automated tests.
- Badge support never blocks notification delivery or navigation.
- No scheduled reminder delivery exists yet.

## Rollback

Revert only the Stage 10 commit, allow Cloudflare to deploy the reverted web
files, and redeploy `send-test-push` from the reverted source. No SQL rollback
is necessary. Stage 7 subscriptions, Stage 8 device controls, and Stage 9 test
delivery remain intact.

## Standards references

- [MDN notification click event](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event)
- [MDN Clients.openWindow](https://developer.mozilla.org/en-US/docs/Web/API/Clients/openWindow)
- [MDN PWA app badges](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon)
