# 5.2 — Session storage and backup exposure

**12 October 2026 / S5E03 — source review and ten existing local VM regressions complete; one owner backup XML receipt pending.**
Source pin: `64bbd2695b004168b45235d96f2220862cede5cc`. [Stage 5 finite plan](SECURITY_STAGE_5_NATIVE_PLAN.md). [Source/local receipt](security-stage-5-storage-review.json).

5.1 remains complete at inventory scope. 5.2 is active; it does not yet have an owner configuration outcome. APK update remains deferred. F14 is the primary existing finding for native sessions/backups; F05/F06 cover final native prerequisites and packaging, F10 callbacks and F17 iOS declarations. No original finding definition or coverage row changes.

## What the reviewed source stores

| Path | Source observation | Evidence limit |
|---|---|---|
| `app.js`, `business.js` | Ordinary Supabase client initialization has no custom Auth storage adapter | Default persistence is expected from official SDK guidance; installed app/session bytes are not inspected |
| `app-entry.js` | Explicit persisted session; local invalid-session cleanup references project-scoped localStorage keys | A launcher cleanup routine is not OS secure storage or backup exclusion |
| `auth-flows.js`, `auth-security.js` | Normal client persists sessions; link client explicitly uses sessionStorage and a separate project key; snapshot disables persistence | Link isolation protects flow boundaries; sessionStorage is not an OS crypto-backed token store |
| `workspace-preference.js` | Account-keyed selection records: version, kind, workspace/family IDs and timestamp; optional native Preferences bridge plus localStorage | Selected record omits financial/session input fields but includes account/workspace identifiers; it remains privacy-relevant metadata |
| `scripts/build-capacitor.mjs`, `package.json` | Bridge bundles App and Preferences for selection/resume; no native token store is wired into these selected Auth clients | Root package inventory does not enumerate owner local plugins/native implementations or actual binary |
| `sw.js` | Selected fetch handler admits same-origin GET shell assets, bypasses sensitive API paths and uses offline documents | This worker is not proof that WebView/HTTP caches, browser storage, downloads or OS backups contain no sensitive material |

**Inference from the reviewed client calls and official Supabase default-storage guidance:** where localStorage is available, the normal clients use that persistent session mechanism. There is no inspected native OS-backed encrypted Auth adapter in the reviewed initialization. This is a source gap, not proof of stolen tokens, an unencrypted device disk or an exploitable installed binary. Browser/WebView script access, OS sandbox/disk encryption, application token encryption and backup exclusion are separate properties.

The selected source already separates link sessions from the normal app session and scrubs callback material before asynchronous link processing. Its logout paths clear/reset app state and call Supabase signOut, with explicit failure handling; launcher fallback cleanup is project-scoped. These protections do not erase already-made cloud/device copies, prove native secure-store deletion, or certify all stored artifacts. Stage 3 hosted Auth/session checks remain unresolved; 5.2 does not supersede their evidence.

Workspace selection intentionally survives sign-out so the same account can restore the chosen workspace. It is not an authorization grant: current identity/access/entitlement must still be checked. That behavior should survive appropriate native storage hardening. Moving Auth credentials into ordinary Preferences would not establish the missing native token protection.

## Verified local evidence

**Ten selected current source/test files match their exact Git blobs, zero mismatches.** Seven source texts were fetched/hashed; retained `app.js`/`business.js` bytes match the current Git tree; the pinned existing test file was fetched/byte-verified. No app source was modified.

**10 PASS / 0 FAIL / exit 0**, Node v24.19.0:
`node --test tests/workspace-preference.test.mjs`.

These existing tests execute actual selection functions in a VM with synthetic localStorage and a mocked Preferences bridge. They check per-account/device selection, exclusion of extra financial/session payload fields, guest/corrupt input, route precedence, blocked storage fallback, simulated native restoration, write ordering, late-read races, bridge failures/resume and same-origin restore URLs. They are ten case executions at this milestone, not ten new security controls or native storage/backup tests. The first preparation attempt found no test file in the partial scratch export and executed zero cases; the pinned test was then fetched and the successful result recorded. No real token, user data, OS store or device was accessed.

