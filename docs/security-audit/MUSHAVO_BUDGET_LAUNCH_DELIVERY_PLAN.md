# Mushavo Budget — launch delivery plan
Version 1 • 28 October 2026 • Planning reset requested by the owner

## 1. What this plan fixes

The previous reporting followed technical audit steps and individual test observations without a sufficiently clear route, workload budget or forecast to public launch. Completing W or Z was not the end of the project. Several earlier “closed” audit stages were reviews with unfinished implementation or acceptance carried forward. Those labels must not be presented as completed launch features.

This is one launch-level delivery plan with seven deliverables. Existing finding definitions, the original 31 W scenarios, prior results and source history remain intact. The seven deliverables group existing work; they do not add seven new audit stages. Feature exclusions below are proposals requiring the owner's launch-scope choice, not silently applied scope reductions.

**Current implementation checkpoint:** Stage 3 authorization remediation / FR.2 / Batch W. Latest recorded evidence: FRE285 at source parent ca6eb643adac1252c35f9d7392a2df9be89334ee. W67 recovery save/sign-in instructions are prepared; their results have not been supplied. The latest completed owner observation is AU04.06 recovery identity, clean URL and original-dashboard isolation.

**Target on record:** December 2026, with no confirmed day or commitment to simultaneous web, Google Play and Apple App Store release.

## 2. Current position — what is actually accepted

- FR.1 selected staging static serving has a scoped completion receipt, with wider deployment/release issues carried forward.
- Personal and Business finance/authorization work has earlier scoped live passes. Reuse applicable results; do not repeat all those workflows from the beginning.
- Current password-only sign-in, signed-in password change/new-password login, normal saved-session reload, normal shared-tab sign-in/sign-out/re-sign-in and the latest before-save recovery isolation have owner observations at their recorded scopes.
- W remains open. Invitations and several password/recovery/session failure variants still need acceptance. There are eight invitation scenario groups without accepted W workflow outcomes: five Admin cases historically blocked by V and three Business cases pending.
- V remains on hold and needs reconciliation with the owner's later password-only policy. X, Y and Z remain in the authorization delivery path.
- FR.3–FR.7 are not accepted for launch. Some reviewed source or local candidates exist; “not accepted” does not mean every component must be written from scratch.
- FR.8 fresh final audit/release disposition has not been performed. No release approval, native artifact acceptance or store approval is inferred.

The 20 original findings, 123 coverage rows and 61 later coordinating actions overlap. They are traceability records, not 204 independent development tasks. This plan consolidates the overlapping work instead of adding their counts together.

## 3. Launch choices and estimating assumptions

### Scenario A — web/PWA first (recommended route to an earlier usable release)

Release the existing core budgeting/workspace offering through the web and installable PWA after its required acceptance. Retain current core Personal/Family/Business scope in the estimate; do not quietly drop Business to make the date look better. The allowance includes one agreed web payment/entitlement approach if paid plans are offered.

Native store distribution and new Google/Apple sign-in are proposed later-channel work for this scenario. Existing public promises, displayed options and signup/payment flows must match what actually ships. If a deferred feature remains exposed or required by the actual channel/product, its applicable requirements stay on the launch path.

### Scenario B — the full currently listed web + Android + iOS roadmap

Complete Scenario A's shared backend/product work plus final native builds/device evidence, native commerce/restore where applicable, Google/Apple identity/linking as retained in scope, and publisher/store preparation. This is not three copies of the same backend project.

### Basis of both estimates

These are **initial, low-confidence engineering planning allowances**, not a measured backlog quotation or a launch promise.

- One effective engineering workstream, about six productive build/test hours per working day, five working days per week.
- The existing code and scoped passes can be reused; no major architectural rewrite or new feature family is added.
- Owner answers and account/configuration prerequisites are available within one working day. Plan for approximately 45–60 minutes per grouped hands-on session, usually two or three sessions in an active test week; policy/setup decisions may need separate time.
- Needed test identities, inboxes, payment sandbox, publisher accounts and representative devices can be supplied. Their current availability is not assumed verified.
- Relevant independent preparation can overlap, but no parallel staffing or unattended background work is assumed. Chat-based execution only progresses while a work session is active.
- Repair/retest contingency is shown separately. A major new defect, scope change or unavailable external prerequisite requires a visible reforecast.
- Provider/account/testing/review waits and public holidays are additional calendar constraints, not hidden inside “development done.”

If active engineering time is only two hours a day, rather than six, the effort does not disappear: the development calendar can be roughly three times longer before other waits.

## 4. Seven deliverables to launch

All day ranges are active engineering days, including applicable implementation and testing. Owner waiting time is excluded. The final buffer below is additional; do not charge the same fix against two rows.

