# Stage 5 completion report — Native security and compatibility

**5.5 / 12 October 2026 — CLOSED WITH CARRY-FORWARD. All five finite steps have recorded outcomes.**
Reconciliation source pin: `967081fa3ae06ef3dad9b02ba24725aafb5a698c`. This is an audit checkpoint closure at source, synthetic/local fixture and owner-reported source-configuration scope. **Actual native security/release acceptance remains DEFERRED / UNVERIFIED; zero hosted/device/native compile/archive acceptance checks ran. APK update remains deferred.**

[Final integrity reconciliation](security-stage-5-final-recheck.json) · [Seven OPEN native remediation actions](security-stage-5-remediation-actions.json) · [Finite Stage 5 plan](SECURITY_STAGE_5_NATIVE_PLAN.md) · [Current progress](SECURITY_AUDIT_PROGRESS.json).

## Recorded outcomes

| Step | Outcome | Practical limit |
|---|---|---|
| 5.1 Existing native/build inventory | Complete at tracked-source and one owner Windows metadata scope; 16 source identities recorded; 24 owner paths (11 files/3 directories/10 missing) | Original Windows project is untracked/on a different main commit; actual toolchain/dependencies/build remain unverified |
| 5.2 Session storage/backups | Source and 10 existing workspace-selection VM PASS; owner main manifest reports allowBackup=true and no rule references | No inspected native secure Auth adapter; merged backup rules and actual stored/copied tokens unverified |
| 5.3 Origins/permissions/privacy | Source and 11 existing synthetic callback PASS; public app identity/config/permissions/provider paths reported | Main source lacks native callback filters; effective origins/transport/debug policy, narrow URI grants and iOS archive evidence unresolved |
| 5.4 Packaging/readiness | Four missing Auth/MFA resources added to builder; corrected nine-case fixture batch passes locally and on owner Windows; three syntax checks PASS | Mock build dependencies; no actual dependency/native compilation or device acceptance; owner local builder/APK not replaced |
| 5.5 Report/reconciliation | 50 distinct current Git blob identities and current/historical code receipts reconcile; seven concrete OPEN remediation actions | Read-only evidence review; no fresh behavior tests, platform settings or release acceptance |

The initial owner Windows repeat was **8 PASS / 1 FAIL, exit 1** because the test's raw preload path was rejected by Node's ESM loader before promotion rollback was exercised. The test now passes a file URL. The corrected owner repeat is **9 PASS / 0 FAIL, exit 0**. Both receipts remain intact; the original failure is not erased or relabeled.

## Evidence counts and meaning

| Evidence | Recorded execution outcome |
|---|---|
| 5.2 assistant workspace selection VM batch | 10 PASS; synthetic localStorage/mocked Preferences |
| 5.3 assistant selected Auth callback batch | 11 PASS; synthetic links/mocked Auth |
| 5.4 assistant original direct fixture run | 9 PASS |
| 5.4 assistant original verifier validation | Same 9 cases PASS again; three syntax checks |
| 5.4 assistant corrected preload/verifier rerun | Same 9 cases PASS after test-only correction; three syntax checks |
| Owner initial Windows fixture repeat, Node v22.17.0 | 8 PASS / 1 FAIL; three syntax checks PASS |
| Owner corrected Windows fixture repeat, Node v22.17.0 | 9 PASS / 0 FAIL; three syntax checks PASS |
| 5.5 fresh behavior/syntax/hosted/device/native checks | Zero |

The three primary latest local batches total **30 case executions (10 + 11 + 9)**. Across the recorded assistant repeats, there were **48 successful case executions**; those repeats do not create 48 distinct tests or security controls. Owner history contains **18 executions of the same nine-case batch: 17 PASS and one preserved harness FAIL**, followed by the successful corrected batch outcome. Six historical assistant syntax-check executions and six owner syntax-check executions repeat the same three packaging files; they are not twelve different syntax targets.

Earlier source-integrity counts (16, 10, 12 and 41) overlap. The final union plus candidate verifier is **50 distinct current source/test/build-input paths**, not their arithmetic sum as independent coverage. Metadata inspection and code-hash checks are not behavior tests.

