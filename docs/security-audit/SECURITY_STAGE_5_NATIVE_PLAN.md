# Stage 5 — Native security and compatibility

## 5.1 owner receipt and inventory outcome — 12 October 2026 (S5E02)

**5.1 is complete at tracked-source and owner-reported file-metadata scope. One of five Stage 5 steps is complete; four remain. Next: 5.2, Auth persistence/workspace preferences and OS/cloud/device backup review. Full report remains due at 5.5.**

[Owner receipt and reconciliation](security-stage-5-native-owner-metadata.json) preserves all 24 selected path rows: 11 files, three directories, ten missing paths, no skipped links. The attachment SHA256 and exact owner JSON are recorded. This is successful metadata intake, not a native security PASS or an executed build/device test.

The Windows checkout reports branch `main`, commit `2aa668451a8e743dafb3768261175c51a215205e`, not the audit source pin. The Android directory has zero tracked entries; `capacitor.config.json`, the local build script and six selected Android files exist but are untracked (eight untracked file rows total). The package manifest, lock and ignore file each have a tracked entry. This check did not inspect all local edits or prove the checkout matches HEAD.

Four common files have different hashes and smaller sizes than the audited source: `package.json`, `package-lock.json`, `.gitignore`, and `scripts/build-capacitor.mjs`. These are source/baseline differences, not test failures. The local builder cannot be treated as the audited 4,490-byte builder: the reported local copy is 2,296 bytes and its contents are not yet reviewed. Later native integration must preserve the existing app ID, project and signing identity while reconciling baselines; no pull, checkout, reset, stash, native commit, replacement or merge is requested here.

The selected root `ios/` path and four conventional iOS configuration paths are missing. Other checkout locations and devices were not searched. Three conventional Android XML resources (`backup_rules.xml`, `data_extraction_rules.xml`, `network_security_config.xml`) are missing at the tested paths. That does not establish whether backup is enabled, which exclusions apply or whether alternate resource names/configurations protect transport. Actual manifest attributes/resource references remain due at 5.2/5.3.

Git/Node/npm are discoverable on PATH; Java/ADB are not. Android SDK environment variables and JAVA_HOME are not present. These are availability signals, not proof that Android Studio, a bundled JDK/SDK or tooling elsewhere is absent. Actual versions and Gradle compatibility remain unverified; no tool installation is requested.

The prior S5E01 source inventory and metadata handoff remain immutable historical snapshots; their then-pending owner field is superseded by this receipt. Previous Stage 0–4 progress and original coverage/finding definitions remain unchanged. The source packaging gap remains assigned to 5.4. Zero behavior/build/hosted/device tests ran; no native sync/install/sign/upload, account/settings/SQL/provider/production change or finding closure occurred. APK update stays deferred. No rerun or further 5.1 SQL/terminal action is needed.

## Historical 5.1 source review and initial handoff — S5E01


**5.1 / 11 October 2026 — source review complete; owner local metadata pending (S5E01).**
Source pin: `83f5dd2ac04be107e82baf992f796f47e24d7049`. This stage follows the [Stage 4 completion report](SECURITY_STAGE_4_COMPLETION_REPORT.md). APK update remains deferred. Stage completion reports document the available evidence and carry-forward; they do not certify device security or release readiness.

## Five finite steps

| Step | Bounded work | Outcome needed |
|---|---|---|
| 5.1 | Existing tracked native/build inventory and one owner Windows metadata receipt | Identify actual local projects/configuration and source pin; record unavailable inputs |
| 5.2 | Auth token persistence, workspace preferences and OS/cloud/device backup exposure | Review available source/configuration; prepare narrowly scoped repairs and meaningful offline checks where supported |
| 5.3 | WebView origins/navigation, callbacks, permissions, transport and iOS privacy declarations | Review available platform configuration and dependencies; record source evidence and missing OS/dashboard evidence |
| 5.4 | Native packaging compatibility and device/build readiness | Repair supported source packaging gaps and verify in an isolated synthetic/offline fixture; record one device readiness outcome without rebuilding/installing the APK |
| 5.5 | Reconcile evidence, full Stage 5 report and final-remediation handoff | Preserve earlier receipts and original findings; give each finite step a scoped outcome |

