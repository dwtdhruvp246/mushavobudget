# Windows result received — FR.2.4.E4.5: 93 PASS, exit 0

16 October 2026, FRE69. [Owner receipt](security-fr-2-email-ui-owner-Windows-pass.json) records 93/93 PASS on Node v22.17.0/PGlite 0.5.8, with all 71 source hashes and 11 syntax checks matched. No warnings were reported in the three selected groups. This supersedes the Windows-pending action below. The next source checkpoint [connects the screen to actual app entry](SECURITY_FR_2_4_EMAIL_SCREEN_PASS_AND_APP_ENTRY.md); no hosted installation or full finding is accepted. Original FRE68 evidence is retained below.

---

# FR.2.4.E4.5 — Edge checks passed on Windows; shared email screen and Admin contract ready

16 October 2026, FRE68. The [owner Edge receipt](security-fr-2-email-edge-owner-Windows-pass.json) records 88/88 PASS, zero FAIL, exit 0 on Node v22.17.0 and PGlite 0.5.8; 84 input hashes and 23 syntax checks matched. The stripTypeScriptTypes warning is non-failing. This completes the E4.4 Windows repeat, not deployment or full hosted acceptance.

## Concrete source

[email-verification.js](../../email-verification.js) provides the actual reusable browser controller and form renderer. The screen uses an explicit Send email code action; merely opening it does not send mail. Remember this device for 7 days defaults off. Codes remain in the form until submission, then the input clears before the asynchronous verify call. No password, code, challenge secret or device credential is written to local/session storage, URLs or logs. The browser receives an opaque challenge ID; the remembered credential remains a server-set HttpOnly cookie and is never read by this component. Changing the remember choice after requesting a code invalidates the current local challenge and requires a new code request.

Requests use the current bearer, same-origin HTTPS POST, the gateway CSRF header, same-origin credentials, no-store, redirect:error and no-referrer. JSON reads are bounded to 4096 bytes; network/body reads and RPC waits each have an eight-second bound. Only fixed user-facing error messages are rendered using textContent. The renderer exposes code input, send/resend, retry, remember and sign-out controls; sign-out remains available while other controls are busy. The owning page supplies its DOM and sign-out callback.

A gateway VERIFIED or APPROVED response alone never unlocks the screen. The controller rechecks the no-argument email_gate_current_session_verified RPC with an exact boolean/error contract. Admin mode additionally requires the new versioned Admin response and one of the existing platform roles. Account switches, bearer replacements and explicit lock abort pending browser requests, discard the challenge, invalidate old access tickets and suppress stale completions. onInvalidated lets the owning page clear its private state immediately; onUnlocked receives an access ticket that its later asynchronous work must recheck. There is no locally fabricated proof, AAL2 flag or role exemption.

[New offline SQL candidate](../../supabase/candidates/security_fr_2_4_email_admin_status.sql) creates only email_gate_admin_status(). It requires a separate offline acknowledgement and the prior database guards. It first checks the actual private session predicate and returns the same contract:1/verified:false/authorized:false/role:null response to every unverified caller without querying app_admins or profiles. After proof, it checks the caller's existing app_admins assignment and active profile; the four roles remain super_admin, admin_staff, finance_staff and support_staff. A verified ordinary account remains unauthorized. Only authenticated has EXECUTE. Existing public routine bodies, ACLs, settings and all 82 restrictive policies remain unchanged; no role assignment or old MFA function replacement is included.

## Validation

[Verifier](../../scripts/verify-fr-2-email-ui.mjs), [71-file manifest](security-fr-2-email-ui-source-manifest.json), [local receipt](security-fr-2-email-ui-local-checks.json), [contract](security-fr-2-email-ui-candidate-contract.json).

| Batch | PASS |
| --- | ---: |
| Shared controller and actual form renderer with a minimal DOM adapter | 29 |
| Actual controller, gateway, SQL and Admin status integration | 14 |
| Existing gateway and transport regressions | 50 |
| Total | 93 |

All 93 pass, exit 0, with no failures/cancellations/skips/todo, 71 matching hashes and 11 JS syntax checks on local Node v24.19.0/PGlite 0.5.8. The integration loads all 54 unchanged migrations and the actual E2/session/application guards and new Admin status. It drives the actual browser controller through the actual gateway and crypto into SQL. Auth acceptance, shared limiter, mailbox and browser cookie handling are explicit synthetic ports. The form tests execute the renderer/event callbacks against a minimal DOM adapter, not a real browser engine or accessibility audit.

The tests establish genuine stored proof through the SQL challenge/delivery/verify flow, then confirm exact Admin roles, ordinary-user denial, assignment removal, another account's denial and caller-bound state. Device restore works in a fresh same-account session without another mail call and does not move its expiry. A privileged synthetic clock fixture advances the stored device timestamps: an existing verified session still works while a fresh session requires a new code, without automatically sending mail. Remember-off clears the modeled cookie and creates no reusable device. Password changes and suspension invalidate proof; reactivation does not revive it. Other tests cover SQL install prerequisites/ACLs, forged AAL2/roles, stale account/token completion, malformed/oversized/HTML responses, timeouts, code rejection and duplicate sends.

## Integration boundary and next work

This commit adds the shared screen and replacement status contract. It does not yet attach the screen to app.js/business.js startup or replace the current Admin page's controller/view. Those app entrypoints currently load protected data before a global email gate; they must be wired before enabling the database guards. The old TOTP UI/helper remains historical source and is not called by this new component. Email proof does not satisfy the former stronger TOTP/AAL2 acceptance criterion; all original findings remain open.

Next, wire the shared gate before every private app/Business load, including identity changes, refreshes, error recovery, realtime and workspace routing, then replace the Admin view with this status contract. Update the public/native/staging asset builders and generated headers for the new module; integrate canonical schema and a versioned migration; coordinate the Pages gateway, database, supported clients and Edge deployment. Real browser/PWA, cookie, Auth/JWT, provider mail, recovery, operator readiness, full regression and hosted acceptance still need evidence. No partial hosted enablement is requested.

## Owner action

Run the complete pinned PowerShell batch in chat. It exports selected source to a new temporary folder, installs the same one locked PGlite dependency with npm.cmd ci --ignore-scripts and executes the new verifier. npm may contact the public registry; the checks disable default Node fetch/HTTP and use synthetic ports. This guard is not an OS sandbox. The package name/version and lock registry/integrity metadata are checked; installed package bytes are not independently hashed.

Expected: OFFLINE_EMAIL_SCREEN_ADMIN_STATUS_AND_ACTUAL_GATEWAY_SQL_INTEGRATION_SCOPED_PASS, 93 PASS, zero FAIL, exit 0. Return the JSON and exit code. No hosted SQL, password/token entry, Zoho DPAPI access, Cloudflare change, upload or email is requested. Existing source checkout and root dependencies stay untouched.

All 20 original findings remain open; release gate OPEN_PENDING_REQUIRED_EVIDENCE, final re-audit PLANNED_NOT_PERFORMED. Original stage objects, prior events, coverage rows, retained fixtures and manual conversion baseline are preserved. Production excluded; APK/native deferred.
