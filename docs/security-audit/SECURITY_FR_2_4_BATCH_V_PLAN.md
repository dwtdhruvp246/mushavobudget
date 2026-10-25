> FRE210: **Stage 3/10 | FR.2/8 | Batch V/Z — hosted external log inspection COMPLETE/exit0; MFA remains ON HOLD.** Corrected query returns6 selected RECOVERY rows: login14:03:01UTC, factor_in_progress14:03:03UTC, logout14:03:16UTC, each action/time pair in both Auth sources. Audit entries report NODE_OR_UNDICI; service entries do not record the client. This is consistent with interrupted programmatic enrollment, not proof of the exact runner/person/factor. No truncation; no PRIMARY matches in this username-filtered window. [Recorded result and next non-secret question](SECURITY_FR_2_4_BATCH_V_EXTERNAL_LOG_RESULT.md). Only ask whether the owner was running the supplied RECOVERY MFA command at16:03 Zimbabwe time today; no new query, credential, code, setup or cleanup run. Previous15:14:35UTC exact-factor/zero-session/quarantine state remains the last direct observation. All335 previous sources/U310 unchanged; full V/FR.2/Stage3/release remain open.

> FRE208–FRE209: **Stage 3/10 | FR.2/8 | Batch V/Z — hosted log inspection STOPPED; single-SELECT retry ready, MFA ON HOLD.** Owner first ran the log query in PostgreSQL (42P01), then selected Logs correctly but received SYNTAX_ERROR. No successful log result exists; the displayed0 rows are not a successful empty history. [Corrected full-query handoff](SECURITY_FR_2_4_BATCH_V_EXTERNAL_AUTH_LOGS_HANDOFF.md) removes CTEs/subqueries and passes16 actual synthetic ClickHouse checks,19 public fixture requests/no private Supabase request. Prior query is valid in the tested native engine too, so exact hosted parser/version/formatter cause is unconfirmed; corrected hosted acceptance remains pending. Previous335 sources/U310 unchanged; prior15:14:35UTC quarantine/factor/zero-session state is carried forward, not remeasured. No owner offline run/install, password, token, code or MFA retry.

> FRE207: **Stage 3/10 | FR.2/8 | Batch V/Z — database audit inspection COMPLETE; MFA remains ON HOLD.** Owner SQL at2026-10-25T15:14:35.7749+00:00 returned AVAILABLE,0 selected events, no truncation, same exact reviewed RECOVERY pending factor and0 current sessions for each operator; read-only/ROLLBACK/QUARANTINED before and after PASS, exit0. No Auth/factor/mode/settings write. Empty selected database history does not establish origin or complete retention. [Next read-only external Auth log query](SECURITY_FR_2_4_BATCH_V_EXTERNAL_AUTH_LOGS_HANDOFF.md) checks the same35-minute window with fixed safe projections and no new credential input. It is source-reviewed, NOT executed in ClickHouse or hosted yet; previous local8/8 evidence and all335 source hashes/all310 U files remain unchanged. No owner offline rerun/install or MFA retry. U stays COMPLETE; full V/FR.2/Stage3/release remain open.

# Batch V — Admin MFA, recoverable operators and privileged access

**STARTED — Stage 3/10 | FR.2/8 | Batch V/Z — IN PROGRESS.** U is accepted COMPLETE at its frozen scoped boundary. V–Z are the five remaining current authorization packages; Z remains final. Stage3/FR.2/release are not closed. This plan freezes16 existing V acceptance requirements before hosted work; it does not expand the lettered baseline.

## Frozen acceptance cases

| Case | Required evidence | Current status |
|---|---|---|
| V01 | Current Admin source, selected policies/effective grants and email containment parity | Hosted scoped review PASS; see FRE197 and genuine MFA handoff |
| V02 | Current isolated PRIMARY/RECOVERY identities and retained private-control evidence | Hosted scoped review PASS; see FRE197 and genuine MFA handoff |
| V03 | Resolve prior uncertain/pending factor state by exact read-only metadata before any factor write | Exact current metadata observed; new unrecognized RECOVERY origin unresolved, MFA on hold; FRE204–FRE207 |
| V04 | Genuine PRIMARY TOTP/AAL2 including a fresh password session | Pending |
| V05 | Genuine RECOVERY TOTP/AAL2 and independently accessible recovery control | Pending |
| V06 | Coordinated reviewed SQL/UI/Edge assurance enforcement and narrowly scoped operator roles | Pending |
| V07 | Permitted genuine AAL2 Admin role operations through required UI/API paths | Pending |
| V08 | Password-only/low-assurance/stale-token direct bypass denial with required email proof boundary | Pending |
| V09 | Ordinary verified-email users cannot obtain platform Admin access | Pending |
| V10 | Super/Admin staff/finance/support role-scope boundaries and protected operator rules | Pending |
| V11 | Selected session revocation and stale privileged-client/session denial | Pending |
| V12 | Controlled factor lifecycle/revocation preserving a functioning alternate route | Pending |
| V13 | Actual independent recovery drill without sole-factor/operator removal | Pending |
| V14 | Preserve legitimate affected finance/backend access and retained historical fixtures | Pending |
| V15 | Final quarantine/fence/exact selected session/device/fixture cleanup and source readback | Pending |
| V16 | Evidence reconciliation and handoff to W with no hidden required Admin blocker | Pending |

