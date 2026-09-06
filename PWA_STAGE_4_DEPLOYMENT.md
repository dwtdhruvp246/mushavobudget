# Mushavo Budget PWA — Stage 4 deployment

Stage 4 adds a clear, platform-aware way to install Mushavo Budget. It does not request notification permission, create a push subscription, change Supabase, or require SQL.

## What changes

- Android and compatible desktop browsers capture the browser's install event without opening it automatically.
- A Mushavo Budget install banner appears only when the browser makes its native prompt available.
- The native browser prompt opens only after the user presses **Install app**.
- iPhone and iPad users receive the correct **Share → Add to Home Screen** instructions.
- Dismissing the promotional banner does not remove the permanent **Install app** option.
- The permanent option is available from public-site account actions, the sign-in/create-account screens, and authenticated sidebar footers when the platform supports installation.
- Install controls are hidden in standalone mode and immediately after a successful installation.
- The install promotion yields to the code-update banner so the two notices do not overlap.
- The application release becomes **Version 4.0.0** and the service-worker shell cache becomes `pwa-shell-v6`.

The browser decides whether an Android native installation prompt is available. Mushavo Budget cannot force Chrome to provide it when the app is already installed, browsing requirements are not met, or the browser has temporarily withheld it.

## Files in this update

- `.github/workflows/pages.yml`
- `about.html`
- `app-entry.html`
- `app.html`
- `contact.html`
- `index.html`
- `offline.html`
- `pricing.html`
- `pwa-install.css`
- `pwa-install.js`
- `pwa.js`
- `signup.html`
- `sw.js`
- `tests/pwa-entry.test.mjs`
- `tests/pwa-install.test.mjs`
- `tests/pwa-update.test.mjs`
- `PWA_STAGE_4_DEPLOYMENT.md`
- `PWA_STAGE_4_FILES.sha256`

## 1. Replace the files

Extract the ZIP and copy everything inside it into:

```text
C:\Users\HP\Desktop\Mushavo Budget
```

Choose **Replace the files in the destination**. Preserve the `.github\workflows` and `tests` folders.

Do not run a Supabase migration for Stage 4.

## 2. Run the automated checks

Open PowerShell in the project folder:

```powershell
cd "C:\Users\HP\Desktop\Mushavo Budget"
node --test .\tests\pwa-entry.test.mjs .\tests\pwa-install.test.mjs .\tests\pwa-update.test.mjs
node --check .\pwa-install.js
node --check .\pwa.js
node --check .\sw.js
git diff --check
git status --short
```

Expected: **22 tests pass** and the Stage 4 files appear in `git status`.

## 3. Commit and deploy

```powershell
git add -A
git diff --cached --check
git commit -m "feat: add PWA install experience"
git push origin main
```

Wait for **Deploy Mushavo Budget to GitHub Pages** to finish successfully.

## 4. Load Version 4.0.0

1. Open Mushavo Budget while online.
2. When **New Mushavo Budget update available** appears, press **Reload page**.
3. The page should reload once.
4. In the authenticated sidebar footer, confirm **Version 4.0.0**.

If the old page remains after GitHub Pages has completed, close every Mushavo Budget tab and the installed app, then open `https://mushavobudget.com` once in Chrome. Future code updates continue to use the normal **Reload page** banner.

## 5. Android acceptance test

Use Chrome on an Android phone and test from the normal website, not from an already installed Mushavo Budget window.

1. If Mushavo Budget is already installed and you want to test a fresh installation, uninstall it first.
2. Open `https://mushavobudget.com` in Chrome.
3. Browse normally for a moment. Chrome determines when installation is eligible.
4. When the Mushavo Budget install banner appears, press **Install app**.
5. Expected: Chrome's native installation confirmation opens only after that press.
6. Accept it and launch Mushavo Budget from the new icon.
7. Expected: the icon is named **Mushavo Budget**, the app opens through the session-aware launcher, and no install banner appears inside the installed app.

If Chrome has not supplied its native prompt, the permanent **Install app** option shows browser-menu instructions. This is expected; the website cannot manufacture the native prompt.

## 6. iPhone/iPad acceptance test

Use Safari on an iPhone or iPad:

1. Open `https://mushavobudget.com`.
2. Expected: the Mushavo Budget install promotion offers **View steps**.
3. Press **View steps**.
4. Expected: the guide says to tap **Share**, choose **Add to Home Screen**, confirm **Mushavo Budget**, and tap **Add**.
5. Press **Not now** on the promotion.
6. Expected: the promotion closes, but **Install app** remains available from the website menu/sign-in area.
7. Add the app to the Home Screen and launch it.
8. Expected: install controls are hidden in the standalone app.

## 7. Regression checks

- No operating-system notification permission prompt appears. Notification permission belongs to a later roadmap stage.
- The public homepage remains the public homepage.
- The installed icon continues using the session-aware launcher.
- The **Reload page** update banner still reloads the page and protects unsaved form changes.
- Sign-in, dashboard data, and Supabase requests remain network-only and are not stored in the service-worker cache.
- The install and update banners never occupy the screen at the same time.

## Rollback

Revert the Stage 4 commit and redeploy. No database rollback, secret change, or Supabase action is required.