Existing assigned findings remain F05/F06/F10/F14/F17. Google/Apple identity implementation belongs to Stage 6, commerce to Stage 7, native push to Stage 8 and signed/store release evidence to Stages 9–10. Stage 5 may identify their native dependencies. Device execution requires available inputs and its own authorized scope.

## 5.1 source observations

The complete current Git tree contains no tracked `android/`, `ios/` or `capacitor.config.*` project/configuration. This does **not** establish that the owner's Windows projects are absent. Earlier owner output showed untracked Android and Capacitor configuration; their current bytes are unknown. No local project is regenerated or overwritten.

The [machine-readable source inventory](security-stage-5-native-source-inventory.json) records **16 selected exact Git blob matches, zero mismatches**. Fourteen fetched source texts were byte-verified; local retained `app.js` and `business.js` bytes independently match the current remote Git blobs. These are integrity/source checks, not 16 behavior tests.

`package.json` and the lock root agree: core/Android/CLI 8.5.2, App 8.1.2, Preferences 8.0.1; esbuild 0.28.2. No `@capacitor/ios` platform dependency is declared at the root. That does not prove there is no existing local iOS project. Installed packages, JDK, Android SDK/Gradle compatibility and actual platform versions are unverified.

`scripts/build-capacitor.mjs` constructs a staged `www`, then replaces existing output. It validates listed inputs and bundles the App/Preferences bridge. It must not be invoked for read-only inventory. Existing builder tests use substitute bundler/plugins and temporary directories; their existence is not a new executed test or actual native build.

**Packaging gap:** the fixed copy lists omit `admin-mfa.js`, although `app.js` statically imports it. They also omit `auth.html`, `auth-flows.js` and `auth-security.js`, although current pages link to the Auth page and that page imports those modules. Consequently a freshly generated bundle from this builder would lack required current application resources. This is a source review finding, not an observed installed-device failure. It is assigned to 5.4 compatibility work under existing F05/F14 dependencies; no build or installed APK changed.

`workspace-preference.js` stores account-keyed selection metadata in localStorage and the optional native Preferences bridge. It excludes financial/session properties from the selection record. This is not proof that Auth tokens use encrypted native storage or are excluded from backups. `app-entry.js` uses persisted Supabase sessions and a remote pinned SDK import; selected local cleanup references the project's localStorage session key. Full token/backup/origin behavior remains due at 5.2/5.3.

`docs/LAST_WORKSPACE.md` is historical setup guidance, not confirmation that its native configuration, privacy declaration, sync or device acceptance ran. Its build/install commands are not requested by 5.1.

## Owner handoff and limits

Paste the complete PowerShell metadata block supplied in chat. Its saved counterpart is [the 5.1 inventory script](../../scripts/read-stage-5-native-metadata.ps1), but opening/executing that file is not required. Direct pasting avoids the earlier saved-script execution-policy problem.

The block reads only a fixed set of file/directory metadata, SHA256 hashes, tracked-entry counts, Git HEAD/branch and tool/environment availability booleans. Linked path components are skipped for hashing. It does not print configuration contents, signing material, tokens, environment values, user data or full local paths. Tool availability is not version compatibility. Missing alternate/custom paths remain UNKNOWN; the fixed list is not a complete filesystem/native configuration audit.

The owner checkout may be on main or a different commit with local edits. A mismatch to the audit pin is metadata, not a request to switch branches, pull, reset or stash. The script does not fetch, install dependencies, invoke project scripts, build, sync, sign, install, upload, deploy, contact Supabase or alter files/settings/accounts. It has not been run on the owner's Windows machine or through PowerShell here; no PowerShell runtime is available in this environment.

Return the resulting JSON in chat. After one receipt, reconcile 5.1 and continue the finite plan. If inputs remain unavailable, document that limit once and carry it to final remediation rather than claiming device PASS or requiring repeated setup.

Stage 0–4 objects, 123 original coverage rows, 20 finding definitions, existing retained synthetic fixtures and previous evidence remain preserved. Zero new behavior/build/hosted/device checks ran. No finding is closed, no public declaration is adopted and no production/provider/native release action is performed. Native acceptance remains unverified; the release gate remains open pending required evidence.