| Deliverable | Remaining work | Done means | Main dependency | Allowance | Existing map |
|---|---|---|---|---:|---|
| 1. Accounts, permissions and finance access | Finish W; reconcile V with current policy; finish remaining X/Y role, legitimate-finance, caller-permission and real-race checks; Z authorization reconciliation | Intended users can sign up/sign in/recover/use their allowed workspace; wrong/removed/unauthorized callers are denied; required session/invitation failures and cleanup are resolved | Controlled accounts/inboxes, exact installed source, privileged policy reconciliation | 6–10 days | FR.2; remaining V/W/X/Y/Z |
| 2. Files, deletion and factual privacy | Trusted upload/object checks; deletion request/job/status; shared ownership/transfer; retention rules; factual privacy/terms/support/deletion pages | Harmless allowed files work, forged/oversized/foreign access fails; an actual disposable-account deletion and partial-failure retry preserve others' data; notices match implemented behavior | Owner's operator/audience/retention facts; disposable fixtures | 4–7 days | FR.3; DL/UF/PR |
| 3. Jobs, backup and operations | Relevant reminders/FX/push/job success/failure/retry; recipient/destination controls; alerts/support; database/files/config protection and isolated restore; rollback | Actual controlled jobs and alert delivery observed; complete required recovery demonstrated; stop/resume/rollback and responsible operator documented | Recoverable operators, safe destinations and recovery target | 3–5 days | FR.4 and relevant OP/ND/RG |
| 4. Release identity and email | Verify current email templates, confirmation/recovery/invitation delivery, identity binding and web callbacks; reconcile duplicate requirements with W | Actual intended recipients and safe links/copy; no wrong-identity adoption, leaked tokens or conflicting account behavior | Deliverable 1 and working notices | 2–3 days | Web portion of FR.5 |
| 5. Web payments and entitlements | Confirm launch catalogue/channel; authoritative payment proof or the agreed reviewed manual process; access expiry/renewal/cancellation/refund/replay; household/Business seat binding | Launch payment and entitlement lifecycle demonstrated end to end; frontend cannot grant paid access; current finance unaffected | Product/payment decision, server controls and sandbox/controlled fixtures | 3–5 days | Web portion of FR.6 |
| 6. Web/PWA quality and public delivery | Representative phone/desktop/browser tests; install/update/offline behavior; remaining functional UX/accessibility; production HTTPS/headers/contact abuse controls and correct delivery mapping | Required core workflows usable on launch devices; no wrong cached account; correct routes/headers/contact outcomes on release candidate | Accepted product/backend behavior | 2–3 days | Web parts of FR.1/FR.7; F07/F09 |
| 7. Final release audit and rollout | One frozen release candidate; fresh applicable full audit/regression including unchanged areas; resolve blocking defects; exact release/rollback/support package; owner release decision and staged rollout | Required launch findings resolved or legitimately dispositioned; accepted artifact/configuration known; tested recovery/rollback; explicit release decision | All required launch deliverables | 3–5 days | FR.8 and launch-scoped RG/OP |

**Web/PWA base: 23–38 days. Repair/retest allowance: approximately 6–10 days (25%, rounded up). Total: 29–48 working days, approximately 6–10 working weeks.** The contingency is a planning reserve, not evidence that the remaining implementation is fully understood.

## 5. Finish W in four grouped packs

The [31-case remaining checklist](SECURITY_FR_2_5_BATCH_W_REMAINING_CHECKS.md) remains the detailed scope. Grouping does not convert a partial case to PASS. Do not repeat the accepted shared-tab or recovery-isolation checks solely because this plan changed.

| Pack | Existing work to finish | Owner interaction | Allowance |
|---|---|---|---:|
| W1 — password and recovery completion | Complete the current recovery save/adoption/new-password outcome; remaining applicable old-password, direct server boundary, wrong/expired-session and retry evidence; reconcile actual reauthentication policy | One coherent password/recovery session where prerequisites permit; do not re-open consumed links or repeat uncertain writes | 0.5–1 day |
| W2 — confirmation and generic email behavior | Final confirmation destination, existing-email/resend behavior, actual relevant generic/rate responses; reuse earlier signup/pending/unconfirmed-denial observations | One bounded inbox/account session and one results checklist | 0.5–1 day |
| W3 — invitations | Three Business and five Admin scenario groups, intended recipient, explicit setup, wrong/expired/cancelled/replaced/replayed invitations and retries | One prepared controlled-actor/invitation pack, with private values kept local; dependent actions remain sequential | 1–2 days |
| W4 — session failures and closure | Actual refresh/invalid refresh, push/Auth sign-out failures, in-flight/Business state clearing, supported Auth rate/stale-token behavior and exact cleanup | Prefer automated controlled tests/collection; one grouped owner browser review for behavior automation cannot establish | 1–2 days |

