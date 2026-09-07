# Mushavo Budget PWA and Web Push Build Roadmap

**Purpose:** Build Mushavo Budget as an installable Progressive Web App (PWA), make it open through the correct sign-in/dashboard route, keep users signed in safely, handle code updates reliably, and send real payment-reminder push notifications on Android and iOS.

**Important principle:** PWA installation and Web Push are separate systems. We will finish and verify the installable PWA before rebuilding any Supabase push-notification infrastructure.

---

## 1. The finished system

The complete system will have five layers:

1. **Website/PWA layer** — the manifest, icons, service worker, install experience and offline shell.
2. **Authentication layer** — Supabase session persistence and the launch decision between sign-in and dashboard.
3. **Subscription layer** — the browser creates one push subscription for each installed browser/device, and it is saved against the correct user.
4. **Delivery layer** — a protected Supabase Edge Function encrypts and sends notifications using VAPID keys.
5. **Scheduling layer** — Supabase Cron finds due reminders, places them in an outbox and invokes the delivery function without creating duplicates.

The data flow will be:

```text
Payment/reminder becomes due
        ↓
Reminder is placed in notification_outbox once
        ↓
Scheduled dispatcher claims the pending row
        ↓
Edge Function retrieves the user's active subscriptions
        ↓
Encrypted Web Push is sent to each active device
        ↓
Service worker displays the operating-system notification
        ↓
Tapping it opens the correct payment/reminder page
```

---

## 2. What we are adding beyond the earlier plan

The following items are necessary for a reliable production system and should be included in the new build:

### 2.1 Separate the two Edge Function responsibilities

We should not expose one powerful function for every purpose.

- `send-test-push`: invoked by a signed-in user and allowed to send only to that user's own device. This is used during setup and from a future “Send test notification” button.
- `dispatch-push-reminders`: invoked only by Supabase Cron with a separate cron secret. It can read pending notification jobs and send them to multiple users.

This makes testing understandable while keeping the scheduled administrative function protected.

### 2.2 Duplicate-prevention key

Every scheduled reminder must have an idempotency key, for example:

```text
payment:<payment-id>:due-date:<2026-09-30>:reminder:<one-day-before>
```

The database will enforce a unique constraint on this key. Even if the cron job runs twice, the same logical reminder cannot be inserted twice.

### 2.3 Atomic job claiming

The dispatcher must atomically change a queue item from `pending` to `processing` before sending it. This prevents two overlapping function runs from sending the same reminder.

### 2.4 Retry and invalid-device handling

- Temporary network/server errors will be retried with a controlled delay.
- A permanently invalid subscription, normally indicated by a push service returning HTTP `404` or `410`, will be disabled or removed.
- Failed sends will not be retried forever.
- Logs will record status codes and sanitized errors, never private keys.

### 2.5 Multi-device support

One user may install Mushavo Budget on several phones or browsers. Each installation gets its own subscription row. A notification can be delivered to all active devices belonging to that user.

### 2.6 Logout and account-switch handling

When the user logs out, the app should remove or disable that browser's subscription before clearing the session. This prevents a later user on the same phone from seeing the previous user's reminders.

### 2.7 Timezone-safe scheduling

- Store all scheduled timestamps in the database as `timestamptz`/UTC.
- Store the user's preferred timezone separately.
- Convert to the user's local time when deciding when to enqueue and display reminders.
- Do not use the phone's current clock as the source of truth for sending scheduled reminders.

### 2.8 Lock-screen privacy setting

Payment titles and amounts can be visible on a locked phone. Users should eventually be able to choose between:

- **Detailed:** “Electricity — US$45 is due tomorrow.”
- **Private:** “You have a payment due tomorrow.”

The private option should be the safer default until the user chooses otherwise.

### 2.9 Notification preference controls

Users should be able to:

- Enable or disable push notifications.
- Choose payment-reminder categories.
- Choose how early reminders arrive.
- Choose private or detailed notification previews.
- See whether the current device is subscribed.
- send a test notification.

### 2.10 Cloudflare and service-worker cache headers

If the website is hosted on Cloudflare Pages, an appropriate `_headers` file should prevent the service worker, manifest and HTML entry files from becoming stale. Only fingerprinted assets should use long-lived immutable caching.

### 2.11 A staged rollback plan

Every stage will have its own migration/file change and Git commit. If a stage fails, we roll back only that stage instead of deleting the entire PWA or notification system.

---

# BUILD STAGES

## Stage 0 — Audit and create a safe baseline

### Goal

Understand the current Mushavo Budget code and database before adding anything.

