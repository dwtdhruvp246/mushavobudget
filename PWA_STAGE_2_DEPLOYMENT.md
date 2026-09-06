# Mushavo Budget PWA — Stage 2 deployment

Stage 2 gives the installed PWA a deterministic, session-aware launch flow. It does not change the normal public homepage and it does not require a Supabase migration.

## What changes

- The installed icon opens `app-entry.html`, not the marketing homepage.
- A valid restored session is verified with Supabase and then opens the correct authenticated workspace.
- A signed-out or expired session opens the existing sign-in screen safely.
- An offline launch shows a clear offline state and does not present financial data as current.
- The service worker caches only the safe launcher shell. It does not cache `app.html`, `config.js`, Supabase responses, or financial data.
- The GitHub Pages workflow now publishes `app-entry.js`.

## Files in this update

- `.github/workflows/pages.yml`
- `app-entry.html`
- `app-entry.js`
- `offline.html`
- `pwa-shell.css`
- `sw.js`
- `tests/pwa-entry.test.mjs`
- `PWA_STAGE_2_DEPLOYMENT.md`
- `PWA_STAGE_2_FILES.sha256`

## 1. Replace the files

Extract the ZIP. Copy everything inside it into:

```text
C:\Users\HP\Desktop\Mushavo Budget
```

Choose **Replace the files in the destination** when Windows asks. Keep the folder structure, including `.github\workflows` and `tests`.

## 2. Run the automated checks

Open PowerShell in the project folder and run:

```powershell
cd "C:\Users\HP\Desktop\Mushavo Budget"
node --test .\tests\pwa-entry.test.mjs
node --check .\app-entry.js
node --check .\sw.js
git diff --check
git status --short
```

Expected result: seven tests pass and the changed/new Stage 2 files appear in `git status`.

## 3. Commit and deploy

```powershell
git add .github/workflows/pages.yml app-entry.html app-entry.js offline.html pwa-shell.css sw.js tests/pwa-entry.test.mjs PWA_STAGE_2_DEPLOYMENT.md PWA_STAGE_2_FILES.sha256
git diff --cached --check
git commit -m "feat: add session-aware PWA launch"
git push origin main
```

If `git push` says no remote named `origin` exists, stop there and connect the repository to GitHub before pushing. Do not run another `git init`.

After pushing, wait for the **Deploy Mushavo Budget to GitHub Pages** workflow to finish successfully.

## 4. Activate the new service worker

The cache name changes to `mushavo-budget-pwa-shell-v3`. On the phone:

1. Close every open Mushavo Budget browser tab and the installed app.
2. Open `https://mushavobudget.com/app-entry.html?source=pwa` once while online.
3. Wait several seconds, close it, and reopen the installed Mushavo Budget app.
4. If old behavior persists, clear the site data for `mushavobudget.com`, then reinstall the PWA.

## 5. Phone acceptance tests

### Signed out

1. Sign out and close the installed app.
2. Reopen it from the home-screen icon.
3. Expected: the existing Mushavo Budget sign-in screen opens, never the marketing homepage.

### Signed in

1. Sign in, allow the workspace to finish loading, then close the installed app.
2. Reopen it from the icon.
3. Expected: the launcher briefly checks the session and the correct personal/family or admin workspace opens.

### Public website

1. Open `https://mushavobudget.com/` in a normal browser tab.
2. Expected: the public marketing homepage remains visible.

### Offline

1. Open the installed app successfully once while online, then close it.
2. Turn on airplane mode and reopen it.
3. Expected: a connection-required screen appears. It must not show dashboard totals as current.
4. Reconnect and tap **Try again**.

### Expired session

The automated suite covers invalid-session cleanup. In normal use, if Supabase rejects an old refresh token, the PWA clears only this project's local session and routes to sign-in instead of looping or showing a broken workspace.

## Security notes

- Only the existing public Supabase publishable key is used in the browser.
- No service-role key, password, or new secret is stored by the launcher.
- `getSession()` restores the browser session; `getUser()` verifies it with Supabase before routing.
- Authorization remains enforced by Supabase and Row Level Security when `app.js` loads the workspace.
