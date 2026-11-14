# Stage 8 completion report — Notifications and device behavior

**8.4 / 12 October 2026 — CLOSED WITH CARRY-FORWARD. All four finite steps have recorded outcomes.**
Reconciliation source pin: `d5f1081a2ae53e625490e0796c7ddd9eb19e15ee`. This closes the source/local/owner-reported audit checkpoint. **Hosted delivery, installed queue/guard/provider parity, physical-device privacy/cleanup and native push acceptance remain BLOCKED / UNVERIFIED. Zero of 48 planned hosted/device grouped cases ran.**

[Final integrity recheck](security-stage-8-final-recheck.json) · [Eight OPEN actions](security-stage-8-remediation-actions.json) · [Finite Stage 8 plan](SECURITY_STAGE_8_NOTIFICATIONS_DEVICE_PLAN.md) · [Current progress](SECURITY_AUDIT_PROGRESS.json).

## Recorded outcomes

| Step | Recorded outcome | Actual limit |
|---|---|---|
| 8.1 Source/event/device inventory | 53 selected source bytes/Git identities matched; three Edge entrypoints, nine observations, five primary references, eight decisions/actions and 48-case plan recorded | 37 code/config/SQL, 13 test files read not run, three feature docs; no current private console/device/permission proof |
| 8.2 Source candidate/local regression | Business cleanup, current preview redaction, active test/Admin recipients and friendly copy/cache references; final 32 new + 38 selected regression cases = 70 PASS/0 FAIL/exit 0, nine Node syntax checks | Actual selected client/helper/stripped Edge functions with synthetic ports; no installed Deno/provider/database/device acceptance |
| 8.2 Owner Windows repeat | Same 70 PASS/0 FAIL/exit 0, nine syntax checks; 21 hashes reconciled | 13 exact published hashes/eight exact CRLF variants; not 70 extra unique controls |
| 8.3 Bounded readiness | Six prerequisite groups and all 48 hosted/device cases BLOCKED / NOT RUN | No genuine notification, queue/scheduler/provider/device request or configuration inspection |
| 8.4 Full report/reconciliation | 60 current identities/21 consumed byte hashes/seven immutable structured records match; exact 11-path non-document diff with no deletions | Read-only integrity/reporting; zero fresh behavior/syntax/hosted/device execution |

No Stage 8 test failure is recorded. The unimplemented native transport and unverified delivery are existing **F11** evidence/feature gaps, not failed real device tests. Earlier stage failures/reviews, F12's deployed egress requirements and all prior carry-forward remain intact.

## What source corrections were prepared

| Runtime candidate path | Before and resulting behavior |
|---|---|
| business.js | Business sign-out had no equivalent push cleanup. It now attempts current browser-device server-row removal/unsubscribe before local Auth sign-out, with initiating UUID/endpoint filters, Auth epoch checks, repeated-click guard and ten-second cleanup deadline |
| business.html | Business script cache reference v19 advances to v20 |
| app.js | Existing friendly formatter now maps inactive-recipient/current-status lookup failures to clear account-status messages |
| app.html | App script cache reference v114 advances to v115 |
| supabase/functions/_shared/notification-recipient.mjs | New service-side active-profile and current reminder-preview helpers; no new SDK/provider/credentials |
| supabase/functions/send-test-push/index.ts | Authenticated getUser identity additionally requires active profile before subscription/cooldown/send; missing/inactive returns 403, lookup failure 500 |
| supabase/functions/dispatch-admin-notifications/index.ts | Current permitted Admin role additionally requires active recipient profile; inactive cancels, lookup failure uses existing retry path |
| supabase/functions/dispatch-push-reminders/index.ts | Current workspace reminder/preview setting is reread after eligibility/subscription lookup before outgoing payload construction; preview-off redacts saved detailed title/body, disabled/missing reminder cancels and lookup failure cannot fall back to stored private copy |

For example, a reminder queued while detailed previews were enabled could retain a payment name/amount after the setting was disabled. The source candidate now constructs existing generic copy when the current read says previews are off. When detail remains enabled it preserves queued copy/route rather than recomputing finance values. No new recipient/device/workspace privacy policy is adopted.

