# 6.2 — Identity/email candidate and local verification

**Latest — 6.2 / owner Windows repeat PASS, 12 October 2026 (S6E03):** [Owner receipt and hash reconciliation](security-stage-6-identity-email-owner-local-checks.json): 46 PASS/0 FAIL, exit 0, three syntax checks PASS, Node v22.17.0. All 11 inputs reconcile: five exact published bytes and six exact LF-to-CRLF variants; zero unexplained differences. This repeats the same 43 template-condition projections plus three mocked-handler cases, not new controls or Go/Supabase/provider/mail/device acceptance. Earlier assistant receipts and initial harness failure remain preserved. Zero fresh assistant behavior/hosted/device checks; no source/settings/SQL/account/provider/mail/deployment/production/native change or finding closure. Two of four Stage 6 steps remain complete; **next 6.3, full report 6.4, APK update deferred.** No rerun or further owner SQL/terminal action is needed. Earlier summaries remain historical.


**12 October 2026 — COMPLETE AT TEMPLATE-SOURCE / OFFLINE PROJECTION SCOPE (S6E02).**
Source parent: `87a1d302c0d490578dc0752fa7c0124ef0e4eda7`. **Final batch: 46 PASS / 0 FAIL, exit 0; three Node syntax checks PASS.** This is 43 actual-template control-flow projection cases plus three selected existing Business Edge-handler cases with synthetic Auth/RPC/mail responses. **Go/Supabase rendering, contextual HTML/URL escaping, provider login/linking and real inbox delivery remain unverified.**

[Finite Stage 6 plan](SECURITY_STAGE_6_IDENTITY_EMAIL_PLAN.md) · [Candidate contract](security-stage-6-identity-email-candidate-contract.json) · [Local receipt/history](security-stage-6-identity-email-local-checks.json) · [Source review](SECURITY_STAGE_6_1_IDENTITY_EMAIL_REVIEW.md) · [Six OPEN actions](security-stage-6-remediation-actions.json).

## Source repair and resulting copy

Four tracked files changed: invite-user.html / invite-user.subject.txt and magic-link.html / magic-link.subject.txt under supabase/templates.

| Redirect purpose | Subject/body outcome |
|---|---|
| /auth.html?flow=business-new&invitation=ID | Business-specific invitation; account verification/first-password guidance and explicit Accept required to join |
| /auth.html?flow=business-existing&invitation=ID | Same Business-specific invitation; existing recipient goes through the unchanged OTP sender |
| /business.html?invitation=ID | Retained legacy Business invitation wording |
| /signup.html?mode=admin-invite&invitation=ID | Admin account-setup wording; workspace created after guarded setup completion |
| Other purpose/origin/path/shape | Existing generic invite or sign-in fallback |

Subjects and bodies use matching predicates. Business wording now describes verification and deliberate membership acceptance rather than implying that link opening joins the Business. Admin OTP resend describes account setup rather than generic sign-in. The trusted **ConfirmationURL placeholder is preserved**, with one link per selected body. No redirect-to URL is substituted for the provider's verification link, and no raw metadata/name is newly interpolated.

The supported classification has an exact canonical SiteURL prefix, sender query order and a 36-byte invitation tail. It rejects empty/truncated/extra-query/fragment/lookalike/external/wrong-purpose shapes under those assumptions. **The tail-length guard is not UUID or identity validation**: a 36-character arbitrary value can select copy. This grants no access; unchanged Auth/callback and database invitation validation must reject invalid or unauthorized subjects independently. One test explicitly demonstrates this limit.

**Installation prerequisite:** actual SiteURL must be the selected HTTPS root origin without a trailing slash, path, query or fragment, and must match the selected sender's APP_ORIGIN. A trailing-slash configuration returns generic copy in the projected current-route case; this is recorded, not silently claimed supported. Exact saved configuration and actual server handling are unverified. Query permutations and additional parameters are not supported classified-purpose routes; they fall back generically. Any later required route change needs coordinated sender/template checks.

