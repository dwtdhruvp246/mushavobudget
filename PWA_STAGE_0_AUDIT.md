# Mushavo Budget PWA and Web Push â€” Stage 0 Audit

**Audit date:** 5 September 2026
**Status:** In progress â€” local audit complete; live Supabase verification and real-project checkpoint still required.

## 1. Stage 0 decision

Mushavo Budget is **already an installable PWA baseline**. Stage 1 must improve the existing PWA rather than add a second manifest or service worker.

Do not create a second `service-worker.js`. The active worker is `sw.js` and is registered by both `app.js` and `site.js`.

Do not run `supabase/rollback-web-push.sql` again. It remains only as historical recovery documentation.

Do not generate VAPID keys, add push tables, schedule push Cron jobs, or deploy push Edge Functions during Stage 0.

## 2. Local project findings

### Project governance and checkpoint

| Check | Result | Stage 0 consequence |
|---|---|---|
| Git worktree | Not present in the supplied project copy | A real Git checkpoint cannot be created from this copy. Check the actual Windows project folder. |
| `AGENTS.md` | Not present | There are no project-specific agent rules to apply. |
| `PROJECT_MAP.md` / `FEATURES.md` | Not present | The current README and this audit are the available project map. |
| Dedicated push test account | Not identifiable from source | The owner must choose one non-production test account before Stage 1 testing. |

### Existing PWA files

| Component | Current state | Keep or change later |
|---|---|---|
| `manifest.webmanifest` | Active; linked from Home, About, Pricing, Contact, Signup and App pages | Keep one manifest; revise during Stage 1/2. |
| Manifest launch | `id` and `start_url` both point to `./app.html` | Replace with a deliberate app-entry route during Stage 2. |
| Display mode | `standalone` | Keep. |
| Manifest scope | `./` | Suitable for subfolder hosting; verify against the production URL in Stage 1. |
| PWA icons | 192Ã—192, 512Ã—512 and 180Ã—180 Apple touch icon exist in `assets/` | Keep as active icons; verify maskable safe area during device testing. |
| Maskable icon | Reuses the regular 512Ã—512 image | Visually appears to have safe padding, but create a dedicated maskable asset later if device cropping is poor. |
| `sw.js` | Active cache `mushavo-budget-v48` | Refactor this file; do not add a competing worker. |
| `offline.html` | Present | Keep and improve during Stage 1/2. |
| Cloudflare `_headers` | Missing | Add during the cache/update stage after the real hosting path is confirmed. |
| App-entry route | Missing | Add during Stage 2. |
| Install prompt UI | Missing | Add during Stage 4. |

### Current service-worker behaviour

The current worker:

- caches the public pages, authenticated app shell, scripts, styles, configuration, manifest and icons;
- uses network-first handling for page navigation and the main non-fingerprinted files;
- handles only same-origin `GET` requests, so the separately hosted Supabase Auth, REST, Storage and Edge Function calls are not cached;
- deletes older `mushavo-budget-*` caches during activation;
- immediately calls `skipWaiting()`, claims clients and navigates every open client;
- also causes `app.js` to reload when the service-worker controller changes.

The final two behaviours can reload open forms without checking for unsaved work. They must be replaced by the controlled update flow planned for Stage 3.

### Web Push status in the local source

The active source contains none of the following:

- `PushManager` subscription code;
- automatic notification-permission requests;
- VAPID public/private keys;
- service-worker `push` or `notificationclick` handlers;
- `send-test-push` or `dispatch-push-reminders` functions;
- push-specific tables or queue functions in the current schema/migrations;
- push-specific entries in `supabase/config.toml`.

The only deployed Edge Function represented locally is `sync-exchange-rates`, which is unrelated to Web Push and must be preserved.

### Old Web Push rollback

`supabase/rollback-web-push.sql` was designed to remove:

- the `mushavo-push-reminders-every-minute` Cron job;
- `push_subscriptions`;
- `notification_outbox`;
- `push_delivery_attempts`;
- `notification_dispatch_runs`;
- `claim_push_notification_outbox`;
- `enqueue_due_payment_reminders`;
- `save_push_subscription`;
- the old `mushavo_project_url` and `mushavo_cron_secret` Vault entries;
- old push preference columns on `profiles`.

The live diagnostic was run on 5 September 2026. The removed Web Push tables,
functions, Cron job and Vault names were absent; the existing in-app
notification table and policies, scheduling extensions, currency job and
currency Vault names were present. These checks passed.

