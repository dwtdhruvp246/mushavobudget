# Mushavo staging test runner

5 November 2026. Existing scope: Stage 3/10 → FR.2/8 → Batch W/Z.

This changes execution of existing checks. It does not create another stage,
FR or batch, repeat accepted invitations, reinstate MFA, or approve production.

The owner saved six repository Actions secrets. Their names were observed in
GitHub's repository secrets list; their contents were not read. The runner uses
them privately for the two designated ordinary accounts and existing Super Admin.

## Initial completed finite run

`scripts/ci/staging-run.json` selects **access-and-confirmation / AU01.05**:

1. Match private email inputs to the designated account bindings, sign in once
   per account, verify each confirmed identity, active profile and platform role,
   and read only owned workspace metadata. This is access readiness, not general
   role/finance acceptance.
2. Run the outstanding AU01.05 browser flow against the stable staging site:
   one duplicate signup attempt for the already-confirmed ordinary account,
   generic pending guidance, browser-aborted resend, retained form/address/button,
   and local cooldown without another dispatch. The browser intercepts actual
   requests; it does not replace the application handler or supply a fake success.
3. Close the isolated test browser while its blocking rules remain installed and
   request local logout for every session the runner created. Unverified logout
   blocks COMPLETE. Existing browser sessions are not selected for logout.

Source identities are pinned to the already accepted signup and security files.
Configuration must name staging project `dczlddwbtgvfdujgcitb` and use a public
publishable key. API destinations and methods are fixed. Unexpected mutations,
global logout, email recovery and unblocked resend are refused. Duplicate signup
can cause provider behavior that is not measured as email delivery; at most one
such request is forwarded. Provider 429/quota behavior is not claimed by the
local cooldown check. Service workers are disabled only in this isolated
network-interception browser, so this run is not PWA/service-worker acceptance.

## Trigger and output

The workflow runs only on the `security/stage-3-authorization` branch when the
finite run-plan file changes. Routine progress/documentation commits do not
restart hosted tests. There is no schedule or pull-request secret-bearing run.
One staging run executes at a time, with an eight-minute timeout and no automatic
test retries. Only read access to repository contents is requested.

Node and browser installation steps receive no app credentials. Browser tools
are version-locked with an integrity-checked lockfile; GitHub actions are pinned
to verified official commit SHAs. Six secrets are assigned only to the check step.

The safe receipt is printed and added to the GitHub job summary. It contains
booleans, counts, fixed result codes, commit/run references and HTTP statuses.
It does not contain email addresses, passwords, access/refresh tokens, identity
UUIDs, workspace names, raw server bodies, browser logs, saved browser sessions,
screenshots, videos, traces or HAR. Do not add these to artifacts for diagnosis.

The runner's User-Agent contains the exact GitHub run ID and attempt. If cleanup
needs independent investigation, this uniquely tagged run can be distinguished
from older unbound Node sessions. A timeout or interrupted network operation can
leave cleanup unverified; do not broadly delete sessions based on counts or age.

## Verification and remaining scope

Ten offline guard checks cover credential/configuration rejection, fixed API
routes, expected roles/distinct actors, bounded requests, report privacy,
failure-path cleanup, cleanup failure and browser mutation/resend boundaries.
The source pin includes the exact accepted staging signup HTML, whose two DNS
hints name staging rather than the canonical production project. The first run
verified all three private identities/roles and acknowledged all three local
logouts, then refused that expected packaging difference before any signup or
resend request. A public byte comparison established only these two substitutions;
the next run uses the exact reviewed staging pin. No app deployment changed.

These checks do not constitute hosted acceptance. Record the actual workflow
receipt before crediting access readiness or AU01.05.

All previously accepted W observations remain retained. AU03.04 interruption/
retry stays owner-deferred. The other outstanding W variants, V/X/Y/Z, later
FRs, native/device/provider acceptance and release decisions remain governed by
their existing checklists and prerequisites. Extend the finite run plan only for
the next applicable existing scope after reconciling its fixtures and evidence.


## Live readiness and first selected check accepted

FRE297, 5 November 2026: [successful run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/41991579027) and [safe receipt](security-fr-2-batch-w-staging-runner-confirmation-pass.json). All three private credentials/confirmed active identities/expected platform roles passed. AU01.05 generic existing-account guidance, actual browser-blocked resend, safe retry feedback, retained address/form/enabled button and no-dispatch local cooldown passed. Three created sessions received local logout acknowledgements; the isolated browser closed. No unblocked resend or fresh provider429/quota test ran. This is scoped W progress, not full W or launch acceptance.

The [read-only role inventory](security-fr-2-staging-runner-role-fixture-inventory.json) found Personal ownership for the three selected accounts and an active Business staff membership for USER_B. These selected accounts do not own Family or Business workspaces, and no additional platform staff identity is installed. Inventory existing retained actors before arranging missing role/recovery prerequisites. No role or plan was changed by this setup.


