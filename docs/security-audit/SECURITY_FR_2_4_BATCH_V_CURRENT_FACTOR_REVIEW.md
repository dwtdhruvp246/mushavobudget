# Stage 3/10 · FR.2/8 · Batch V/Z — current factor review only

> FRE205–FRE206: Owner answered **Unrecognized**. Do not repeat MFA or alter the factor. [Read-only Auth audit handoff](SECURITY_FR_2_4_BATCH_V_AUTH_AUDIT_HANDOFF.md) is now the next action. It reads a fixed selected-account window and leaves state unchanged; new SQL8/8 local PASS. Earlier recognition question/read-only metadata command below are complete historical steps.

> FRE204: **Read-only review COMPLETE/exit0 at2026-10-25T14:23:19.296Z. Do not repeat it solely to obtain the same metadata.** PRIMARY has no factor. RECOVERY has one unverified expected-label TOTP created2026-10-25T14:03:03.118678+00:00, SHA256 `6c694294cb8273bce316aa86fd706e32a8028f2e3fba3ac65d4e75f98e6854cc`; it differs from the old15October PRIMARY metadata. Current Admin parity/ordinary identities/quarantine pass. Zero Auth or factor/role/mode changes in this review. A saved authenticator entry may allow genuine verification without enrollment/deletion. Owner must first state only whether the setup is recognized and that entry is saved/accessible. No code/key/password/token in chat. MFA setup remains ON HOLD. Historical review command below is not the next action.

FRE202–FRE203. **MFA setup ON HOLD.** Latest owner result at2026-10-25T14:04:42.103Z used published4b78539bb9ed2f451f0ddc8d37cdd82d56466d57 and verified331 source hashes. It stopped after6 Management reads at CURRENT_ADMIN_OPERATOR_FACTOR_AND_SESSION_GUARD/BATCH_V_UNEXPECTED_EXISTING_FACTOR. Auth_requests0, public_config_requests0, mfa:null: no password was requested or checked. No factor enrollment/deletion, password reset, role/settings/deployment/application write, mode commit or email request occurred. Final target/Admin source/effective grants/quarantine checks passed and both operator session counts were0.

Current counts show PRIMARY0/RECOVERY1 unverified factor, while the prior13:42:57 result showed PRIMARY1/RECOVERY0. These aggregate receipts do not identify the current factor or prove why the observations differ. Do not call this a factor transfer, an account swap, automatic expiry or a new enrollment without the missing metadata. Do not delete, reset, reenroll or rerun MFA from these counts. The selected-input labels in the latest owner console remain the same as the preceding visible mapping; raw console emails are not stored in evidence.

The latest root existing_operator_identities_ordinary_and_isolated:false is a flag-assignment issue: successful identity/parity validation occurs inside snapshot before the factor guard; assignment to that root flag was after the guard and was never reached. This is not evidence of account deletion or new privileges. The flag is now set after the successful initial identity snapshot. The exact owner result remains unchanged in security-fr-2-batch-v-owner-unexpected-factor-stop.json.

## Next concrete action

Use scripts/review-fr-2-batch-v-state.mjs --read-only from the newly published pin supplied directly in chat. This entry reuses inspectBatchV and the already tested metadata-only SQL/current Admin model. It has no path to Auth API, enrollment/deletion, credential reset, role/control/settings write or MFA continuation. It checks332 source identities before accepting private inputs. All310 U source bytes remain unchanged. This is a fresh read-only review, not a repetition of the earlier MFA setup.

Maximum5 fixed-target Management requests: target before, exact quarantined catalog before, one combined Admin/operator/factor metadata rowset, quarantined catalog after, target after. SQL explicitly uses BEGIN TRANSACTION READ ONLY, UTC/search-path/statement/lock limits, privileged-origin checks and ROLLBACK. The proven Management transport flag read_only:false supports its catalog DO/readback; the SQL transaction enforces read-only operation. No application routine is invoked. No Auth session is created or device/browser/gateway/provider email operation performed.

The safe result contains only selected Admin/policy fingerprints/counts, selected operator scope counts and up to5 factor metadata entries per slot: type, verified/unverified status, UTC creation/update times, expected slot-label match, failed15October setup-window match and SHA256 of selected metadata. No raw actor/factor IDs, emails, friendly names, TOTP secrets, secret hashes, credentials or provider bodies enter output. The metadata hash includes IDs internally to bind a row, excludes the secret column and cannot recover the secret. Compare with original reviewed PRIMARY metadata hash d3f81681acaee6a48d7ef5911d5fc6898394dc0bc243a4d8c54366aa7c164ce0, but a hash/label/time match alone does not authorize a write.

## All expected prompts

There are exactly3 prompts:

1. SAME existing staging Management token, masked with stars; Project Settings Read + Database Read-write, from the owner's existing private token storage used for H/V. No token regeneration or extra scope.
2. Existing PRIMARY email, visible locally; retain the same PRIMARY account selected in the latest run.
3. Existing separate RECOVERY email, visible locally; retain the same RECOVERY selection.

No app/mailbox/database password, SETUP, ADDED, authenticator key/code, email code, browser, DPAPI packet, upload or installation. Full pinned PowerShell is provided directly in chat; it extracts a public temporary snapshot without switching or editing the owner's checkout. No PGlite dependency scan/install or owner offline suite repeat is needed for the review. Operator addresses can be checked in the owner's saved setup or staging Authentication→Users; do not change their labels to bypass the guard.

Hidden terminal inputs again display ***** with working backspace; only stars are written for secret keystrokes. Public email inputs remain locally visible and absent from safe JSON. Input hiding does not guarantee physical memory/terminal/OS secure erasure or protection from an external recorder. Keep credentials/private setup material out of chat and recordings.

## Validation and boundary

68 local tests PASS:13 retained metadata diagnostics,31 MFA core regressions and24 guarded MFA/diagnostic/private-terminal cases. Two added cases execute the read-only entry with a pending RECOVERY factor and exactly5 Management reads/zero Auth/no password prompt, and exercise star-only secret echo/backspace plus noninteractive CLI refusal. Installed local SQL/read-only/privacy/row-preservation checks and all41 synthetic normal-path transport failure positions remain.332 hashes/149 syntax checks; all310 frozen U sources unchanged. Real hosted Auth/factors/settings were not changed by assistant. New Windows read-only entry/star-masking execution and current detailed hosted factor metadata remain pending.

A successful read-only exit0 means inspection completed. next_action may still require factor review. It is not MFA setup acceptance, permission for cleanup, genuine AAL2, independent recovery, full V/FR.2/Stage3 or launch approval. V–Z remain5 packages with Z final; production/native excluded, APK deferred.

Send me the safe JSON and exit code.