Successful Business cleanup removes only the initiating account's current endpoint association, unsubscribes that browser, clears an optional badge and, after successful Auth sign-out, forgets that user's remembered opt-in. Unsupported browser/no registration/no subscription does not block sign-out. Cleanup outage/deadline still permits requested Auth sign-out and gives a generic device-settings warning while retaining recovery opt-in. Auth failure is not presented as successful sign-out.

Delayed lookup/result paths check initiating UUID and Auth epoch, including ABA/late Auth and post-deletion switch cases. Timeout invalidates later cleanup continuation. **An already in-flight database/browser/provider operation is not retroactively canceled**, and effective RLS plus explicit initiating-user filters remain essential. Main-app cleanup, forced expiry, revoked permission, provider re-registration and multi-device recovery still require wider direct acceptance.

**Preview revalidation is a read snapshot, not an atomic settings/provider transaction.** A setting change after the read or a notification already accepted/displayed by the OS cannot be recalled by this patch. Actual lock-screen/account-switch privacy, retained notifications and per-recipient/device authority remain required.

## Exact diff and preserved source

From initial Stage 8 source pin `5306aa19adc42654cde1a8f415aa4318a4289321`, the complete non-audit-document diff is **11 paths: eight runtime candidate paths above and three offline paths**, with no deletions.

The offline paths are:

- New `tests/stage-8-notification-boundaries.test.mjs`.
- New `scripts/verify-stage-8-notifications.mjs`.
- Updated `tests/security-stage-2-push-destination.test.mjs` harness.

The existing guard regression retains the same 17 cases/assertions. Its valid actor fixture supplies active profile/current enabled settings and its data-URI loader resolves the actual new shared module. The egress guard implementation itself is unchanged. Three other selected regression files remain byte-identical.

Eight previously tracked paths have intentional replacements; three non-document files were added. The 8.1 inventory and before/candidate hashes remain preserved instead of being rewritten to hide these changes. Script query references advance, but no app release or installed native artifact is adopted.

**No SQL/schema/migration/grant/policy, cron/Vault, package/lock/SDK, service worker/PWA/native builder/native project, finance/proration/currency or membership/role source changed.** The new helper uses existing profiles/settings columns; there is no SQL migration for this source candidate. Source publication establishes no installed configuration/grant/function parity.

## Local evidence counts and verification limits

| Execution | Result |
|---|---|
| Assistant standalone primary | 32 PASS/0 FAIL, exit 0 |
| Assistant first verifier before friendly status/cache additions | Same 70-case suite PASS/0 FAIL, exit 0; eight syntax checks |
| Assistant final verifier, Node v24.19.0 | 70 PASS/0 FAIL, exit 0; nine syntax checks (six JS/three stripped TS) |
| Owner final verifier, Node v22.17.0 | Same 70 PASS/0 FAIL, exit 0; nine syntax checks |
| 8.3/8.4 fresh behavior/syntax/hosted/device batches | Zero |

Assistant history totals **172 case executions, all PASS**; owner adds **70 repeat executions**, all PASS. Combined history is **242 executions/PASS, zero FAIL**, representing a **70-case final suite**, not 242 unique security controls. Explicit historical Node syntax target executions total **26** (eight + nine assistant, nine owner); there are nine final syntax targets.

The final suite consists of 32 new boundary cases: ten shared-helper cases, eleven actual stripped Edge-handler cases and eleven actual Business cleanup/sign-out VM cases. They exercise inactive/missing/error/foreign caller authority, generic/detail/current setting/error/cancel paths, valid source/role/cooldown, current-device filtering, cleanup/Auth failures, account/epoch/ABA changes, deadline late work, repeated clicks and optional badge/storage failure.

The 38 selected regressions comprise 17 existing destination/entrypoint cases, seven worker display/click cases, nine workspace-context SQL/app/diagnostic source cases and five Business billing cases (four client-function VM cases plus SQL containment). These preserve selected egress/route/display/workspace/billing behavior; they do not execute all 13 test files reviewed at 8.1 or the complete app test suite.

The TypeScript stripping API warning is non-failing and retained by actual scope. Assistant primary/regression flags are true; owner's primary/parent warning is observed, while its selected-regression flag is false. That variation is not a source mismatch or failure.