The previous Web Push rollback removed the push tables, queue functions, scheduled job and Vault secrets while leaving in-app bell notifications active. We must verify that current state rather than assuming it.

### Actions

1. Open the Mushavo Budget project folder.
2. Read the project `AGENTS.md` and any project maps or feature documentation.
3. Confirm the current Git branch and working-tree changes.
4. Inventory existing files that may affect a PWA:
   - `manifest.json` or `manifest.webmanifest`
   - `service-worker.js`, `sw.js` or similar
   - service-worker registration code
   - old VAPID code
   - old notification-permission code
   - Cloudflare `_headers` and `_redirects`
5. Search the database schema/migrations for:
   - `push_subscriptions`
   - `notification_outbox`
   - `push_delivery_attempts`
   - `notification_dispatch_runs`
   - `claim_push_notification_outbox`
   - `enqueue_due_payment_reminders`
   - `save_push_subscription`
   - previous cron job names
6. Confirm that normal in-app notifications still work.
7. Create a safe Git checkpoint before PWA work begins.
8. Use one dedicated test account throughout the build.

### What we will not do

- Do not run the old rollback script again.
- Do not paste an old migration into Supabase without auditing it.
- Do not generate new VAPID keys yet.
- Do not deploy an Edge Function.

### Completion check

We should be able to state exactly which PWA/push files currently exist, which database objects exist, and which unrelated changes must be preserved.

---

## Stage 1 — Build the installable PWA foundation

### Goal

Make the website installable without introducing notifications or Supabase Edge Functions.

### Files to add or update

1. `manifest.webmanifest`
2. PWA application icons, including at least:
   - 192×192 PNG
   - 512×512 PNG
   - maskable versions where appropriate
   - `apple-touch-icon`
3. `service-worker.js`
4. Service-worker registration code loaded from the relevant HTML pages
5. Manifest and theme metadata in the HTML `<head>`
6. `app-entry.html`, or an equivalent dedicated PWA launch route

### Manifest decisions

The manifest should include:

```json
{
  "id": "/",
  "name": "Mushavo Budget",
  "short_name": "Mushavo",
  "start_url": "/app-entry.html?source=pwa",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#APP_THEME_COLOUR",
  "background_color": "#APP_BACKGROUND_COLOUR"
}
```

The final colours and icon paths will be taken from the real Mushavo Budget design. Placeholder values must not be deployed.

### Service-worker responsibilities at this stage

- Cache only the minimum static application shell needed to open a friendly offline page.
- Do not cache Supabase Auth, REST, Storage or Edge Function requests.
- Do not cache personal financial data through the service worker.
- Include an offline fallback rather than displaying a broken browser error.
- Use a named/versioned static cache.
- Delete obsolete static caches during activation.

### Android test

1. Deploy the site over HTTPS.
2. Open it in Chrome on Android.
3. Confirm the manifest and service worker register successfully.
4. Install it from the browser.
5. Confirm the Mushavo icon appears.
6. Open it and confirm it uses a standalone window.

### iPhone/iPad test

1. Use a supported iOS/iPadOS version.
2. Open the website in Safari or a browser that provides Add to Home Screen.
3. Tap **Share**.
4. Tap **Add to Home Screen**.
5. Confirm the Mushavo icon and name.
6. Open it and confirm it launches as a Home Screen web app.

### Completion check

The PWA installs and opens on Android and iOS. No notification permission is requested.

### Rollback

Remove only the new manifest registration, service-worker registration and Stage 1 assets. No Supabase database rollback is needed.

---

## Stage 2 — Implement the PWA launch and authentication route

### Goal

When launched from the installed icon, Mushavo Budget must never default to the public marketing home page.

### Launch behaviour

`app-entry.html` should:

1. Initialize the existing Supabase client.
2. Read/restore the current session.
3. Show a brief Mushavo loading screen while checking.
4. If the session is valid, redirect to the correct user dashboard.
5. If there is no session, redirect to the sign-in page.
6. If the device is offline but a recent session and offline shell exist, show a clear offline state rather than pretending server data is current.

### Authentication rules

- Use Supabase's persistent session support.
- Store access/refresh session data only through the established Supabase client.
- Never cache passwords.
- Never put a secret/service-role key in frontend code.
- Verify authorization through Supabase RLS and server-side checks, not merely by trusting a stored frontend user object.
- On logout, clear relevant cached user data and later remove/disable the push subscription when push is introduced.

### Completion check

Test all four cases:

1. Installed PWA + signed out → sign-in page.
2. Installed PWA + signed in → correct dashboard.
3. Normal website visit → public `index.html` remains available.
4. Expired session → refreshes if possible or returns safely to sign-in.

---

## Stage 3 — Build reliable code-update behaviour

### Goal

New deployments should be detected without users repeatedly pulling down to refresh, while unsaved form data is protected.

### Update strategy

1. Check for a service-worker update at app launch.
2. Check again when the app returns to the foreground.
3. When a new service worker is waiting, show:

   > A new version of Mushavo Budget is available. **Update now**

4. If the user has no unsaved changes, **Update now** activates the new worker and reloads.
5. If a form has unsaved changes, warn the user before reloading.
6. Never silently refresh a page that may contain unsaved input.

### Cache strategy

- HTML: revalidate or network-first.
- `service-worker.js`: no long-lived browser caching.
- Manifest: no long-lived browser caching.
- Fingerprinted assets such as `app.abc123.js`: long-lived immutable caching.
- Non-fingerprinted JavaScript/CSS: revalidate; do not mark immutable.
- Supabase API responses: network only unless a separate, deliberate offline-data system is later designed.

### Cloudflare Pages configuration

If static files are hosted on Cloudflare Pages, create/update `_headers`. The exact rule must match the actual project paths. A likely starting structure is:

```text
/service-worker.js
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.webmanifest
  Cache-Control: no-cache, must-revalidate

/*.html
  Cache-Control: no-cache, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

The `/assets/*` rule is safe only if filenames are content-hashed. Otherwise use revalidation.

### Completion check

Deploy a visible version label change and confirm:

1. The installed PWA detects it.
2. The update banner appears.
3. Updating loads the new version.
4. Old caches are removed.
5. Unsaved form data receives a warning before reload.

---

## Stage 4 — Add the install-app experience

### Goal

Keep a clear install option available to eligible users who have not installed Mushavo Budget.

### Android behaviour

1. Listen for the browser's `beforeinstallprompt` event.
2. Save the event temporarily.
3. Show a Mushavo-designed **Install App** banner/button.
4. Call the browser prompt only when the user presses the button.
5. Hide the banner after successful installation or while running in standalone mode.

The browser controls whether the native prompt is available. The website cannot force it to appear continuously.

### iOS/iPadOS behaviour

iOS does not provide the same programmable install prompt. Display a platform-specific guide:

> Install Mushavo Budget: tap **Share**, then **Add to Home Screen**.

The guide should be dismissible but remain accessible from the sign-in/help menu.

### Completion check

- Android gets a working native prompt when eligible.
- iPhone/iPad gets correct manual instructions.
- Installed users do not continue seeing the install banner.

---

## Stage 5 — Prepare the Supabase CLI safely

### Goal

Set up the command-line connection needed for Edge Functions. This stage still does not send notifications.

### Recommended environment

The following examples use **Windows PowerShell** and install the Supabase CLI inside the Mushavo Budget project. A project-local installation makes the version reproducible and means commands start with `npx supabase`.

Supabase currently requires Node.js 20 or later when its CLI is installed through npm.

### Step 5.1 — Open the correct folder

In File Explorer:

1. Open the Mushavo Budget project folder.
2. Click the address bar.
3. Type `powershell` and press Enter.

Alternatively, open PowerShell and run:

```powershell
cd "C:\path\to\Mushavo Budget"
```

Replace the example path with the real project folder.

Check the current location:

```powershell
Get-Location
```

Do not proceed until the path is the Mushavo Budget project root—the folder containing the main HTML/application files and project documentation.

### Step 5.2 — Check Node and npm

```powershell
node --version
npm --version
```

Expected:

- Node prints `v20...` or newer.
- npm prints a version number.

If Node is missing or older than 20, stop and update Node before installing Supabase CLI.

### Step 5.3 — Install Supabase CLI in the project

```powershell
npm install --save-dev supabase
```

What this does:

- Downloads the Supabase command-line package into this project.
- Adds it under `devDependencies` in `package.json`.
- Does not log into Supabase.
- Does not change the hosted database.
- Does not deploy an Edge Function.

Confirm installation:

```powershell
npx supabase --version
```

`npx` means “run the copy installed in this project.”

### Step 5.4 — Check whether Supabase is already initialized

```powershell
Test-Path .\supabase\config.toml
```

- If the result is `True`, do not run `supabase init` again.
- If the result is `False`, run:

```powershell
npx supabase init
```

What `init` does:

- Creates a local `supabase` folder and `supabase/config.toml`.
- Does not create a new online project.
- Does not alter the hosted database.

### Step 5.5 — Sign the CLI into Supabase

```powershell
npx supabase login
```

Depending on the CLI flow, it may open a browser or ask for a personal access token.

If the browser opens:

1. Confirm the official Supabase domain.
2. Sign in to the correct Supabase account.
3. Approve the CLI authorization.
4. Return to PowerShell.

If a personal access token is requested:

1. Open the Supabase Dashboard manually.
2. Go to account settings/access tokens.
3. Create a token with a recognizable name such as `Mushavo Budget local CLI`.
4. Copy it once.
5. Paste it only into the PowerShell prompt.
6. Never place it in HTML, JavaScript, Git, screenshots or chat.

What the access token does:

- Allows the CLI to manage projects, functions and secrets that your Supabase account can access.
- It is not the database password.
- It is not the frontend publishable key.
- It is not a VAPID key.

Expected final output:

```text
Finished supabase login.
```

### Step 5.6 — Identify the correct project

```powershell
npx supabase projects list
```

Find the row for Mushavo Budget and copy its project reference/ID. Confirm it against the Supabase Dashboard URL:

```text
https://supabase.com/dashboard/project/PROJECT_REF
```

The project reference is an identifier, not a private key.

### Step 5.7 — Link the local folder

```powershell
npx supabase link --project-ref PROJECT_REF
```

Replace `PROJECT_REF` with the exact value from the Dashboard or project list.

The CLI may ask:

```text
Enter your database password (or leave blank to skip):
```

The database password is the password created for the Supabase database—not the normal Supabase website login password. Enter it only into the secure prompt. Do not include the password inside the command.

What linking does:

- Records which hosted Supabase project this local folder belongs to.
- Fetches/validates project configuration.
- Does not deploy code by itself.
- Does not push the local database schema by itself.

Expected output:

```text
Finished supabase link.
```

### Step 5.8 — Verify remote function access

```powershell
npx supabase functions list
```

An empty function list is acceptable. An authorization or project error is not; stop and fix the account/project link before proceeding.

### Docker decision

We will not introduce Docker simply to deploy the first Edge Function. Supabase can deploy with API-based bundling:

```powershell
npx supabase functions deploy FUNCTION_NAME --use-api
```

Docker is useful later if we deliberately decide to run the full Supabase stack locally, but it is not required for the initial staged deployment.

### Completion check

- CLI version works.
- Correct account is logged in.
- Correct project is linked.
- Function list can be retrieved.
- No database migration or Edge Function has been deployed.

---

## Stage 6 — Generate and store VAPID keys

### Goal

Create the application-server key pair used by standards-based Web Push.

### What VAPID means here

- **Public key:** given to the browser when it creates a subscription. It is safe to include in frontend configuration.
- **Private key:** used only by the server/Edge Function to sign push requests. It must remain secret.
- **Subject:** a contact URI, normally `mailto:notifications@your-domain.com` or another monitored address.

### Step 6.1 — Generate the pair once

A common local command is:

```powershell
npx web-push generate-vapid-keys --json
```

Before running this during implementation, we will pin/audit the package version being used. The command only generates a cryptographic key pair locally; it does not connect the keys to Supabase automatically.

It returns:

```json
{
  "publicKey": "PUBLIC_VALUE",
  "privateKey": "PRIVATE_VALUE"
}
```

Do not take a screenshot containing the private key. Save it immediately in the correct secure location.

### Step 6.2 — Store the private value

Preferred method:

1. Open Supabase Dashboard.
2. Select the verified Mushavo Budget project.
3. Open **Edge Functions → Secrets**.
4. Add:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `APP_ORIGIN`
5. Mark/handle `VAPID_PRIVATE_KEY` as confidential.

`APP_ORIGIN` will contain the official Mushavo Budget origin, such as `https://budget.example.com`, and will be used to restrict deep links and CORS.

The terminal alternative is:

```powershell
npx supabase secrets set VAPID_PUBLIC_KEY="PUBLIC_VALUE" VAPID_PRIVATE_KEY="PRIVATE_VALUE" VAPID_SUBJECT="mailto:ADDRESS" APP_ORIGIN="https://YOUR-DOMAIN"
```

The Dashboard is preferable for the first setup because it reduces the chance of secrets being left in PowerShell history.

Supabase automatically provides its own URL and backend secret-key environment variables to Edge Functions. We should use the current `SUPABASE_SECRET_KEYS` environment value inside the Edge Function rather than copying a secret/service-role key into the source code. Names beginning with `SUPABASE_` are reserved and should not be manually created.

### Important recovery rule

Do not regenerate the VAPID pair after users subscribe. If it is lost or rotated, existing subscriptions may need to be recreated with the new public key.

### Completion check

- One VAPID pair exists.
- The public key is recorded for frontend configuration.
- The private key is present only in protected server-side secrets.
- No real subscription or notification exists yet.

---

## Stage 7 — Create the push-subscription database layer

### Goal

Store one subscription for each user/device while preventing users from seeing or changing another user's subscriptions.

### Proposed `push_subscriptions` data

At minimum:

| Column | Purpose |
|---|---|
| `id` | Internal UUID |
| `user_id` | Owner from Supabase Auth |
| `endpoint` | Browser push-service delivery address |
| `p256dh` | Browser-generated encryption key |
| `auth` | Browser-generated authentication secret |
| `device_label` | Optional friendly label |
| `user_agent` | Helps troubleshoot device/browser issues |
| `created_at` | First subscription time |
| `updated_at` | Last refreshed time |
| `last_success_at` | Last successful delivery |
| `failure_count` | Consecutive failures |
| `disabled_at` | Marks an inactive subscription |

The endpoint should be uniquely constrained so the same browser endpoint is not stored repeatedly.

### Security requirements

- Enable Row Level Security.
- Anonymous users get no access.
- Authenticated users may read/delete only their own subscriptions.
- Inserts/updates must force `user_id = auth.uid()`.
- Limit grants to the exact required operations.
- The Edge Function uses a server-side secret key and can read subscriptions for dispatching.
- Never expose the Edge Function's Supabase secret key in the browser.

### Deployment method

1. Create a numbered SQL migration file in the project.
2. Review every statement before execution.
3. Confirm it does not drop or replace unrelated objects.
4. Apply it first to a safe testing environment if available.
5. Otherwise, execute the reviewed migration through the Supabase SQL Editor with a pre-recorded rollback block.
6. Test RLS using two different accounts:
   - Account A can access A's subscriptions.
   - Account A cannot read or change B's subscriptions.
   - Signed-out requests get no rows/access.

### Completion check

The empty table exists, RLS tests pass, and no notification is sent.

---

## Stage 8 — Build notification permission and subscription controls

### Goal

Let the user intentionally enable notifications and save the generated browser subscription.

### User experience

Do not request notification permission automatically at page load. Show an explanation first:

> Enable payment reminders on this device. You can turn them off at any time.

Then provide **Enable notifications**.

### Enable flow

1. Confirm the browser supports service workers, Push API and Notifications API.
2. On iOS/iPadOS, confirm the site is running as an installed Home Screen web app before offering push setup.
3. Check `Notification.permission`.
4. If permission is `default`, request it only after the button click.
5. Wait for the active service worker.
6. Call `pushManager.subscribe` using the VAPID public key and `userVisibleOnly: true`.
7. Convert the subscription to JSON.
8. Save/upsert it in `push_subscriptions` using the current signed-in user's session.
9. Show **Notifications enabled on this device**.

### Permission states

- `default`: permission has not been decided; show enable button.
- `granted`: verify a current subscription exists and upsert it.
- `denied`: do not repeatedly ask. Show instructions for changing browser/system settings.

### Disable flow

1. Retrieve the current browser subscription.
2. Call `unsubscribe()`.
3. Delete/disable the matching row owned by the signed-in user.
4. Clear the app badge if used.
5. Confirm notifications are disabled on that device.

### Logout flow

Before clearing the user session:

1. Remove or disable the current device's database subscription.
2. Unsubscribe the browser where appropriate.
3. Then complete Supabase logout.

This prevents account crossover on shared devices.

### Completion check

The test user can enable/disable notifications and exactly one correct database row appears for the device. Nothing is sent yet.

---

## Stage 9 — Add the user-authenticated test Edge Function

### Goal

Send one genuine Web Push notification to the currently signed-in user's own device.

### Create the local function

From the project root in PowerShell:

```powershell
npx supabase functions new send-test-push
```

What this does:

- Creates `supabase/functions/send-test-push/index.ts`.
- Does not deploy the function.
- Does not send a notification.

### Function security

The function must:

1. Require a valid signed-in user token.
2. Determine the user ID from the verified token, never from an untrusted request body.
3. Query only that user's active subscriptions.
4. Use the server-side VAPID private key.
5. Send a fixed, harmless test payload.
6. Reject requests from unauthenticated users.
7. Apply rate limiting so a user cannot spam the endpoint.
8. Restrict CORS to the official Mushavo Budget origin.

### Dependency checkpoint

Before deployment, verify that the chosen Web Push library:

- Works in Supabase's Deno/Edge runtime.
- Supports Web Crypto rather than unsupported native/multithreaded dependencies.
- Implements the current Web Push encryption/VAPID standards.
- Is version-pinned.
- Produces a deployable bundle within Supabase limits.

This compatibility check is important; a Node package working locally does not automatically mean it works in an Edge runtime.

### Deploy only this function

```powershell
npx supabase functions deploy send-test-push --use-api
```

What this does:

- Bundles and uploads only `send-test-push`.
- Does not deploy every other function.
- Does not change the database schema.

Confirm it appears:

```powershell
npx supabase functions list
```

### Test from the application

1. Sign in with the test account.
2. Install/open the PWA.
3. Enable notifications.
4. Press **Send test notification**.
5. Move the PWA to the background.
6. Confirm the operating-system notification appears.
7. Test Android and iOS separately.

### Completion check

- Signed-in test works.
- Signed-out call is rejected.
- User A cannot send to User B.
- Notification appears while the PWA is closed/backgrounded.
- No automated scheduler exists yet.

### Rollback

Delete/disable only `send-test-push` remotely and remove its local function folder if intentionally abandoning this stage. The PWA remains installed and subscription migration can be rolled back separately.

---

## Stage 10 — Handle push display, clicks and app badges

### Goal

Make the service worker turn an incoming push into a useful notification and open the correct secure page when tapped.

### Service-worker push handler

The handler will:

1. Parse a validated payload.
2. Display a title and body.
3. Use the Mushavo notification icon/badge.
4. Apply a stable notification `tag` to replace duplicates where suitable.
5. Include a timestamp.
6. Keep the payload minimal.

### Click handler

When the user taps the notification:

1. Validate that the target URL is same-origin and on an allowlisted route.
2. Focus an existing Mushavo Budget window if one exists.
3. Otherwise open the PWA.
4. Let normal authentication checks run.
5. If signed in and authorized, show the payment/reminder.
6. If signed out, show sign-in and preserve a safe return path.
7. Never reveal a payment merely because a URL contains its ID; database RLS must still authorize it.

### Badge behaviour

Where supported:

- Increment/set the app badge for unread notifications.
- Recalculate or clear it when the user opens/reads notifications.
- Treat badges as an enhancement; the feature must work without them.

### Completion check

Tapping the test push opens the correct PWA route, does not expose data across accounts, and updates the unread state consistently.

---

## Stage 11 — Build the scheduled reminder outbox

### Goal

Convert due payments/reminders into push-delivery jobs exactly once.

### Proposed `notification_outbox` data

| Column | Purpose |
|---|---|
| `id` | Queue item UUID |
| `user_id` | Intended recipient |
| `source_type` | Such as `payment` |
| `source_id` | Related payment/reminder ID |
| `notification_type` | Such as `payment_due_tomorrow` |
| `scheduled_for` | UTC delivery time |
| `title` / `body` | Prepared display text or safe template data |
| `target_url` | Allowed same-origin route |
| `idempotency_key` | Unique duplicate-prevention value |
| `status` | `pending`, `processing`, `sent`, `retry`, `failed`, `cancelled` |
| `attempt_count` | Number of send attempts |
| `next_attempt_at` | Retry time |
| `claimed_at` | When a dispatcher claimed it |
| `sent_at` | Successful completion time |
| `last_error` | Sanitized failure summary |

### Enqueue rules

1. Use the actual assigned user as the recipient.
2. Respect the user's notification preferences.
3. Respect the user's timezone.
4. Verify the underlying payment is still active and unpaid.
5. Use the payment's real currency in detailed messages; do not label an unconverted amount as the user's default currency.
6. Insert with a unique idempotency key.
7. If that key already exists, do nothing.
8. Also create/retain the in-app bell notification through the established notification workflow.

### Claiming rules

A database function will atomically:

1. Select a small batch of eligible `pending`/`retry` items.
2. Lock those rows.
3. Mark them `processing`.
4. Increment attempt count.
5. Return only the claimed rows to the dispatcher.

This is the advanced part that prevents overlapping cron calls from sending duplicates. It should be introduced only now, after manual push has already succeeded.

### Retry policy

Example policy, subject to testing:

- Attempt 1: immediately.
- Attempt 2: after 5 minutes.
- Attempt 3: after 30 minutes.
- Final failure: record `failed`, preserve the in-app notification, and stop automated retrying.

Do not retry permanent invalid-subscription responses.

### Completion check

Manually enqueue one test reminder and run the claim/send flow twice. Only one operating-system notification should be delivered.

---

## Stage 12 — Add the protected scheduled dispatcher and Cron

### Goal

Automatically process due-reminder jobs without allowing the public internet to trigger administrative sends.

### Create the dispatcher

```powershell
npx supabase functions new dispatch-push-reminders
```

The function will:

1. Validate a dedicated cron secret/header.
2. Reject ordinary public/browser requests.
3. Use Supabase's server-side secret key from Edge Function environment variables.
4. Claim a limited batch from the outbox.
5. Retrieve active subscriptions for each recipient.
6. Send to each active device.
7. Record success/failure.
8. Disable invalid subscriptions.
9. Mark the outbox row sent only according to the defined success policy.
10. Avoid logging subscription endpoints, VAPID private material, access tokens or full financial payloads.

### Create a cron secret

Generate a long random value using an approved password manager/random generator. Store the same value in two protected places:

- Supabase Edge Function secret: used by the dispatcher to validate calls.
- Supabase Vault: used by the database cron request header.

Do not write it directly into SQL, the frontend or Git.

### Deploy the dispatcher

```powershell
npx supabase functions deploy dispatch-push-reminders --use-api
```

Verify:

```powershell
npx supabase functions list
```

### Create the scheduled job

The reviewed SQL will:

1. Store/reference the project/function URL through Supabase Vault.
2. Store/reference the cron credential through Vault.
3. Create a named Cron job.
4. Send a POST request to the dispatcher.
5. Use a small JSON body such as `{ "source": "cron" }`.

### Schedule choice

- During controlled testing: run manually or every 5 minutes for a short period.
- Production starting point: every 15 minutes, unless product requirements require finer timing.

A one-minute production job is not necessary for ordinary payment reminders and creates more runs, logs and possible confusion.

### Important time rule

The Cron schedule itself should operate in UTC. User-local delivery time is calculated from stored timezone data when reminders are enqueued.

### Completion check

1. Insert/create a test payment with a near-future reminder.
2. Confirm one outbox row is created.
3. Confirm Cron invokes the dispatcher.
4. Confirm one push arrives.
5. Confirm the bell notification remains correct.
6. Confirm a second cron run does not duplicate it.
7. Confirm the run is visible in Supabase Cron/function logs.

### Rollback

1. Unschedule the named Cron job first.
2. Confirm no dispatcher runs remain in progress.
3. Disable/delete the dispatcher only if required.
4. Preserve outbox history until the rollback is verified.
5. Remove database objects only using the matching reviewed rollback migration.

---

## Stage 13 — Production hardening, monitoring and rollout

### Goal

Verify that the system remains secure, understandable and reliable under real user behaviour.

### Required test matrix

#### Installation

- Android Chrome installation.
- iOS/iPadOS Add to Home Screen.
- App opens through `app-entry`, not public home.
- Install banner hides after installation.

#### Authentication

- Signed-in launch.
- Signed-out launch.
- Expired/refreshable session.
- Logout removes the device subscription.
- Account switch on the same phone.

#### Notifications

- Permission granted.
- Permission denied.
- Permission revoked later in system settings.
- PWA foregrounded.
- PWA backgrounded.
- PWA closed.
- Multiple devices for one user.
- Invalid subscription cleanup.
- Deep link when signed out.
- Detailed versus private lock-screen text.

#### Scheduling

- Different timezones.
- Payment edited after reminder was queued.
- Payment marked paid before send.
- Payment deleted/cancelled.
- User disables notifications before send.
- Two dispatcher runs overlap.
- Temporary push-service failure.
- Permanent `404`/`410` subscription failure.

#### Updates and offline behaviour

- New code deployment is detected.
- Update does not erase unsaved form input.
- Old caches are removed.
- Offline launch shows clear last-synced/offline state.
- Reconnection refreshes session/data safely.
- Service worker never caches Supabase Auth/API responses unintentionally.

### Monitoring

Monitor at least:

- Cron success/failure.
- Edge Function error rate and duration.
- Pending outbox age.
- Retry/failed count.
- Invalid-subscription count.
- Duplicate-prevention conflicts.
- Notification opt-in/opt-out rate without storing unnecessary personal data.

Supabase Edge Functions have runtime, CPU, bundle-size and logging limits. Dispatch in small batches and continue through later scheduled runs rather than trying to process an unlimited number of notifications in one invocation.

### Controlled rollout

1. Developer test account only.
2. A few invited testers on Android.
3. A few invited testers on iOS.
4. Observe for several days.
5. Fix delivery, update and account-switch issues.
6. Release to a small percentage/group of normal users if the product supports staged rollout.
7. Expand after monitoring remains healthy.

---

# 3. Information and secret-placement reference

| Value | Example format | Secret? | Correct location |
|---|---|---:|---|
| Supabase project reference | `abcdefghijklmnop` | No | CLI project link/config |
| Supabase project URL | `https://ref.supabase.co` | No | Frontend config and Edge environment |
| Supabase publishable key | `sb_publishable_...` | No, but use with RLS | Frontend config |
| Supabase secret key | `sb_secret_...` | **Yes** | Edge Function environment only |
| Legacy service-role key | JWT-like value | **Yes** | Backend only; prefer current secret key where possible |
| Supabase personal access token | `sbp_...` | **Yes** | CLI credential storage only |
| Database password | Password | **Yes** | Secure CLI/database prompt only |
| VAPID public key | URL-safe Base64 | No | Frontend and Edge Function config |
| VAPID private key | URL-safe Base64 | **Yes** | Edge Function secret only |
| VAPID subject | `mailto:...` | No | Edge Function config |
| Cron secret | Random high-entropy value | **Yes** | Edge secret and Supabase Vault |
| Push endpoint | Long browser URL | Sensitive operational data | Protected subscription table/Edge Function |
| `p256dh` and `auth` | Browser-generated values | Sensitive operational data | Protected subscription table/Edge Function |

### Never place these in frontend code

- Supabase secret key
- Legacy service-role key
- VAPID private key
- Cron secret
- Supabase personal access token
- Database password

The frontend publishable key and VAPID public key are designed to be visible. Their safety depends on correct database RLS and backend authorization.

---

# 4. Commands that change something versus commands that only inspect

## Inspection/read-only commands

```powershell
Get-Location
node --version
npm --version
npx supabase --version
npx supabase projects list
npx supabase functions list
```

## Local-only change commands

```powershell
npm install --save-dev supabase
npx supabase init
npx supabase functions new send-test-push
npx supabase functions new dispatch-push-reminders
```

These change files in the project but do not deploy them remotely.

## Remote-change commands

```powershell
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase secrets set NAME="VALUE"
npx supabase functions deploy FUNCTION_NAME --use-api
```

`login` and `link` mainly configure authorization/association; `secrets set` and `functions deploy` actively change hosted Supabase configuration.

Database SQL and Cron creation are also remote changes. They must be reviewed separately before execution.

---

# 5. Stage gates we will follow

We do not proceed merely because a command said “success.” Each stage has an observable product test.

| Stage | Required proof before continuing |
|---|---|
| 0 | Current code/database state documented and checkpointed |
| 1 | PWA installs and launches standalone on test devices |
| 2 | Correct sign-in/dashboard routing in all session states |
| 3 | New deployment is detected without destroying unsaved work |
| 4 | Android and iOS install guidance works and hides when installed |
| 5 | CLI is logged in and linked to the verified project |
| 6 | VAPID private key exists only in protected server-side storage |
| 7 | Subscription table exists and cross-user RLS tests fail safely |
| 8 | One device creates/removes exactly one subscription row |
| 9 | One signed-in user receives one manual test push |
| 10 | Notification tap opens an authorized route correctly |
| 11 | Repeating the queue process does not create duplicate delivery |
| 12 | Scheduled test sends once and records a clear result |
| 13 | Android/iOS/security/update/rollback test matrix passes |

---

# 6. Official references

- [Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase Edge Function quickstart](https://supabase.com/docs/guides/functions/quickstart)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API key security](https://supabase.com/docs/guides/getting-started/api-keys)
- [WebKit: Web Push for Home Screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN: Web app manifest `start_url`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url)
- [MDN: Using service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [Cloudflare Pages custom headers](https://developers.cloudflare.com/pages/configuration/headers/)

---

## Final build order

The order we will follow is:

1. Audit and baseline.
2. Installable PWA foundation.
3. Launch/authentication routing.
4. Safe update and caching behaviour.
5. Install banner/instructions.
6. Supabase CLI setup and verified login/link.
7. VAPID key generation and safe storage.
8. Push-subscription table and RLS.
9. Notification permission and per-device subscription controls.
10. User-authenticated manual test Edge Function.
11. Push display, deep-link and badge behaviour.
12. Idempotent notification outbox and retry logic.
13. Protected dispatcher and Supabase Cron.
14. Full test matrix, monitoring and controlled rollout.

No automatic payment reminder will be enabled until a manual test notification works on both Android and iOS and the duplicate-prevention test passes.