No app UI/JS, Auth controller, invitation Edge handler, SQL/migration, ownership/role/seat logic, package/lock, native builder or SMTP setting changed. These are reviewable tracked template candidates, not installed dashboard templates or a runtime social-login feature.

## Offline checks and their limits

[Offline verifier](../../scripts/verify-stage-6-identity-email.mjs) uses Node built-ins only. [Primary tests](../../tests/stage-6-email-templates.test.mjs) read the four actual candidate files and execute their conditions through a [restricted test-only expression/control interpreter](../../tests/helpers/auth-email-template-projection.mjs). This projects selected static copy and deliberately retains ConfirmationURL as a literal placeholder. It does not emulate complete Go text/template or html/template, URL/HTML contextual escaping, provider token issuance or Supabase transport.

The allowed subset covers print/len/slice/eq/ge, short-circuit and/or, variables, comments and nested if/else/end. Unsupported/malformed constructs fail rather than silently pass. Length/slice use byte semantics for the selected strings. Go was not available in this environment; no Go compiler/renderer was installed or executed. Actual provider parse/render remains a rollout prerequisite, not a local PASS badge.

The 43 primary cases cover both new/existing/legacy Business routes, Admin setup, generic preservation, subject/body parity and authentic-link placeholder, wrong environments/hosts/schemes, spoofed prefixes, alternate/duplicated/extra queries, fragments, wrong/empty IDs, short inputs, empty SiteURL, canonical-origin limit, unsupported grammar and the explicit non-authorization boundary. Frozen original four-template bytes from the exact parent prove the prior current-callback generic fallback and retain historical source.

Three unchanged tests execute the actual Business handler with mocked Auth/RPC/provider responses: new identity uses invite; existing identity uses OTP with shouldCreateUser=false; reservation denial occurs before service/mail dispatch. This confirms selected source behavior only. The existing three staging-builder tests are intentionally outside this exact handler subset. Depending on Node version, filtered tests are omitted or reported skipped; neither is counted as executed PASS.

The verifier runs the 43+3 subset, requires its complete expected results and checks the three new .mjs files' Node syntax. It reports hashes for 11 source/test/contract inputs. The unchanged handler and existing test match two current Git identities; all four frozen original template strings match their parent Git blobs. These checks do not certify a full repository, deployed parity or all 36 hosted grouped cases.

## Initial failure and final outcome

The first primary run was **42 PASS / 1 FAIL, exit 1**. Its test assertion searched only for the incomplete href prefix plus an empty redirect, which matched every href. The correction compares the full quoted attribute; purpose classification was not the failed assertion. The final verifier run is **43 primary PASS plus three regression PASS, exit 0**. The failed initial outcome/cause remains in the receipt; its initial harness file hashes were not captured.

An earlier standalone run of the same three handler cases also passed and reported a non-failing Node TypeScript experimental warning. The final repeat contains no captured such warning. Historical executions total 92 (91 PASS / one retained harness FAIL), not 92 unique cases or controls. The final selected case set is 46, and a later owner repeat adds no distinct cases.

## Identity and email configuration contracts

The [inert candidate contract](security-stage-6-identity-email-candidate-contract.json) records precise intended boundaries and ten unresolved rollout prerequisites. It is documentation/configuration-for-review, not an imported application module, installed Auth policy or trusted hosted attestation.

Identity: keep Google-login intent, qualify the proposed iOS equivalent option, separate provider-to-Supabase and Supabase-to-app callbacks, bind operation/environment/initiating identity and state/nonce/verifier, handle cancellation/replay/switch/expiry and deliberate session transfer. Retain immutable Auth UUID ownership, existing finance/plans/memberships, invitation checks and user-selected currency onboarding. Verify actual automatic/manual linking and Apple relay collisions rather than merging financial accounts by client email.