[Assistant receipt/history](security-stage-8-notification-local-checks.json) and [owner receipt/reconciliation](security-stage-8-notification-owner-local-checks.json) remain immutable. The primary harness executes real selected source with synthetic Auth/DB/browser/transport callbacks; it does not verify actual tokens, hosted RLS/roles/MFA, browser unsubscribe or provider delivery. Three TS files are stripped and parsed by Node, **not actual Deno dependency resolution/bundle/typecheck or installed Edge execution**. The destination regression retains its controlled guard/Agent fixtures, not new real provider acceptance.

## Final integrity reconciliation

The [recheck](security-stage-8-final-recheck.json) records **60 distinct current input identity matches**: 45 original 8.1 targets unchanged, eight known 8.2 replacements within the original inventory and seven additional selected/added current targets. All 21 consumed bytes match their current Git identities and assistant SHA256 values. Other source identities are current Git metadata checks, not 60 new byte reads.

Owner values resolve to **13 exact published-byte matches and eight exact LF-to-CRLF variants**, zero unexplained difference. Arbitrary normalization is not accepted as a match. Each original 48-case ID/expected result still matches the frozen matrix and 8.3 per-case readiness receipt.

Seven structured records retain their published bytes/identities: source inventory, decisions, frozen matrix, candidate contract, assistant receipt, owner receipt and readiness receipt. Eight action definitions/findings/owners/rechecks remain unchanged and OPEN. Original **123 coverage rows and 20 finding definitions**, Stage 0–7 progress, completed 8.1–8.3 objects and S8E01–S8E04 events remain preserved.

No code drift or unresolved local failure justified a fresh behavior rerun at closure. This reconciliation provides no current dashboard/device/OS/provider/log/artifact/deployment probe. Offline `candidate_deployed=false` describes the local evidence boundary, not a new deployment observation.

## Hosted/device readiness and unimplemented requirements

All eight ND groups contain six planned cases: permission/channel/native transport; device/account lifecycle; private display; server recipient/event guards; outbox/scheduler/egress/recovery; click/identity routing; PWA update/offline/device state; isolated platform/operations/release. **All 48 remain unrun and BLOCKED at readiness scope.** These are not 48 failed notifications, disabled accounts or newly broken devices.

Six prerequisite groups remain:

1. Exact isolated installed frontend/Edge/shared helper/schema/RLS/grants/roles/key/settings parity.
2. Accepted native transport/SDK registration/permissions/capabilities/app identity/provider configuration and final artifact.
3. Recoverable staged own/foreign/staff/removed/suspended identities and a real browser/PWA/native physical matrix.
4. Accepted preview authority, device/account/event/display/retention and partial-delivery/retry/claim/update decisions.
5. Actual queue concurrency/reclaim/result failure/scheduler/Vault/installed guard/runtime/provider acceptance and separate OS display.
6. Operations/retention/deletion/disclosures/private role configuration/recovery/rollback and release evidence.

The [8.3 checkpoint](SECURITY_STAGE_8_3_READINESS_CHECKPOINT.md) and [per-case receipt](security-stage-8-notification-readiness.json) give exact dependencies and concrete completion evidence. Browser/PWA/server groups need their own deployment/actor/behavior proof; they are not blocked only because native integration is absent.

Native push transport/SDK/provider registration remains unimplemented in this candidate. The selected native bridge supplies App/Preferences, and PWA worker registration skips detected native context. Shared browser notification code does not establish FCM/APNs delivery, merged permission/capability or actual native background behavior. Earlier owner PC/phone smoke and Stage 2's local Node/Deno/bundle results retain their dates/scope; no current private provider/device or historical empty-key state is certified here.

Claim-generation ownership and late workers, partial-device success policy, ambiguous accepted-send/result failure, actual recurrence/timezone/paid/paused/removed states, provider retirement, genuine F12 DNS/TLS/proxy/redirect runtime compatibility and monitoring/recovery remain unaccepted. Queue dedup/notification tags cannot promise exactly-once OS display or user acknowledgment.

All eight ND decisions remain unconfirmed. Source generic defaults/valid optional detail and server-side scheduling are preserved; no new native SDK/provider/registration schema/minimum OS, local reminder scheduler, privacy authority or OTA policy is selected. Prior primary-reference review remains at 8.1 scope, not app/store/device approval.

## Eight OPEN actions and required rechecks

