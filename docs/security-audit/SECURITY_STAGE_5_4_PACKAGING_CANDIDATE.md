# 5.4 — Packaging compatibility candidate and native readiness

**12 October 2026 / S5E07 — complete at candidate source/local fixture scope, with actual native compile/device acceptance deferred and carry-forward. Four of five Stage 5 steps have outcomes; next 5.5, full report/reconciliation. APK update remains deferred.**

Source parent: `82b30e4197a282c25c427c84052e65bdf0239378`. [Local test receipt](security-stage-5-packaging-local-checks.json). [Source/readiness reconciliation](security-stage-5-packaging-readiness.json). [Finite plan](SECURITY_STAGE_5_NATIVE_PLAN.md).

## Concrete repair

The builder's fixed input lists now include **auth.html, auth-flows.js, auth-security.js and admin-mfa.js**. Current app/business imports and Auth links consequently have the missing resources in newly prepared candidate fixture output. Adding these files also subjects them to the existing preflight source/type checks before replacing output.

Only the build tool's two input-list lines change. App pages, Auth/MFA implementations, workspace selection/authorization, web deployment behavior, native platform configuration and package pins are unchanged. The owner Windows build script is a separate untracked, differently hashed local version; this audit-branch repair does not replace it or update the installed APK.

The output still starts at the workspace launcher; selected pages retain native preference/resume bridge injection and existing browser-install UI suppression. Staged copy/bundle promotion and rollback remain in place. Source completeness at this selected scope is addressed under existing F06, with F05 release/F14 Auth dependencies; no whole finding is closed.

## Meaningful local verification

**9 PASS / 0 FAIL / exit 0; three syntax checks PASS**, Node v24.19.0.

The actual modified builder executes in temporary fixtures. The fixtures substitute only esbuild and Capacitor module imports. They copy the real current web sources/images and use a harmless generated bridge stub. They do not compile Android/iOS, run a real dependency bundle, contact the remote SDK, execute the application's Auth client or touch the real project www.

| Existing/new case | Verified fixture behavior |
|---|---|
| Full bundle / launcher / Business | Auth page loads its selected script; packaged literal local JS imports resolve independently of the builder's input list; local HTML resources resolve; launcher/bridge ordering, browser-install suppression and unchanged source pages remain checked |
| Missing dependencies | Previous complete output remains intact |
| Missing Business asset | Previous complete output remains intact |
| Missing auth.html | Refuses incomplete release; retains previous output |
| Missing auth-flows.js | Refuses incomplete release; retains previous output |
| Missing auth-security.js | Refuses incomplete release; retains previous output |
| Missing admin-mfa.js | Refuses incomplete release; retains previous output |
| Bundler failure | Previous output survives; incomplete staging is removed |
| Promotion failure | Previous output is restored |

Five existing cases are retained/extended, with four new missing-resource cases. The import check covers literal local imports in the packaged root JS files, stripping URL query/hash versions. It is not a full JavaScript parser, a proof of all dynamic resource availability or an actual native WebView test. Remote SDK imports remain outside this offline contract.

Before repair/testing, **41 required source/build/test input blobs** exactly matched the selected Git tree, including seven actual repository image/vector asset blobs; zero unmatched inputs. The [readiness receipt](security-stage-5-packaging-readiness.json) records that parent inventory. The two changed files and new verifier have exact candidate SHA256/Git blob identities and expected Windows CRLF variants in the local receipt. No fake images replace repository assets.

The direct test invocation first passed the same nine cases. The new verifier then repeated that batch to validate its real subprocess/TAP handling and output receipt. This is **two executions of the same nine-case batch (18 case executions), not 18 distinct tests/controls**. The primary reported result remains 9 PASS. Both runs pass; no extra broad regression was needed because application code did not change.

The verifier checks build/test/verifier syntax, invokes only the fixture test file, requires the expected nine passing cases with no skipped/cancelled cases, reports code hashes, and retains explicit false native/hosted acceptance fields. It never invokes the real root project build script directly.

## One bounded native readiness outcome

**DEFERRED / UNVERIFIED WITH CARRY-FORWARD.** This records the requested APK-update deferral and existing prerequisite/evidence limits; it does not disable any app feature.

- Owner checkout remains main at a different source pin with untracked native/config/build work. Preserve app ID **com.mushavo.budget**, signing identity and local edits before later integration.
- Earlier owner checks find no Java/ADB on PATH or JDK/SDK environment values. This is not proof Android Studio or its bundled tooling is absent. Actual JDK/SDK/Gradle versions, clean installed dependencies and compatibility remain unverified.
- No original Windows native project source is overwritten or merged. Final generated assets and merged release configuration are uninspected.
- Native secure session storage/backup exclusions, supported origins/OS callback registration, transport/debug/navigation policy and narrow provider URI sharing remain unresolved at actual artifact/device scope.
- The selected Windows root has no iOS project/manifest/archive evidence. Actual SDKs/reasons/signature/privacy declarations remain due under F17.
- No Android/iOS compile, signing, sync, install, store upload, real-device matrix or provider action is attempted.

These are the same earlier native concerns, not new finding definitions. Completing a fixture packaging repair cannot substitute for them. Stages 6/8/9 retain identity, push and artifact/device evidence; final remediation/full re-audit and release gate stay open.

## Optional owner Windows repeat

No SQL, tool installation, native setup or device/build action is required for 5.4 closure. To independently repeat the nine fixture cases, use the **complete pinned PowerShell temporary-export block provided in chat**. The [offline verifier](../../scripts/verify-stage-5-packaging.mjs) and [test file](../../tests/capacitor-build.test.mjs) require the selected exported web inputs; running the old local builder is not this check.

The export fetches Git objects and writes only temporary files. It does not switch/reset/stash/merge the working checkout, install packages, replace local www/native files, call cap sync/Gradle, sign/install an APK or run account/SQL/provider requests. The Node fixture builder does generate/promote temporary fixture www; that is the exact offline behavior being tested.

Return its summary if you choose to run it. The optional repeat is not an extra prerequisite or a reason to reopen 5.4/hold 5.5. It repeats the same batch and does not add unique controls or native acceptance. If local files use Windows CRLF, reconcile the published variants instead of silently normalizing receipt hashes.

## Outcome and handoff

Existing F05/F06/F10/F13/F14/F17 concerns remain open; the specific missing-resource source gap is repaired only at candidate/local fixture scope. Source/readiness outcome is recorded without further owner setup. Four of five Stage 5 steps now have outcomes. Next **5.5**, full evidence report and final-remediation handoff.

Stage 0–4 objects, closed 5.1–5.3 outcomes, original 123 coverage rows/20 definitions and all prior receipts/retained synthetic fixtures are preserved. No public declaration, native release, live account/settings/SQL/Storage/Auth/provider/production action or installed APK update. Full native security/release acceptance is unverified.
