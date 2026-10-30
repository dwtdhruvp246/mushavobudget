# Stage 6 completion report — Identity and email workflows

**6.4 / 12 October 2026 — CLOSED WITH CARRY-FORWARD. All four finite steps have recorded outcomes.**
Reconciliation source pin: `2ad416006098df83c9e0a58300f38ef6cb56e911`. This is a source/local/owner-reported audit checkpoint closure. **Genuine provider/login/linking, Go/Supabase template rendering, inbox delivery and native acceptance remain UNVERIFIED / BLOCKED. Zero of 36 planned hosted grouped cases ran.**

[Final integrity reconciliation](security-stage-6-final-recheck.json) · [Six OPEN action entries](security-stage-6-remediation-actions.json) · [Finite Stage 6 plan](SECURITY_STAGE_6_IDENTITY_EMAIL_PLAN.md) · [Current progress](SECURITY_AUDIT_PROGRESS.json).

## Recorded outcomes

| Step | Outcome | Actual limit |
|---|---|---|
| 6.1 Source/decision inventory | 41 selected source files matched; provider/linking/email dependencies and four-template callback wording mismatch recorded; 36-case contract/six actions prepared | Source and prior owner facts; no fresh provider/dashboard, Auth or mail acceptance |
| 6.2 Candidate/local verification | Four template candidates repaired; final 43 control-flow projection cases plus three mocked-handler cases PASS, exit 0; three Node syntax checks PASS | Restricted Node test projection, not Go/Supabase parse/render/escaping or provider delivery |
| 6.2 Owner Windows repeat | Same 46 cases PASS, exit 0; three syntax PASS on Node v22.17.0; all 11 hashes reconcile | Repeat of existing local case set; no added unique cases or hosted acceptance |
| 6.3 Bounded readiness | All six groups BLOCKED / NOT RUN, zero of 36 hosted cases; six prerequisite groups carried forward | No deployment/provider/settings/account/inbox/device inspection or mutation |
| 6.4 Full report/reconciliation | 46 current source identities, 11 candidate hashes and seven structured records reconcile; no unexplained drift | Read-only integrity/reporting; zero fresh behavior, syntax, hosted or device checks |

The initial assistant primary run remains **42 PASS / one FAIL, exit 1**. Its empty-redirect test assertion compared an incomplete href prefix and matched every link. The harness correction compares the full quoted attribute. The final verifier and owner repeat each pass the same 46 selected cases. The failure is retained as a harness failure, not relabeled a template exploit or actual mail/provider failure.

## What changed and what remains unimplemented

Four tracked templates under supabase/templates now select consistent subject/body copy for:

- Current /auth.html?flow=business-new&invitation=ID and business-existing callbacks.
- Retained legacy /business.html?invitation=ID.
- Admin /signup.html?mode=admin-invite&invitation=ID setup, including unfinished-identity OTP resend.
- Existing generic invitation/sign-in fallback for other purposes or unsupported shapes.

Business mail describes account verification, first-password guidance where needed and explicit Accept before membership. Admin mail describes completing account setup and currencies before workspace creation. The provider's **ConfirmationURL placeholder is preserved**, with one link in each selected body. No caller-selected redirect replaces the trusted verification link; no new name/metadata interpolation is added.

Classification assumes an exact selected HTTPS root SiteURL without trailing slash, path/query/fragment; canonical sender query order and a 36-byte invitation tail. Wrong-origin/lookalike/extra-query/fragment/empty/truncated shapes fall back in the tested conditions. **Tail length is not UUID or identity validation**; a 36-character arbitrary value can select wording. That grants no access. Actual Auth, callback and database rules remain responsible for validating identity, invitation, roles/seats/expiry and deliberate membership.

A trailing-slash SiteURL produces generic copy in the projected current-route case. That limitation and exact APP_ORIGIN/redirect alignment require installed configuration reconciliation; no saved setting is certified here. Retained legacy support is for the specified canonical route shape, not every possible parameter permutation.

Four offline files were added: verifier, 43-case test, restricted template-control test helper and frozen baseline JSON. Relative to Stage 6's initial source pin, the complete non-document diff is **eight paths: four templates plus those four offline files**, with zero deletions.

**No app/Auth UI/controller, invitation Edge handler, SQL/migration, dependency/lock, native builder or runtime account/finance/role logic changed.** Source candidates do not install hosted dashboard templates.

**Not implemented:** Google/Apple sign-in/link/unlink runtime; provider callback/identity transaction; native provider return/verifier plumbing; signed Auth Send Email Hook; durable application-email worker. The identity/email candidate contract is inert review documentation, not a product runtime or installed Auth policy. Google intent is preserved; Apple is proposed, not a newly confirmed owner choice.

## Evidence counts and integrity

| Evidence | Recorded result |
|---|---|
| Initial assistant primary batch | 43 executions: 42 PASS / one preserved harness FAIL |
| Assistant standalone existing-handler subset | Three PASS; one non-failing TypeScript experimental warning recorded |
| Final assistant verifier | 43 primary plus three existing-handler PASS = 46, exit 0; three Node syntax checks |
| Owner Windows verifier | Same 46 PASS, exit 0; three syntax checks, Node v22.17.0 |
| 6.3 and 6.4 fresh behavior/syntax/hosted/device batches | Zero |

Assistant history totals **92 case executions, 91 PASS / one FAIL**. Owner adds **46 repeat executions, all PASS**. Combined history is **138 executions, 137 PASS / one retained harness FAIL**, not 138 unique cases or controls. The final selected set is 46 cases: 43 new template-control projection cases and three selected existing regressions. The three Node syntax targets were checked once by each final verifier, six historical executions; no Go syntax/renderer checks ran.

