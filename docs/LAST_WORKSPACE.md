# Last workspace startup — 4.9.33

The PWA launcher and authenticated app restore a successful workspace selection per user and device. A fresh launch opens Personal Dashboard, the exact Family Dashboard, or the exact Business Overview. An already open app retains its current page and rechecks access on resume.

Only workspace metadata is persisted: schema version, workspace type, workspace UUID, legacy Family UUID where applicable, and a save timestamp. Preferences are not authorization. Current account status, membership, workspace status and subscription entitlement are always checked by the existing protected flows. Admin startup remains unchanged.

Explicit routes, notifications, invitations and checkout links take precedence. Missing Family/Business access returns to Personal with an explanation, rather than silently selecting another company. An expired Business still uses its owner renewal screen or member lock. Offline launch retains the preference and uses the existing offline screen. Sign-out retains each account's preference; no preference is read for a guest.

## Web release

No SQL or Edge Function deployment is needed. `workspace-preference.js` is included in the public deployment and the safe PWA shell. The worker and application asset versions are incremented together.

## Existing Android / iOS projects

Native project directories and signing/build settings are not tracked in this repository. Rebuilding the installed binary is required for a locally bundled Capacitor app; merging a web release does not replace its bundled assets.

In the existing Windows project, first check and commit or otherwise preserve local native work before pulling the web release. Keep the existing Capacitor application ID, platform directories and configuration. `webDir` must be `www`.

Install plugins matching the installed Capacitor core major:

```powershell
$capacitorMajor = node -p "require('@capacitor/core/package.json').version.split('.')[0]"
npm install "@capacitor/preferences@$capacitorMajor" "@capacitor/app@$capacitorMajor"
npm install --save-dev esbuild
node .\scripts\build-capacitor.mjs
npx cap sync android
```

Then build/install Android using the existing Android Studio or Gradle workflow. The builder puts the session launcher at `www/index.html`, includes all current web assets and bundles a local native bridge. It does not change the public web homepage or native platform configuration. Preferences use Android SharedPreferences / iOS UserDefaults; browsers use localStorage. The builder should replace any older local script which copied `app.html` to the entry file without the new shared assets.

For an existing iOS project on a Mac:

```bash
node scripts/build-capacitor.mjs
npx cap sync ios
npx cap open ios
```

Include the Preferences plugin's required privacy declaration in the existing `ios/App/PrivacyInfo.xcprivacy` file (merge with existing declarations): `NSPrivacyAccessedAPICategoryUserDefaults`, reason `CA92.1`. See the official [Preferences documentation](https://capacitorjs.com/docs/apis/preferences). The App plugin is used for [appStateChange resume checks](https://capacitorjs.com/docs/apis/app). Native notification transport, associated domains and universal-link registration retain their existing integration; this release does not add those capabilities.

Do not uninstall a test build to test an update: uninstalling clears app preferences. Install the updated build over the existing one with the same app ID/signature. Test on real Android/iOS devices before treating native acceptance as complete.

## Verification

- `node --test tests/*.test.mjs`: preference isolation, corrupt/blocked storage, native restoration and write ordering, route precedence, Family/Business fallback, account restrictions, sign-in destination preservation and existing expiry rules.
- `node scripts/verify-last-workspace-ui.cjs`: real launcher/app DOM with mocked Supabase at 390 and 1366 pixels. Closes and opens pages to verify Personal, exact Family and Business restoration and notification-route precedence. Requires Playwright and Chromium (`MUSHAVO_CHROMIUM_EXECUTABLE` can specify a local executable).
- `node scripts/build-capacitor.mjs`: packages the native bridge and public assets; requires the plugins and esbuild described above.

## Real device acceptance checklist

Use two accounts and two Business/Family workspaces where available. Mark each PASS, FAIL or NOT TESTED.

1. Open Personal, close the PWA completely, relaunch: Personal Dashboard.
2. Select a particular Family, close and relaunch: that exact Family Dashboard.
3. Select a particular Business, close and relaunch: that exact Business Overview.
4. Minimize on Reports, resume: same page; access and current subscription state are rechecked.
5. Sign out, then sign in as another user: use their saved selection on that device.
6. Expire sign-in and sign in again: restore the same account's selection.
7. Remove membership/delete the remembered workspace: relaunch returns to Personal with an explanation.
8. Expire Business: Owner receives renewal access; another member receives the existing lock.
9. Suspend the account: suspension screen, no workspace contents.
10. Open a payment/bill notification or invitation: intended destination takes precedence.
11. Relaunch offline, reconnect: offline screen retains the preference and launch can retry.
12. Use different workspaces on phone and PC: each device keeps its own preference.
13. Repeat 1–12 with a rebuilt Android binary and a rebuilt iOS binary, including installation over an older build.

Automated checks use fixtures and do not replace live Supabase accounts, native OS lifecycle or real-device notification tests.