## Current checkpoint — owner does not recognize factor; read-only Auth audit required

FRE205 records owner Unrecognized; do not repeat MFA, challenge, remove or replace this factor blindly. FRE206 prepares [bounded selected Auth audit SQL](SECURITY_FR_2_4_BATCH_V_AUTH_AUDIT_HANDOFF.md),8/8 new local SQL tests PASS,335 source identities including all332 existing executed sources unchanged. Read only selected actor/subject/exact current-factor audit references for13:35–14:10UTC, project/quarantine guards and ROLLBACK. Pinned public Auth source can purge old unverified unchallenged factors globally during enrollment; that may explain old PRIMARY disappearance but hosted build/actual cleanup is unproven. New RECOVERY creator/human/client origin remains unknown. Optional DB audit storage/no events does not establish no activity. No factor/Auth/settings/mode write, new installation or offline owner repeat.

## Earlier checkpoint — owner saved RECOVERY entry status required

FRE204 records current5-read/zero Auth review PASS at2026-10-25T14:23:19.296Z. PRIMARY0 factors, RECOVERY1 unverified expected-label TOTP created14:03:03UTC today, metadata SHA2566c694294cb8273bce316aa86fd706e32a8028f2e3fba3ac65d4e75f98e6854cc. This is different metadata from the old15October PRIMARY factor, now absent. Current36/58 parity, isolated ordinary identities and quarantine pass. Origin/intervening changes are not established. Ask only whether owner recognizes the setup and has its saved authenticator entry; do not request its secret or code in chat. If accessible, prepare a no-enrollment/no-deletion resume for the exact reviewed factor, genuine fresh-session AAL2 and later missing PRIMARY setup. If recognized but unavailable, prepare a separate exact guarded recovery route that first preserves working access. If unrecognized, keep setup paused pending origin review. No such path is automatically authorized by metadata and no additional hosted/secret operation is performed here.

## Earlier checkpoint — unexpected factor required read-only metadata review

FRE202 records latest owner6-request Management-only run at2026-10-25T14:04:42.103Z stopped at BATCH_V_UNEXPECTED_EXISTING_FACTOR before any Auth/password. PRIMARY has0 and RECOVERY1 unverified factor, compared with previous1/0. This run changed neither factor nor mode; cause of the difference is unknown. Final Q/target/Admin parity/zero sessions pass. The root false ordinary-identity flag was assigned after the refused factor guard; it does not prove identity drift. FRE203 reuses the existing tested five-read review via a current-source interactive entry and restores star masking,68 local PASS. [Current read-only handoff](SECURITY_FR_2_4_BATCH_V_CURRENT_FACTOR_REVIEW.md). No enrollment, deletion, reset, role write or password retry from these counts.

## Earlier checkpoint — RECOVERY HTTP400 invalid_credentials; selected account shown in password prompt

FRE201 records owner66/66 offline PASS and corrected hosted diagnostic HTTP400 invalid_credentials for RECOVERY. Visible local account selections show that the owner-mentioned admin address was PRIMARY, so the first password prompt required the other RECOVERY account password. Which password was typed is unknown. Final quarantine/zero sessions/unchanged factors verified. Prompt-only email labelling local66 PASS; reuse the owner66 pass for a focused source-verified retry. No automatic password reset, credential guess or factor change.

## Earlier first genuine MFA run stopped at RECOVERY password sign-in

FRE199 records owner offline58/58 PASS; hosted8 requests with one rejected Auth password request, no enrollment/deletion and final zero sessions/QUARANTINED. Its generic HTTP_STATUS_REVIEW_REQUIRED does not establish a wrong password. FRE200 adds only bounded safe HTTP status/public code diagnostics and visible local email entry,66/66 local PASS; original recovery-first/exact pending-factor protections remain. See the [updated concrete MFA handoff](SECURITY_FR_2_4_BATCH_V_MFA_HANDOFF.md). Full V remains IN PROGRESS.

## Read-only action completed; genuine MFA next

FRE197 records owner13/13 local and five hosted read-only requests PASS, exact36/58 parity on providerPostgreSQL17.11 and both isolated ordinary identities; staging QUARANTINED at2026-10-25T12:25:30.771Z. PRIMARY has the exact one unverified factor described in the [recovery-first MFA handoff](SECURITY_FR_2_4_BATCH_V_MFA_HANDOFF.md); RECOVERY has none. Read-only review did not authorize a write. FRE198 prepares a concrete SETUP-acknowledged Auth action with recovery first, exact pending cleanup, genuine initial/fresh AAL2 and independent final reads.58 local tests PASS; actual hosted MFA and recovery remain pending. Original read-only scope below is retained as historical context.