The first diagnostic revision marked `profiles.timezone` for review because the
old rollback script removed it. The current application schema deliberately
adds that column in its workspace/subscription compatibility layer. It should be
preserved and is not evidence that Web Push is active. The diagnostic has been
corrected accordingly.

### In-app notifications remain separate and intact

The current schema still defines `public.notifications`, its user-level Row Level Security policies and notification inserts for family invitations and subscription decisions. The browser also still loads and renders notifications plus calculated due-payment reminders in the bell/inbox.

The current `workspace_settings` table contains `timezone`, `reminder_enabled` and `detailed_notification_previews`. These are workspace preferences in the current product model and are not proof that the removed Web Push infrastructure still exists.

Runtime confirmation is still required with the selected test account:

1. Sign in.
2. Open the notification bell.
3. Confirm existing invitations/subscription notices load.
4. Create a near-due test payment and confirm its in-app reminder appears.
5. Confirm no operating-system notification permission prompt appears.

## 3. Files that are not part of the active baseline

Files with names such as `app(1).js`, `styles(1).css`, `manifest(1).webmanifest`, `offline(1).html`, root-level duplicate icons, screenshots and prior downloaded ZIPs are not referenced by the active HTML/manifest. Do not deploy or commit them as current application files.

Some supplied screenshots contain operational setup information. Keep screenshots and chat attachments outside the public repository and website deployment.

## 4. Roadmap review

The staged order is sound and should be followed. The following project-specific adjustments are required:

1. Stage 1 is a **refactor and verification** of the existing PWA, not a fresh PWA build.
2. Continue using the single existing worker name `sw.js` unless a deliberate rename and unregister/migration plan is made.
3. Stage 2 should introduce one app-entry route while keeping normal visits to `index.html` public.
4. Stage 3 must remove forced update reloads before unsaved-form protection can be considered complete.
5. The production origin/base path must be confirmed before finalizing manifest scope, deep links, CORS and Cloudflare headers.
6. When Edge Function authorization is implemented later, use the then-current official Supabase server authorization pattern and a named secret key. Do not depend on the roadmap phrase `SUPABASE_SECRET_KEYS` as though it were a guaranteed environment variable.
7. Keep CurrencyAPI scheduling, Vault entries and `sync-exchange-rates` separate from all push migrations and rollback files.

## 5. Steps required to finish Stage 0

### Step A â€” Run the read-only live database diagnostic

1. Open the correct Mushavo Budget project in Supabase.
2. Open **SQL Editor**.
3. Create a new query.
4. Paste the complete contents of `supabase/pwa-stage-0-diagnostic.sql`.
5. Click **Run**.
6. Save a screenshot of the consolidated result table, but make sure no secret values are displayed. The diagnostic intentionally reads only secret names, never decrypted values.

Expected result:

- all four old push tables: `false`;
- all three old push functions: `false`;
- old push Cron job: no row;
- old push Vault names: no row;
- `public.notifications`: `true`;
- notification RLS policies: present;
- `workspace_settings` timezone/privacy fields: present.

### Step B â€” Check the actual Windows project Git state

Open PowerShell in the real Mushavo Budget project folder, then run:

```powershell
Get-Location
git --version
git rev-parse --is-inside-work-tree
git branch --show-current
git status --short
```

Do not commit yet if the status includes screenshots, ZIP downloads, `.env` files, credentials or files you do not recognize. Send the output for review first. Do not include secret contents in the screenshot/message.

### Step C â€” Choose the dedicated test account

Choose one ordinary, non-admin test user that does not contain real household or business payment data. Use the same account for Android and iOS tests so device-subscription behaviour can be compared reliably.

### Step D â€” Create the checkpoint after review

Once the Git status and file list have been reviewed, create the local checkpoint commit in the real project. The intended commit message is:

```text
checkpoint: before PWA web push rebuild
```

Do not push or deploy anything merely to complete Stage 0. A local checkpoint is sufficient.

## 6. Stage 0 completion gate

Stage 0 is complete only when all four statements are true:

- the live diagnostic confirms old push objects and old push Cron/Vault entries are absent;
- in-app notifications work with the designated test account;
- the real project has a reviewed Git checkpoint;
- the production website origin and hosting base path are recorded.

Only then should Stage 1 begin.