All actions are owned by **Both**: developer prepares accepted code/source and owner retains private configuration/provider/device control; genuine acceptance is jointly evidenced. They carry to final remediation and Stage 9 regression/Stage 10 release gates with original assigned dependencies preserved.

| Action | Existing findings | Completion still required |
|---|---|---|
| ND-R01 Native transport/permission/registration | F11/F05/F17/F20 | Select/implement accepted bridge/provider registration and permission/capability handling; real signed artifact/device/provider matrix, ND01/ND08 |
| ND-R02 Account/device lifecycle | F11/F14/F15 | Business source correction retained; wider main/forced logout/permission/re-registration/account race/retention policy and own/foreign/multiple-device real cleanup/outage cases, ND02/ND08 |
| ND-R03 Private display/queued previews | F11/F20 | Current-read redaction retained; accepted preview authority, actual queued transition/lock-screen/account switch/retained notifications/disclosures/retention, ND03/ND08 |
| ND-R04 Recipient/auth/event assurance | F11/F08/F15 | Active-recipient source correction retained; direct installed Auth/origin/cooldown/cron/roles/MFA/suspension/paid/removed/settings/invitation cases, ND04 and earlier AU/AM/Business requirements |
| ND-R05 Queue/scheduler/egress/recovery | F11/F12/F15/F19 | Actual concurrent/reclaim/stale-worker/result-failure/partial-device/ambiguity/timezone/provider/cron recovery and installed guarded transport compatibility, ND05/ND08 |
| ND-R06 Reauthorized click/workspace intent | F11/F10/F14/F15 | Genuine own/foreign/stale/deleted/Admin/MFA/old-account/cold/native-return routing and current session/source permission checks, ND06 with IE/NR/AU dependencies |
| ND-R07 Private update/offline/device state | F11/F07/F14/F17 | Actual old/current worker/multiple-tab/update failure/private-cache/offline/dirty-work/resume/native bypass/final artifact behavior, ND07/ND08 |
| ND-R08 Controlled platform/ops/final proof | F11/F12/F05/F17/F19/F20/F02 | Exact isolated configuration/actors/device matrix, delivery/privacy/cleanup/provider/retention/monitor/recovery/rollback and final signed artifact/declarations/full re-audit, ND08 and relevant groups |

The practical remaining risk is that source PASS does not establish current rightful-device delivery or lock-screen privacy: stale associations, in-flight accepted content, unbound claims/partial-device semantics or unimplemented native registration can still yield wrong/unproven behavior. Current source fixes reduce demonstrated source gaps but close no original finding. Earlier authorization, Auth/native returns, device backup/session storage, deletion/retention/audience/disclosures, commerce and operational work remain required.

**F11/F12 and related original findings remain OPEN.** Release gate stays **OPEN_PENDING_REQUIRED_EVIDENCE**. Stage closure implies no universal device/store/security acceptance or permission for provider/native/production rollout.

## Preservation and Stage 9 handoff

No real notification, permission prompt, device subscription/registration, provider/key/SDK/cron/Vault activation/change, account/fixture/two conversion/SQL/Auth/Storage mutation, production promotion or native build/sync/install/sign/upload was performed in Stage 8. Runtime changes are source candidates on the audit branch. Production `kttkospkblwvguuwnhjj` remains excluded from these mutations; later authorized genuine checks must bind isolated `dczlddwbtgvfdujgcitb`, exact installed source/settings and recoverable controlled actors/devices. Raw credentials/endpoints/registration identifiers/customer payloads stay private. APK update remains deferred.

**No owner SQL, terminal, setup, rerun or file-opening action is required for 8.4.** The earlier complete temp-export PowerShell repeat was received and reconciled.

**Next is 9.1 — broad regression and release-evidence inventory, with a finite Stage 9 plan before execution.** Reconcile staged app/finance/permissions and all carried-forward acceptance prerequisites, existing local suites/known source changes, performance scope, native/signing/SDK/data declarations, store accounts and external testing evidence. Source/local/owner/deployed/device results must remain distinct; do not replace missing direct security/device cases with more fixture counts.

After remaining audit stages, consolidate accepted remediation, obtain missing hosted/native/device/store/recovery evidence and run a fresh full audit of final source, deployments and artifacts. Stage 8 is closed as a recorded checkpoint; all unproven requirements remain on that worklist.