The primary test reads actual template conditions through a deliberately restricted Node interpreter. It projects selected static copy and preserves ConfirmationURL as a literal placeholder. It does not implement the complete Go engine, contextual HTML/URL escaping, token issuance or transport. Unsupported grammar fails locally; this is still no proof of actual Supabase rendering.

The regression subset executes the actual Business handler with synthetic SDK/RPC/provider results: new identities use invite, existing identities use OTP without account creation, and reservation denial precedes service/mail dispatch. The unchanged three staging-builder cases are outside this exact subset; filtered cases are never counted as executed PASS.

The [final recheck](security-stage-6-final-recheck.json) records **46 current Git blob identity matches and zero unexplained drift**. These combine the original 41 targets, with four intentional current-template replacements, and five added candidate inputs. They are not 46 new byte reads or behavior tests. Eleven candidate inputs were freshly fetched and byte-hashed; other selected targets were checked by current Git metadata.

All 11 candidate SHA256 values match the assistant receipt. Owner hashes resolve to **five exact published-byte matches and six exact LF-to-CRLF variants**, zero unexplained differences. Seven structured source/decision/matrix/contract/local/owner/readiness records retain their recorded published bytes. Original template source is retained in the baseline fixture; the earlier inventory is not rewritten to hide intentional changes.

Original **123 coverage rows and 20 finding definitions**, Stage 0–5 structured outcomes, closed 6.1–6.3 step objects and S6E01–S6E04 events remain preserved. No fresh behavioral rerun was warranted by this unchanged-code closure reconciliation.

## Hosted readiness and six open actions

The unchanged matrix contains six groups of six planned cases: providers; linking/invitations; email purpose/callbacks; Apple/relay; Auth delivery/hook; application mail/rollout. **All 36 remain unrun and BLOCKED at readiness scope.** This is not 36 failed provider requests or disabled user accounts. Cases overlap earlier AU/AM/NR requirements and are not additive global controls.

Published Git/local evidence does not establish installed frontend/Edge/Auth/template parity. Offline candidate_deployed=false is not a current deployment probe; status is **UNVERIFIED**. Historical disabled-provider and SMTP/actor reports retain their dates/scope and do not establish current dashboards, inboxes or controlled identities.

Six prerequisite groups remain: exact staging deployment/settings; provider/iOS choice and implementation; identity/invitation/onboarding/native transaction; actual renderer/callback/inbox matrix; selected Auth route/application mail; recoverable actors/devices/disclosures/rollback.

| Action | Existing findings | Completion still required |
|---|---|---|
| IE-R01 Provider/iOS setup | F04/F20 | Select and verify provider clients, audience/domains/scopes/capabilities, qualifying iOS option and public-policy prerequisites; implement accepted flows |
| IE-R02 Callback/session transaction | F04/F10/F14/F15 | Bind intent/environment/initiating UUID and state/nonce/verifier, replay/expiry/cancel/account-switch and accepted native return |
| IE-R03 UUID-preserving linking/invitations | F04/F08/F15 | Real same/different-email/relay/unfinished-Admin collisions; preserve finance/plans/roles/seats and selected currency onboarding |
| IE-R04 Purpose templates/delivery | F04/F15/F19 | Four copy candidates retained; actual Go rendering/escaping, saved canonical origin/allowlist/template parity and controlled inbox matrix |
| IE-R05 Auth/application email architecture | F04/F15/F19/F20 | Preserve SMTP initially; complete only selected signed replacement hook and separate durable server-authorized event mail with limits/retention/monitoring/rollback |
| IE-R06 Genuine acceptance/rollout | F04/F08/F10/F15/F19 | Recoverable isolated actors/inboxes/devices, exact rollout/rollback and bounded hosted cases with authorization, cleanup and declaration alignment |

These are six action entries under existing findings, not six new finding definitions. Every action remains OPEN. Existing AU/AM/Business, Personal binding/relink/deletion, NR native and privacy/minors/retention/operations actions remain intact.

Account ownership stays Auth-UUID based. Do not merge finance or memberships through caller email/metadata, relax origins or bypass live invitation/seat/role checks to obtain a passing result. A future chosen Auth hook replaces SMTP when active; that change needs genuine signature/action/token, failure and restoration evidence. Existing Web Push queues are not a completed application mailer.

## Stage 7 handoff and release gate

Next **7.1 — Subscription commerce source and product/channel decision inventory**, under the established F03 roadmap. Review existing manual web proof/review and server entitlement paths; inventory native store-purchase gaps and decisions for products/plans/seats, channel mapping, purchase verification, idempotent entitlement updates, restore/refunds/expiry/replay, cross-channel consistency and any provider webhook protocol.

This handoff does not activate a payment provider, create store accounts/products, dispatch mail, charge a user or publish an app. Provider/operator/channel/product decisions and actual sandbox evidence remain prerequisites; do not invent prices or policy clearance from source metadata.

Stage 6 closes as a finite audit checkpoint with carry-forward. **No original finding closes. Release gate stays OPEN_PENDING_REQUIRED_EVIDENCE.** Accepted integration, missing actual hosted/provider/native/device/store evidence, final remediation and fresh full re-audit remain required before release.

No owner SQL, terminal rerun or further Stage 6 setup is needed. No live account/fixture/Auth/Storage/SQL/settings/provider/email/job/deployment/production or native action occurred at closure. Retained synthetic fixtures and the two manual conversions remain unchanged. **APK update remains deferred.**
