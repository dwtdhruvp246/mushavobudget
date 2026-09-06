# Mushavo Budget PWA — Stage 1 deployment

Stage 1 adds the installable PWA foundation. It does **not** add Web Push, browser notification permission prompts, Edge Functions, database tables, migrations, Cron jobs, or Vault secrets.

## What changed

- The manifest now identifies the installed app as **Mushavo**, uses the production-root scope, and launches through `/app-entry.html?source=pwa`.
- A dedicated maskable icon is included for Android launchers.
- All relevant pages load one shared service-worker registration file: `pwa.js`.
- The service worker caches only a small, non-sensitive PWA shell and a friendly offline page.
- Supabase and future same-origin Auth, REST, Storage, Realtime, and Function routes are excluded from caching.
- The old forced tab reload and forced service-worker activation behavior were removed.
- The manifest is no longer served from the offline cache, and its versioned link forces browsers to fetch the corrected app name.
- The GitHub Pages workflow now publishes all new Stage 1 files.

## Files to replace or add

Extract the Stage 1 update into the project root and allow it to replace matching files. The archive contains only Stage 1 files.

## Commit and deploy

Run from `C:\Users\HP\Desktop\Mushavo Budget`:

```powershell
git status --short
git add -A
git diff --cached --check
git commit -m "feat: add Stage 1 installable PWA foundation"
```

Push the commit using the same GitHub method used for the production website. The Pages workflow will deploy the browser files and omit private project documentation and Supabase source files.

## Important first-update step

The previous service worker may continue controlling an already-open tab until that tab is closed. After the deployment succeeds:

1. If an earlier **Mushavo** app is installed, uninstall it from the device.
2. Close every open Mushavo Budget browser tab and installed-app window.
3. Reopen `https://mushavobudget.com` while online.
4. Refresh once before installing it again.

This lets the new worker activate without forcibly reloading an open form or workspace.

## Android Chrome acceptance test

1. Open `https://mushavobudget.com` in Chrome.
2. Use **Install app** or **Add to Home screen** from Chrome's menu.
3. Confirm the installed name is **Mushavo Budget** and the icon is not clipped.
4. Launch it from the home screen.
5. Confirm it opens without browser chrome and reaches the Mushavo Budget sign-in/workspace screen.
6. Turn on airplane mode, close the installed app, reopen it, and confirm the branded offline screen appears.
7. Reconnect and tap **Try again**.

## iPhone/iPad Safari acceptance test

1. Open `https://mushavobudget.com` in Safari.
2. Tap **Share**, then **Add to Home Screen**.
3. Confirm the name is **Mushavo Budget** and the icon is correct.
4. Launch it from the home screen and confirm it opens as a standalone web app.
5. Repeat the offline and reconnect test above.

## Security and isolation checks

- Do not expect or approve a notification permission prompt in Stage 1. No code requests notification permission.
- In DevTools, Application > Cache Storage should contain only the `mushavo-budget-pwa-shell-v1` static shell.
- The cache must not contain Supabase URLs, API responses, workspace records, payment data, `config.js`, `app.js`, or authenticated HTML.
- Existing in-app notification badges and the Notifications page should continue to work exactly as before.

## Rollback

If Stage 1 must be rolled back before the next stage:

```powershell
git log --oneline -3
git revert <stage-1-commit-hash>
```

Push the revert commit. No Supabase rollback is required because Stage 1 makes no database changes.