No PowerShell runtime is available here; the owner handoff was reviewed as source and has not been executed or syntax-validated in Windows by the assistant.

## Why the Android configuration is needed

Current [official Android Auto Backup guidance](https://developer.android.com/identity/data/autobackup) says backup defaults and transfer behavior depend on manifest settings, OS/target API and resource rules. Older and newer rule formats differ; a cloud-backup switch alone cannot certify all device-transfer behavior. The owner 5.1 receipt proves conventional rule filenames are missing, not which attributes/resources the project actually uses.

The read-only handoff inspects the main manifest's backup-related attributes and any locally referenced `@xml/name` resources in main `res/xml` and qualified `xml-*` directories. It reports custom backup-agent presence, resource hashes, transfer modes and include/exclude definitions. Missing, unset, redacted or unconventional values remain explicit. It prohibits DTD/external XML resolution, bounds file/node sizes and stops on linked paths. It reads no session database, app data, credential store, signing material or device backup payload. It does not execute Gradle, Capacitor or project code.

This selected main source is not the merged release manifest. Product flavors, build-type/dependency overrides, resource precedence, custom BackupAgent implementation, final SDK/OS behavior and actual on-device stores remain unverified. Resource hashes and XML parsing are not a backup exclusion PASS. A local file changing between parse/hash could require rechecking that file before relying on its identity.

## Required completion work under existing F14

1. Inventory actual shipped Auth/token stores and all sensitive local artifacts, their lifetimes, namespace/account boundaries and final native dependencies.
2. Define a supported native credential adapter with appropriate OS-backed key protection, device/backup policy and no raw session fallback to ordinary Preferences/localStorage on adapter failure. Keep the browser/PWA contract distinct and preserve intended same-account workspace restoration.
3. Plan migration of existing browser/WebView credentials, account switch, sign-out, revocation/expiry/resume, crypto-key invalidation and reinstall/update behavior. Retained identifiers/copies require factual lifecycle rules; no global live-account/session mutation is performed here.
4. Review final Android manifest and both applicable backup-rule formats, every supported transfer mode, and actual storage paths; exclude sensitive session/device material from generic backup/transfer and verify the exclusions on supported OS/device combinations.
5. Inspect the actual iOS project, keychain access/protection/synchronization and backup behavior when available; its absence in the selected Windows root is not iOS acceptance.
6. Validate the final merged artifacts and recoverable disposable device/session tests. Native encrypted storage alone cannot prevent injected scripts from acting as a signed-in user; Stage 2 script/origin hardening and Stage 3 authorization/identity evidence remain required.

This is a remediation contract, not an installed adapter or adopted platform policy. Choosing/installing a plugin or changing the untracked Android/iOS project without its reviewed source would be premature. No such repair is applied at this milestone.

## Owner handoff

Paste the complete PowerShell block from chat; its saved counterpart is [read-stage-5-backup-config.ps1](../../scripts/read-stage-5-backup-config.ps1). No SQL, pull/checkout/reset, dependency installation or APK build/sync/install/sign/upload is needed. Return its JSON once. After that receipt, record one bounded source-configuration outcome and carry unverified artifact/device requirements forward; do not turn unavailable device evidence into PASS.

Official supporting references, accessed 12 October 2026:

- [Supabase Auth defaults](https://supabase.com/docs/reference/javascript/auth): default session persistence attempts localStorage; custom storage can be supplied.
- [Capacitor v8 Preferences](https://capacitorjs.com/docs/apis/preferences): lightweight selection persistence uses Android SharedPreferences / iOS UserDefaults.
- [Android Auto Backup](https://developer.android.com/identity/data/autobackup): review settings/resources by OS/target API and transfer mode.

Current platform documentation is guidance, not inspection of the pinned SDK implementation, the owner's installed plugin or final native binary. No device backup/restore, hosted Auth, storage/settings/SQL/provider/email/job/production action ran; no runtime changes, native release action, finding closure or public declaration. Stage 0–4 objects, earlier Stage 5 receipts, original 123 rows/20 definitions and retained fixtures remain unchanged. Full Stage 5 report remains due at 5.5.