Email: keep working SMTP initially. Any signed Auth Send Email Hook is a separately reviewed replacement route, with authenticated raw-body/timestamp, exact action/recipient/token mapping, bounded failures and restoration. Application event mail needs a separate durable server-authorized dispatcher with current membership/recipient checks, dedup/retry/budgets/suppression/preferences and approved retention. Existing Web Push workers are unchanged and do not implement this proposed mail worker.

**Not implemented here:** Google/Apple sign-in/link/unlink runtime UI/controller; genuine provider client/capability/redirect configuration; native OAuth return/verifier plumbing; Auth Send Email Hook; application email worker/queue. Their prerequisites remain OPEN under IE-R01–IE-R06 and earlier AU/AM/Business/NR/privacy actions. Local template copy repair does not close F04 or any original finding.

## Rollout and handoff

Two of four Stage 6 steps now have scoped outcomes. **Next 6.3**, one bounded exact-source/readiness or controlled acceptance outcome. Actual template Go rendering/installed subject/body, canonical origin and allowlist, provider/identity/device/inbox/SMTP and rollback evidence remain prerequisites. Unavailable groups are recorded BLOCKED/UNVERIFIED and carried to final remediation without repeated setup. Full Stage 6 report remains due at **6.4**.

The existing 36-case IE01–IE06 hosted contract is unchanged; **zero hosted grouped cases ran**. Stage 0–5 objects, completed 6.1, historical receipts, original 123 coverage rows and 20 finding definitions remain intact. Six actions remain OPEN; no new finding definition or release acceptance.

No owner SQL/settings/provider activation/template installation/mail request is required by this checkpoint. Existing accounts, retained fixtures and two manual conversions remain unchanged. No production/native build/sync/sign/install/upload/store action; APK update deferred.

An optional owner Windows repeat exports the pinned 11 inputs to a unique temporary folder and runs the Node verifier, without replacing the working checkout or changing execution policy. The full command block is supplied in chat; opening repository files is not required. Return only the resulting summary; no credential or actual link is needed.

## Primary documentation reviewed

- [Go template built-ins and control syntax](https://pkg.go.dev/text/template) — syntax reference; no local Go execution was performed.
- [Supabase purpose templates and variables](https://supabase.com/docs/guides/auth/auth-email-templates) — ConfirmationURL and separately saved hosted templates.
- [Supabase Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) — replaces built-in/SMTP sending when enabled, hence remains inactive.

These sources support the design boundaries; they do not verify Mushavo's project configuration.

## Owner Windows repeat — 12 October 2026 (S6E03)

Owner ran the pinned `bd0888f63a7f3f6e7493c4b81c1708a33cc2b1e0` 11-input temporary export on Node v22.17.0. Result: **46 PASS / 0 FAIL, exit 0; three Node syntax checks PASS**. Primary 43 template-control cases and three selected mocked Business-handler cases are the same existing case set; no extra distinct cases are added.

[Owner receipt and exact byte comparison](security-stage-6-identity-email-owner-local-checks.json) preserves the returned summary. All 11 inputs were freshly fetched at the pin and their Git blob identities verified. Five owner hashes match published bytes (two HTML templates, frozen baseline JSON, Business handler and candidate contract); six match the exact LF-to-CRLF variants (three new .mjs files, two subject files and the existing regression test). **Zero unexplained differences.** Hash reconciliation is a read-only integrity check, not a new behavior or hosted test.

No fresh assistant behavior/syntax checks ran. The earlier 42 PASS/one harness assertion FAIL, correction and final assistant 46 PASS remain unchanged. Actual Go/Supabase parse/render/escaping, installed template/configuration parity, Google/Apple login/linking, inbox delivery and native acceptance remain unverified. No setting, account, fixture, SQL, provider/mail, deployment/production/native change or finding closure is inferred from the owner summary.

6.2 stays complete at its scoped source/local outcome. **No rerun or further owner SQL/terminal action is required. Next 6.3; full report 6.4; APK update deferred.**