## Completed finite run: password boundary and sessions

FRE298, 5 November2026: [successful run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/41998406883) / [receipt](security-fr-2-batch-w-password-session-pass.json). The current plan selects exactly AU03.03/AU05.01/AU05.02/AU05.04; all four have scoped passes. The [full run protocol](SECURITY_FR_2_5_BATCH_W_PRIVATE_PASSWORD_SESSION_CHECKS.md) fixes their actions and limits. Sixteen local guard checks pass. Token rotation updates the same session's cleanup credential; early/app logout acknowledgements are recorded once. The failed initial numeric-error classifier run and its cleanup are retained separately.

The refresh test accelerates only isolated cached expiry metadata while using the real app timer/server response. The push test injects a browser registration-lookup error while using real Auth logout. Natural hour-long expiry, actual push delivery and protected push-row DELETE failure are not inferred. Three new sessions were locally logged out; no exact tagged rows remained. Normal app foreground activity recorded four analytics RPCs. No owner password/command/upload is needed for this completed run. Remaining original account-switch/recovery/rate and legacy/configuration obligations remain open, along with older unbound Node cleanup and V/X/Y/Z.


## Latest completed finite run: account switch and stale-session denial

FRE299 [live run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/42000458416) / [receipt](security-fr-2-batch-w-account-switch-stale-session-pass.json): AU05.06 actual Business staff view, one real unchanged held response, distinct stock-SDK session adoption/broadcast, cleared branding/activity/dialogs, no late protected-view restoration and replacement Personal persistence all scoped PASS. AU05.07 stale-session denial variant passed: the new old-actor runner session was locally revoked, its JWT was still before expiry, and the current server contract/own-profile read denied protected access. Rate UI/quota remains separate.18 local guards passed;3/3 new sessions received scoped logout acknowledgement and no exact tagged session rows remained.

[Current password configuration readback](security-fr-2-batch-w-current-password-config-readback.json) independently shows Secure password change and Require current password both disabled; Save was disabled and Cancel closed the dialog. AU03.05's conditional requirement is not applicable in current staging. No setting or credential changed. Remaining work is original recovery/legacy-password/rate-UI/exact-old-session closure; AU03.04 retry stays owner-deferred.


## Latest completed finite run: recovery request feedback

FRE300 [live run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/42012681035) / [safe receipt](security-fr-2-batch-w-recovery-feedback-pass.json): real absent-recipient HTTP200/generic copy, actual browser-blocked request with retained form and useful retry guidance, controlled Auth429 UI classification, and no-dispatch local cooldown in all three isolated contexts passed. Existing known-recipient acknowledgement is reused. No existing-recipient reset request was forwarded.24 local guard tests pass;3/3 created sessions received local logout acknowledgements, all3 browser contexts closed and exact tagged session rows are0. Saved ordinary and Admin credentials are privately classified as not shorter than8; values and exact lengths are not exported. A real provider quota/reset, Business Edge502 UI result and email delivery are not claimed.

The [remaining recovery fixture protocol](SECURITY_FR_2_5_BATCH_W_PRIVATE_RECOVERY_CHECKS.md) is prepared but not executed. Supabase's rollback-only exact-fixture cleanup confirmation expired, so no disposable accounts or real test mail were created. The workflow retains contents-read permission, no status-write grant and no GitHub token in the test step. Do not start fixture creation until the guarded cleanup prerequisite is resolved. Existing AU03.04 deferral, older unbound-session uncertainty and later V/X/Y/Z/FR/stage limits remain.


## Later disposable recovery attempt stopped; exact cleanup required

FRE301 [stopped run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/42014057621) / [safe outcome](security-fr-2-batch-w-recovery-rate-stop-cleanup-required.json): the rollback-only rehearsal succeeded; two new disposable accounts were confirmed through encrypted private handoffs. The recovery request returned actual Auth429 over_email_send_rate_limit, correlated by exact runner User-Agent/request ID in read-only logs. The runner stopped without another attempt, before any recovery variant/password update. Two created sessions were locally logged out, but2 empty fixture accounts/Personal workspaces remain with0 sessions. Both actual Supabase cleanup confirmations expired. Approve and execute only the [saved guarded cleanup SQL](../../supabase/diagnostics/security_fr_2_5_recovery_fixture_cleanup_w300.sql), then read back exact absence before any further test mail/fixture run. Do not infer a reset time or alter quotas.

The latest branch restores contents-read-only permission, removes the test-step GitHub token/status-write grant and removes the expired mailbox at the tip. Future recovery execution therefore refuses before creating any fixture until finite access is reviewed again.25 local guards pass after adding safe request-outcome classification; that change is not hosted-rerun. Prior FRE300 feedback results remain accepted; no original account password, finance/shared data or role was targeted.