**W allowance: 3–6 active engineering days**, within Deliverable 1's 6–10 days. The remainder of Deliverable 1 has a rough 3–4-day allowance for V policy/actor reconciliation, affected remaining X/Y evidence and Z closeout, reusing earlier finance passes. These are particularly uncertain until the exact current installed matrix and actor readiness are checked. If they cannot fit, publish the revised estimate and cause; do not keep extending the pack without telling the owner.

**V policy reconciliation is an early task.** The owner explicitly removed custom sign-in codes and trusted-browser requirements for all app users, including Admins. Do not reintroduce them or automatically restart authenticator setup. Reconcile the remaining privileged-role/recovery/invitation requirements with that decision; preserve the old stronger-assurance criterion as historically unmet or explicitly revised, not falsely passed. Clarify only a genuinely unresolved policy choice, not the already-decided password-only rule. Provider/operator account protection and recovery need their actual scope reviewed separately.

## 6. Extra work for the full native/provider roadmap

These increments are additional to the shared web estimate. Confirm exact channel requirements and current publisher-account state during the initial inventory; no unverified store rule or guaranteed review period is asserted here.

| Additional deliverable | Required finish | Extra days |
|---|---|---:|
| Provider identity/linking | Retained Google/Apple login, web/native callbacks, existing-account collision/linking, cancellation/revocation and invitation interaction | 3–5 |
| Native commerce | Applicable Android/iOS purchase verification, restore/refund/expiry/replay, ownership and cross-channel entitlements; actual sandbox results | 5–8 |
| Native builds and devices | Preserve owner signing/project identity; Android/iOS reproducible release artifacts, secure sessions/backup, deep links, push/permissions, real representative-device tests | 8–12 |
| Publisher/store package | Actual SDK/privacy evidence, truthful listings/declarations, reviewer access and account-specific release/testing prerequisites prepared | 2–4 |

Extra base: **18–29 days**. Combined web + native/provider base: **41–67 days**. With approximately 25% repair/retest reserve: **52–84 working days, about 10–17 working weeks**. Account enrollment, any required testing periods, provider approval and store review waits are **additional and currently unestimated**. Submission readiness and public store availability are different milestones.

## 7. Calendar scenarios — conditional, not committed dates

Illustration only: work starts **29 October 2026**, progresses at the assumed five-day cadence, and excludes public holidays and external waits.

| Scenario | Engineering allowance including reserve | Illustrative engineering finish |
|---|---:|---|
| Web/PWA first | 29–48 working days | 8 December 2026 – 4 January 2027 |
| Full listed web + Android + iOS/provider roadmap | 52–84 working days | 8 January – 23 February 2027, then any remaining external waits |

The existing December target is **possible for a web release at the lower end** of this preliminary estimate. Current evidence does **not** justify promising all channels in December. Earlier finish requires verified reusable implementation, more effective capacity or an explicitly smaller first release; it cannot be obtained by relabelling pending checks as completed.

Confidence is low because the later work has not been fully sized against final installed code, scope and accounts. Re-estimate after the first two grouped work sessions using observed throughput and resolved prerequisites. Replace these allowances with measured remaining task effort; do not simply subtract calendar days.

## 8. What can move after first launch

These are proposed sequencing choices; no feature is removed by this document.

- For Scenario A: Android/iOS store distribution and the new provider-login integrations can be a subsequent channel release, provided the launched web product and its promises do not depend on them.
- Cosmetic polish, optional animation and nonessential performance refinement can follow release when core usability/accessibility and correct error feedback are adequate.
- Additional uncommitted features and speculative edge-case expansions require a visible scope decision.
- Paid commerce requirements can leave the first-release path only if the owner deliberately chooses a non-paid launch and the paid UI/access expectations are adjusted and checked. This plan otherwise includes a web commerce allowance.

**Do not defer a required launch control merely to meet the date:** correct account/tenant/role isolation; safe working authentication/recovery; applicable deletion/shared-data behavior and factual notices; required trusted file controls; protected backups and demonstrated recovery; accurate payment/entitlement behavior if money/paid access is offered; final applicable audit and recoverable rollout.

## 9. Decisions and prerequisites to settle early

Collect these once in a short setup checklist; reuse answers rather than rediscovering them during each test:

1. First release channel: web/PWA first or the full native/provider scope; exact core features and paid/manual payment behavior.
2. The owner's feasible active-session/test cadence. No daily availability is currently confirmed.
3. Existing Android/iOS publisher/account/build/device readiness, if retained in first release. Start account/readiness work early; do not wait until native testing to discover missing access.
4. Remaining factual operator/contact/audience/retention/shared-ownership choices for implemented notices/deletion. This is a business-facts decision list, not legal conclusions or invented retention periods.
5. Payment provider/catalogue/sandbox readiness if paid access is in scope.
6. V's remaining work under the already-chosen password-only policy and the availability of distinct recoverable controlled actors.

Unknown is a recorded dependency, not a reason to repeat known setup or request a new credential. No production change, paid purchase, message dispatch, role/factor mutation, store submission or native rebuild is authorized solely by this plan.

## 10. Working rules from the next session

- Start each update with the current **launch deliverable**, its remaining work and any change to the forecast. Keep old stage/FR/batch IDs as traceability, not the only explanation of progress.
- Before a work pack starts, give its fixed scope, affected files/settings, expected owner actions, stop conditions, completion evidence and time allowance.
- Prepare related fixes and meaningful local checks together. Use one coherent deployment per affected pack when possible, not an upload for every successful observation. Preserve necessary dependency/approval boundaries.
- Use **https://mushavo-budget-staging.pages.dev/** for all owner staging tests. Stop creating preview-specific callback chores.
- Automate appropriate source, regression and bounded diagnostic work. Owner Windows checks are for actual platform-specific or hosted requirements, not routine duplicate executions.
- Give the owner a grouped 30–60-minute checklist where practical and accept a single multi-result response. Ask a narrow follow-up only when the missing fact affects the outcome.
- Reuse completed applicable evidence. Re-run when code, configuration, observed behavior or an unresolved concern actually justifies it.
- Keep one status per original case: accepted at stated scope, partial, failed, blocked or not run. Neither a local test count nor a number of messages is launch progress.
- At the end of each pack, report finished deliverables, remaining blockers, owner work next and revised best/likely/worst allowance. If an upper allowance is exceeded, identify the cause and adjustment immediately.
- Every added requirement gets a visible reason, scope and forecast impact. Existing launch blockers are not silently removed to reach an endpoint.
- Keep the final release review concrete: exact accepted source/artifact/configuration, required results, unresolved risks, monitoring, rollback and accountable owner decision.

## 11. Immediate next two work sessions

**Session 1 — freeze launch scope and reconcile the backlog.** Use this document as the launch dashboard. Confirm the one channel decision that materially changes the schedule, reconcile the obsolete Auth/V requirements, check later-stage prerequisites, and map the seven deliverables to the existing acceptance records. Prepare W1 and W2 as coherent packs. The current recovery-save instruction is still pending, not failed; do not manufacture a result or request a new email just because planning took time.

**Session 2 — execute the first prepared pack and measure pace.** Complete the still-applicable recovery/password/confirmation outcomes with one grouped owner handoff, record precise results and fix demonstrated failures. Update the remaining effort from actual work and set the next pack. If the retained recovery form is no longer usable, prepare the bounded next action from its observed state instead of reopening a consumed link or blindly resubmitting a save.

This plan does not run those tests, deploy code or change the product. Its purpose is to make the remaining route, effort and decisions visible before continuing.

## Source and status references

- [Current final-remediation progress](SECURITY_FINAL_REMEDIATION_PROGRESS.json), retrieved at ca6eb643adac1252c35f9d7392a2df9be89334ee, for current accepted scopes and FR.3–FR.8 status.
- [Original final-remediation handoff](SECURITY_FINAL_REMEDIATION_HANDOFF.md), 13 October, for FR.1–FR.8 exit requirements. Its old “next FR.1” instruction is historical.
- [December target and batching decision](SECURITY_DECEMBER_2026_LAUNCH_BATCH_PLAN.md), owner direction 23 October; no exact channel/date commitment established.
- [Fixed remaining lettered packages](SECURITY_STAGE_3_REMAINING_LETTERED_BATCHES.md), for U–Z scope and endpoint.
- [W remaining original cases](SECURITY_FR_2_5_BATCH_W_REMAINING_CHECKS.md), [latest completed recovery-isolation receipt](security-fr-2-batch-w-owner-stable-recovery-isolation-pass.json), and [prepared recovery-save handoff](SECURITY_FR_2_5_BATCH_W_STABLE_RECOVERY_SAVE_CHECK.md).
- [Carry-forward register](SECURITY_AUDIT_CARRY_FORWARD.md), for original findings and overlapping deletion/files/privacy and later actions. Dated historical observations are not treated as fresh failures or current configuration reads.

Durations and launch sequencing are new planning judgments in this version; they are not results stated by these source documents.
