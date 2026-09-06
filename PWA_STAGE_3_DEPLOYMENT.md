# Mushavo Budget PWA — Stage 3 deployment

Stage 3 adds reliable code-update detection and protects unsaved form data. It does not require a Supabase migration or any new secret.

## What changes

- Checks for a new service worker when a page launches.
- Checks again when the app returns to the foreground.
- Shows a Mushavo-styled update banner when a new version is ready.
- Activates the new worker only after the user presses **Update now**.
- If an active form contains unsaved changes, the first press displays a warning and requires a separate **Update and discard changes** action.
- Never silently reloads a page containing unsaved input.
- Reloads once, and only after the new service worker controls the page.
- Uses network-first navigation and revalidation for non-fingerprinted shell files.
- Keeps Supabase requests, `app.html`, `config.js`, and financial data out of the service-worker cache.
- Removes older Mushavo Budget shell caches after the approved update activates.
- Displays the current application release as **Version 3.0.0** in both authenticated sidebars.

## Files in this update

- `.github/workflows/pages.yml`
- `about.html`
- `app-entry.html`
- `app-entry.js`
- `app.html`
- `app.js`
- `contact.html`
- `index.html`
- `manifest.webmanifest`
- `offline.html`
- `pricing.html`
- `pwa.js`
- `pwa-update.css`
- `signup.html`
- `sw.js`
- `tests/pwa-entry.test.mjs`
- `tests/pwa-update.test.mjs`
- `PWA_STAGE_3_DEPLOYMENT.md`
- `PWA_STAGE_3_FILES.sha256`

## 1. Replace the files

Extract the ZIP and copy everything inside it into:

```text
C:\Users\HP\Desktop\Mushavo Budget
```

Choose **Replace the files in the destination**. Preserve the `.github\workflows` and `tests` folders.

## 2. Run the automated checks

Open PowerShell in the project folder:

```powershell
cd "C:\Users\HP\Desktop\Mushavo Budget"
node --test .\tests\pwa-entry.test.mjs .\tests\pwa-update.test.mjs
node --check .\pwa.js
node --check .\sw.js
node --check .\app.js
git diff --check
git status --short
```

Expected: **15 tests pass** and the Stage 3 files appear in `git status`.

## 3. Commit and deploy

```powershell
git add -A
git diff --cached --check
git commit -m "feat: add safe PWA code updates"
git push origin main
```

Wait for the **Deploy Mushavo Budget to GitHub Pages** workflow to finish successfully.

## 4. Confirm the Stage 3 update on the installed app

This deployment changes the worker cache from `pwa-shell-v3` to `pwa-shell-v4`.

1. Keep the currently installed Mushavo Budget app available.
2. After GitHub Pages finishes, open the installed app while online.
3. If the app was already open, switch to another app and return to Mushavo Budget.
4. Expected: a banner says **A new version of Mushavo Budget is available**.
5. Press **Update now**.
6. Expected: the app reloads once and the sidebar footer shows **Version 3.0.0**.

The previous version did not yet contain Stage 3's banner listener. If the first Stage 3 rollout does not show the banner, close every Mushavo Budget tab and the installed app, open it once, then reopen it. This one-time transition loads the Stage 3 updater; future deployments are detected automatically.

## 5. Test unsaved-form protection

A waiting service worker is required for this manual test. If the Stage 3 update banner is still visible:

1. Open a form, such as **Add payment**, and change a field without saving.
2. Press **Update now**.
3. Expected: the banner warns that unsaved changes will be discarded. The app must not reload yet.
4. Press **Keep editing**.
5. Expected: the form remains unchanged.

To complete the destructive branch, press **Update now** again and then **Update and discard changes**. The app may reload because that second action explicitly approves losing the unsaved changes.

## 6. Normal behaviour checks

- With no update waiting, no banner is displayed.
- Pressing **Later** hides the banner for the current page.
- Returning to the foreground checks again for a later deployment.
- The public homepage remains at `https://mushavobudget.com/`.
- Offline launch continues to show the connection-required screen.
- Dashboard and Supabase data remain network-only.

## Hosting note

This project currently deploys with GitHub Pages. Cloudflare Pages `_headers` rules were intentionally not added because GitHub Pages does not process that file. Stage 3 instead uses:

- `updateViaCache: "none"` for the service-worker script;
- versioned manifest, JavaScript, and CSS references;
- `cache: "no-store"` for HTML navigation;
- `cache: "no-cache"` revalidation for safe shell assets;
- an explicit allow-list containing only the offline/launcher shell.