## First combined owner action (completed)

One read-only Management run combines the existing36-routine/58-policy/effective-execute Admin diagnostic, isolated PRIMARY/RECOVERY identity diagnostic and prior uncertain MFA-factor diagnostic into ONE result rowset. It verifies fixed staging target and exact quarantined email catalog before/after, maximum five direct requests. No Auth API/login, mail, factor reset/enrollment/deletion, privilege promotion, settings/schedule/application/control write or deployment. SQL explicitly uses BEGIN TRANSACTION READ ONLY, time/lock/search-path/UTC limits, privileged-origin guard and ROLLBACK. The proven Management transport read_only:false flag is retained to support its existing catalog DO/readback; the SQL transaction enforces read-only operation. Metadata SELECTs invoke catalog functions only, not application RPCs.

Admin source comparison uses a NEW local model of current app migrations plus accepted H integration and bounded controls. Historical15October36/58 fingerprints and the34-CRLF proof remain unchanged; the public RPC wrappers installed in H are expected source changes and must not be mistaken for an old mismatch. The new model is PostgreSQL18.3/PGlite0.5.8 metadata. Current provider version and exact fingerprints are observed in the owner result; a genuine version/source/ACL difference requires review, not automatic repair. Matching current metadata is not proof that the later Admin MFA candidate is installed or authorization works.

## Existing MFA checkpoint to resume safely

FRE38/FRE39 already record two ordinary isolated staging identities and owner-reported sign-in/out, separate inbox passwords and independently accessible recovery credentials. Do not create them again or assume new addresses. FRE40 records PRIMARY password success, an enrollment request and HTTP_RESPONSE_TOO_LARGE before initial/fresh TOTP/AAL2. A pending factor may have been created; its actual current state was never independently received after the email-code work interrupted that sequence. The response cap correction and historical tests are preserved. Do not rerun setup, reset a factor, rotate a key or delete an unverified factor blindly.

The new review reports slot-only account/status/scope counts and up to five selected factor metadata entries: type/status/timestamps, expected-label/failed-window booleans and SHA256 of selected metadata. Raw actor/factor IDs, emails/friendly names, tokens, secrets and provider bodies are excluded. Factor secrets and secret hashes are never selected; tests show changing only a synthetic secret does not change its metadata fingerprint. Label/time correlation does not prove provenance or authorize removal. Multiple/unexpected/pending factors stay review-required. Verified factor counts alone do not establish genuine AAL2 or independent recovery.

No factor/privilege write is authorized by this read-only handoff. Later actions must be concrete, source-guarded and within existing session authorization: preserve a functioning alternate route, never remove a sole working factor/operator, verify genuine fresh-session assurance and recovery before enforcing/promoting privileges, and preserve quarantine/exact selected cleanup. No public/unbounded resume or production/native action is part of V's first review. Missing roles/factors/helpers are dependencies, not automatic creation instructions.

## Command and input handling

Full pinned PowerShell is supplied directly in chat. It extracts a fresh public snapshot, reuses retained PGlite0.5.8, runs only13 V review tests and then the read-only Windows parent. No browser, DPAPI packet, password, TOTP code/setup key, upload, installation or earlier U rerun. There are exactly three hidden prompts: the SAME retained staging Management token (Project Settings Read + Database Read-write), the EXISTING PRIMARY operator email and the EXISTING separate RECOVERY operator email from the earlier setup. Addresses can be found in the owner's saved setup details or staging Auth users; do not send them to chat or create replacements.

The four necessary private pipe/path/SecureString helper functions are byte-identical to accepted U after stage/protocol text substitutions; the new parent uses their existing selected bound with RequestLimit5. AllowCode is always false. Private values travel only through captured private stdin, never process arguments/environment/files or safe output. V deliberately does not read the gateway packet because these metadata queries need no gateway/public key. No current operator-slot mapping is assumed from the two gateway test inboxes.

## Local validation and limits

13 local tests cover actual installed quarantined SQL composition/current36/58 parity, ordinary identities and a pending PRIMARY factor, full-row preservation/secret exclusion, missing/verified/multiple-factor outcomes, source/grant drift, all five transport losses, target/final-mode drift, private-input/CLI/schema/body bounds, safe output and exact inherited private helpers.321 source hashes/139 syntax checks include all310 frozen U files unchanged. No U browser/email/fixture/installation acceptance is repeated. The new Windows parent and current hosted operator/factor state remain unobserved. This is read-only readiness, not genuine AAL2, verified recovery or full V acceptance.

The diagnostic may exit0 while next_action still requires factor/identity/source review. That means the bounded inspection completed; it does not approve enrollment, cleanup or privileged access. Full V requires all16 cases and real appropriate hosted evidence. Final launch/re-audit/findings closure remain pending, production/native excluded and APK deferred.

Send me the safe JSON and exit code.
