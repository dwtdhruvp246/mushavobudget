# 5.4 — Packaging compatibility candidate and native readiness

## 5.4 corrected owner outcome — 12 October 2026 (S5E09)

**Corrected Windows fixture recheck PASS: 9 PASS / 0 FAIL, exit 0; three syntax checks PASS; Node v22.17.0. 5.4 is complete at corrected source/local/owner fixture scope with actual native compile/device acceptance deferred and carry-forward. Four of five Stage 5 steps have outcomes. Next: 5.5, full report and evidence reconciliation.**

The owner exported pin `a4cdfc98f36494b0e9313e47d2191a30e2c87a8b` into a fresh temporary directory and ran only the offline verifier. [Owner corrected receipt and hash reconciliation](security-stage-5-packaging-owner-recheck.json) records the complete summary. All three code hashes exactly match the published corrected Windows CRLF variants; zero unexplained differences. This is owner-run fixture evidence, not an assistant inspection of the owner native project.

The corrected promotion-failure case now passes as part of the nine-case batch. The previous [8 PASS / 1 FAIL owner receipt](security-stage-5-packaging-owner-checks.json) remains unchanged; its Windows ESM-loader failure is not relabeled or removed. The [test-only correction/local rerun](security-stage-5-packaging-correction-local-checks.json) remains separately recorded. The repaired builder/verifier were unchanged by that correction.

These repeat the same fixture cases, not new distinct controls. The actual builder runs only in temporary fixtures with mocked esbuild/Capacitor imports. Neither successful fixture rollback nor source packaging completeness proves native compile, encryption/backup exclusions, OS callback delivery, merged permission/transport/provider policy or iOS archive compliance. All earlier native concerns continue on final remediation, with no finding closure.

No fresh assistant behavior tests were required for unchanged tested code. Zero hosted/device/native compile checks; no native sync, signing, install, upload, actual root www/project/settings/account/SQL/provider/production or installed APK change. APK update remains deferred.

No rerun, further 5.4 SQL/terminal command or tool setup is needed. Stages 0–4, closed 5.1–5.3 objects, original 123 rows/20 definitions, earlier receipts and retained fixtures are preserved. The latest complete outcome supersedes the historical pending/reopened summaries below. The full Stage 5 report remains due at 5.5.


## 5.4 corrective check — 12 October 2026 (S5E08)

**Owner Windows repeat: 8 PASS / 1 FAIL, exit 1; three syntax checks PASS, Node v22.17.0. The test harness is corrected; local rerun is 9 PASS / exit 0 with three syntax checks. Corrected Windows rerun is pending. 5.4's earlier completion summary is historical; the current checkpoint is reopened for this bounded corrective check. Full report stays at 5.5.**

[Original owner failure and hash reconciliation](security-stage-5-packaging-owner-checks.json) preserves the exact parsed receipt and attachment SHA256. All three owner code hashes exactly match the published Windows CRLF variants, with zero unexplained mismatches. Eight tests passed, including complete Auth/MFA packaging and local imports, missing-input/dependency preservation and bundler failure cleanup.

The ninth test supplied a raw Windows absolute preload path to Node's `--import`. The ESM loader interpreted drive protocol `c:` and rejected it with ERR_UNSUPPORTED_ESM_URL_SCHEME. This stopped before the fault-injection module/build script ran. Thus the Windows result did not exercise promotion rollback; it is a harness compatibility failure, not observed evidence of failed builder rollback. It remains a FAIL in the historical owner receipt and is not relabeled PASS.

The correction imports `pathToFileURL` from node:url and passes `pathToFileURL(preload).href` to `--import`. This is the standard native-path-to-file-URL conversion described in [Node v22.17.0 URL documentation](https://nodejs.org/download/release/v22.17.0/docs/api/url.html); [the same version's CLI documentation](https://nodejs.org/download/release/v22.17.0/docs/api/cli.html) specifies ESM resolution for `--import`. No manual drive/space escaping or Node/version/package-type change is required.

**Only the test file changes.** The repaired builder and verifier bytes remain exact matches to their prior published LF hashes; the Auth/MFA packaging repair is retained. No application/native configuration, owner local builder/project/www/signing identity or installed APK is modified.

[Corrected local receipt](security-stage-5-packaging-correction-local-checks.json): the actual verifier reran the nine temporary-fixture cases and three syntax checks on Node v24.19.0, all PASS. This is another execution of the same case set, not new distinct controls or native acceptance. It verifies file-URL loading/fault-injection/rollback in this Linux environment. Windows execution still requires one corrected owner receipt; no Windows PASS is inferred from the local run.

The next chat block exports the corrected pinned Git snapshot into a fresh temporary directory and runs only the offline verifier. It does not switch/reset/merge the working checkout, install packages, execute SQL, call cap sync/Gradle, sign/install an APK or access actual device/session data. Prior failed receipts and source/readiness evidence remain intact. No live native build/device/hosted action; APK update stays deferred and existing findings stay open.

Stage 0–4 and closed 5.1–5.3 outcomes, original coverage/finding definitions and retained fixtures remain preserved. Resolve this bounded Windows test invocation check before recording the final 5.4 outcome and issuing 5.5. The native compile/device/backup/origin/provider/privacy requirements continue as earlier carry-forward; this correction does not broaden their scope.

## Historical original candidate and initial local outcome — S5E07


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
