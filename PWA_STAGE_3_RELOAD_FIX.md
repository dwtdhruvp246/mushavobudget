# Stage 3 reload correction

This correction fixes the update banner remaining on **Updating…** without reloading the page.

## Corrected behaviour

The banner now says:

> **New Mushavo Budget update available**  
> Reload the page to use the latest version.  
> **Reload page** · **Later**

After **Reload page** is selected, Mushavo Budget activates the waiting service worker and reloads through the first available signal:

1. the browser fires `controllerchange`;
2. the waiting worker reports that it is `activated`; or
3. a five-second fallback reload runs if Chrome omits both events.

Only one reload is allowed. If a visible form has unsaved changes, the separate discard warning remains in place.

## Replace the files

Extract the correction ZIP into:

```text
C:\Users\HP\Desktop\Mushavo Budget
```

Choose **Replace the files in the destination**.

## Test locally

```powershell
cd "C:\Users\HP\Desktop\Mushavo Budget"
node --test .\tests\pwa-entry.test.mjs .\tests\pwa-update.test.mjs
node --check .\pwa.js
node --check .\sw.js
git diff --check
```

Expected: **16 tests pass**.

## Commit and deploy

```powershell
git add -A
git diff --cached --check
git commit -m "fix: guarantee PWA update reload"
git push origin main
```

Wait for GitHub Pages to finish. Close and reopen Mushavo Budget once while online so `pwa.js?v=3` is loaded. When the update banner appears, press **Reload page**. It should reload immediately when Chrome sends the lifecycle event, or within five seconds through the fallback.

No Supabase SQL or secret changes are required.