The 5.2 initial partial-scratch invocation found no test file and ran zero cases before the pinned file was fetched; this is recorded in its receipt. The 5.3 non-failing Node module-type detection warning remains recorded. Neither is hidden or converted into native acceptance.

## What changed in the repository

The actual bundle builder's two input-list lines now include **auth.html, auth-flows.js, auth-security.js and admin-mfa.js**. Selected current app/business imports and Auth links resolve in the fixture's prepared bundle, and missing required inputs fail before old output is replaced.

The packaging test checks literal packaged local JS imports independently of the builder list, retains prior launcher/Business/resource checks, adds missing-resource preservation cases, and keeps bundler/promotion-failure rollback checks. The Windows correction changes the test preload argument to a file URL; the builder and verifier remain unchanged by that correction.

One offline verifier and three read-only owner metadata/configuration collectors were added. Relative to Stage 5's initial pin, the complete non-document diff is six audit/build/test files: the builder, fixture tests, verifier and three collectors. No root application HTML/JS, Auth/MFA implementation, Business/finance behavior, SQL/Edge functions or dependency manifest/lock code is changed by Stage 5. No existing tracked files are deleted.

The builder repair is **candidate/local-scope completion of a specific F06 packaging gap**. It does not close all of F06 or prove that the user's differently hashed untracked local builder includes the repair. No owner project/native configuration, app ID, signing identity, local www or installed APK was overwritten.

## Source and owner configuration findings

**Actual baseline:** owner's Windows checkout reports main at `2aa668451a8e743dafb3768261175c51a215205e`, different from the audit pin. Four common source files differ, including the local builder. Android/Capacitor JSON exist but are untracked. Their integration must preserve local work and signing/app identity. Java/ADB were not discovered on PATH, and JDK/SDK environment values were absent; this does not establish whether Android Studio supplies tooling elsewhere. Version compatibility is unverified.

**Identity and configuration:** owner reports app ID **com.mushavo.budget** and webDir=www. The selected main manifest requests INTERNET only; dependencies/variants/final merged permissions are uninspected. MainActivity has a MAIN/LAUNCHER filter and exported=true; launcher export alone is not an exposure finding.

**Sessions/backups:** selected ordinary clients have no inspected native Auth storage adapter; the selection Preferences bridge does not store or protect Auth credentials. Owner main manifest reports allowBackup=true, both fullBackupContent and dataExtractionRules UNSET, no custom BackupAgent and no referenced backup XML. This is a source-configuration gap, not proof of stolen/copied tokens or unencrypted device disks. Actual OS stores, migration, crypto-key behavior, backup modes/exclusions and restore/transfer identity boundaries remain unresolved.

**Origins/callbacks:** selected invitation functions require an exact nonempty Origin match to APP_ORIGIN and separately verify identity/authorization. Current-origin callback helpers and selected App resume hooks do not establish OS link delivery or system-browser/WebView verifier handoff. Owner main source has no VIEW/BROWSABLE callback filters. Final merged registration, actual native origins, server redirect policy and real cold/warm/replay/expiry behavior remain unverified. Required support must retain JWT/identity/role/MFA/tenant enforcement, not relax origins broadly.

**Transport/navigation/debugging:** owner reports the selected server schemes/hostname/URL, mixed-content/cleartext/debug/logging fields and main manifest transport/debug attributes as UNSET. This is not false or an effective safe/unsafe verdict; actual installed versions, defaults, generated assets, target API and release overrides remain uninspected. The collector's ['UNSET'] navigation sentinel is not accepted as a usable allowed host or a confirmed enabled navigation rule. Web deployment headers are not verified native WebView policy.

**File sharing:** FileProvider is non-exported with grantUriPermissions=true, referencing file_paths.xml. Both external-path and cache-path use '.', a broad path range. Their image labels do not narrow the directory ranges. Actual URI creation, granted recipient/read-write access, reachable data and cleanup are uninspected. Narrow the feature-specific sharing scope and verify valid/hostile grant behavior under existing native/F13 file-handling requirements. No unauthorized URI disclosure/overwrite was demonstrated.

**iOS/privacy:** the selected root has no iOS project/archive evidence. Root App/Preferences/core dependency declarations and documented UserDefaults reasons are not actual target inclusion or full SDK inventory. Actual Info.plist/entitlements/privacy resources, required reasons/data facts, applicable SDK provenance/signatures and final archive report must be verified under F17/F20. Stage 4 public notices remain unadopted/unpublished; no store privacy declaration is certified by Stage 5.

## Final reconciliation

The [machine-readable recheck](security-stage-5-final-recheck.json) compares source-receipt targets with the complete current Git tree. **50 current Git blob identities match, zero unexpected drift.** Seven historical observation rows differ only in the intentionally updated builder/test paths. This is metadata/receipt reconciliation, not a new byte-read of every native/application file or a new full security audit.

Three current code files were freshly fetched and byte-hashed against the corrected candidate receipt. The original test variant was also fetched at its exact earlier pin. The **six owner code-hash values** across failed/corrected batches match the appropriate published **CRLF variants** (four distinct hashes); zero unexplained differences. Owner native-source metadata correlations remain owner-reported, not independent assistant reads of local Windows files.

Original **123 coverage rows and 20 finding definitions** remain unchanged. Stage 0–4 structured outcomes, closed 5.1–5.4 step objects and all earlier receipts are preserved. Final reports add current summaries while retaining historical states. No fresh test rerun was warranted by this unchanged-code reconciliation.

## Seven final-remediation actions

These are action entries linked to existing findings, **not seven new finding definitions**. Every action remains OPEN; [the structured action index](security-stage-5-remediation-actions.json) defines concrete work and evidence.

| Action | Existing findings | Required completion |
|---|---|---|
| NR-R01 Actual baseline | F05/F06 | Preserve identity/local native work; reconcile sources/generated assets and accepted locked toolchain/build inputs |
| NR-R02 Native credentials | F14 | Inspect and protect actual sensitive stores; implement/verify migration, failure, expiry, switch/logout/key/update behavior |
| NR-R03 Backup/transfer | F14 | Implement correct final exclusions/policy and verify sensitive-data absence across supported backup/restore/transfer modes |
| NR-R04 Origins/callbacks | F10/F08/F15 | Precise server/native origins and registered validated links; real state/verifier/identity/lifecycle tests |
| NR-R05 Platform/file scope | F05/F13 | Final least-required permissions, transport/debug/navigation and narrow FileProvider/grants/cleanup, preserving valid features |
| NR-R06 iOS privacy archive | F17/F20 | Actual SDK/target/data/reasons inventory and applicable manifest/signature/archive privacy evidence |
| NR-R07 Release/device proof | F05/F06/F17 | Compile/inspect/sign final artifacts, preserve update identity, run device matrix and assigned Stage 9/10 release evidence/full re-audit |

The action index is part of the existing final residual resolution/full re-audit workflow. It preserves earlier Stage 3 authorization/Auth and Stage 4 lifecycle/file/privacy actions. Source/mock outcomes do not supersede required actual evidence.

## Stage 6 handoff and release gate

Next **6.1**, bounded source/decision inventory for **identity and email workflows** under the established roadmap: Google/Apple login decisions/configuration, linking/invitation collision handling, confirmation/recovery/callback compatibility and proposed shared email architecture. Preserve working SMTP and existing synthetic identities; provider activation, new mail dispatch or account mutation is not implied by the handoff. Native callbacks remain a dependency; Google/Apple implementation was not performed in Stage 5.

Stage 5 is closed as a finite audit checkpoint with carry-forward. All original findings remain as recorded; no finding is closed here. Release gate stays **OPEN_PENDING_REQUIRED_EVIDENCE**. Final remediation, accepted integration, actual staged/native/device/store checks and fresh full re-audit remain required before release.

No owner SQL, terminal rerun or further Stage 5 setup is needed. No native sync/build/compile/sign/install/upload/store publication, actual backup/credential inspection, live account/fixture/Auth/Storage/SQL/settings/provider/email/job/production action or installed APK update was performed. The two retained manual conversions and earlier Personal/Family/Business fixtures remain unchanged. No native/device acceptance badge is inferred from checkpoint closure.
