# 3.4.2 — Admin MFA candidate and offline verification

**Complete at candidate/local scope, 11 October 2026 — S3E20.** Audit parent `9703bcac1731c1f5b68b7c3537ab0e27b3a2ae72`. **90 local checks pass, exit 0**: 58 database behavior checks, 16 controller/Edge tests and 16 existing regression tests. Three JavaScript syntax checks also pass. This is not hosted MFA acceptance or deployment. Two of three 3.4 milestones now have outcomes; next is the single bounded **3.4.3** readiness/acceptance checkpoint. F08/F15 remain open; full Stage 3 report stays at 3.6.

## Concrete candidate

| Artifact | Candidate behavior |
|---|---|
| `admin-mfa.js`, `app.html`, `app.js` | Authenticator setup key, six-digit challenge, retry/cancel/sign-out and replacement/removal controls; backend authorization checked before administrative loads. Session/token transitions invalidate load tickets; administrative arrays, generated DOM, dialog/form data and enrollment secret are cleared on loss/switch/logout. No extra token/secret storage or SDK-error logging is added. |
| `supabase/candidates/security_stage_3_admin_mfa.sql` | Separate review candidate, outside the 52 ordered migrations. Adds active-profile/verified-TOTP/`aal2` authorization helpers. Replaces 30 reviewed routines and administrative branches of 55 public plus 3 Storage policies. Preserves raw identity, exact existing role sets and permitted owner/member/public/service branches. |
| Administrative Edge functions and `_shared/admin-assurance.mjs` | `invite-admin-user` and the human `sync-exchange-rates` branch use the same getUser-validated bearer's user client for the server authorization RPC, before service writes, email or provider requests. Failure returns static `ADMIN_MFA_REQUIRED`/403. Existing operation roles and secret-authenticated currency schedule path remain. |
| Website packaging | Includes the imported MFA module. No workflow, production deployment or native build was executed. |
| `supabase/candidates/security_stage_3_admin_mfa_rollback.sql` | Explicit owner-only reviewed rollback restores frozen baseline routines/policies and drops new helpers. Refuses candidate source/policy drift. It restores the original pre-MFA authorization risks; it is not a client bypass or routine lost-factor recovery. |
| `supabase/diagnostics/security_stage_3_admin_mfa_readiness.sql` | Read-only selected source/shape/policy fingerprint, effective execute-grant counts, staff-role counts and verified active super-operator count. No user IDs, factor IDs, source bodies, credentials or secrets returned. It neither installs nor enrolls anything. |

The installation transaction guards all 36 reviewed source routines and all 58 changed policy definitions. It accepts two explicit source-body hashes: the exact ordered source LF body and its exact CRLF line-ending variant. It does not normalize arbitrary whitespace or permit the unresolved Business outbox body. It refuses missing recovery acknowledgement, absence of an active super Admin with a verified TOTP factor, a pre-existing candidate helper or reviewed source/policy drift. This is a safety precondition, **not proof that an existing operator is controlled or that recovery has been tested**. The caller's own limited `app_admins` role lookup stays available; raw `is_app_admin`/`is_platform_staff` identity functions stay unchanged. Existing routine ACLs remain unchanged.

The three newly selected Storage policies close direct staff proof-read/delete branches. Other Storage policies use the reviewed workspace/Family/Business proof helper paths; this is a selected closure review, not every document/path combination. Internal recipient selection, service invitation reservation and transaction permit identity checks stay raw and retain their API execute restrictions. Staff exclusions during Business ownership transfer remain exclusions. No account/factor/role, retained conversion/history, launch switch or unresolved outbox function is changed by candidate installation.

## Reproduce the offline batch

Use external PGlite **0.5.8**; no repository dependency/package changes are required:

```sh
node scripts/build-stage-3-admin-mfa.mjs /absolute/path/to/pglite/dist/index.js
node scripts/verify-stage-3-admin-mfa.mjs /absolute/path/to/pglite/dist/index.js
```

The [58 database checks](security-stage-3-admin-mfa-local-db.json) execute all 52 migrations, actual local policies and security-definer routines, using modeled Auth/Storage and grants. The [combined receipt and SHA-256 manifest](security-stage-3-admin-mfa-local-checks.json) records source artifacts and test counts. Checks include missing recovery/operator and changed-body/security-shape/policy refusal, exact CRLF compatibility, unchanged ACLs, all four staff roles at both assurance levels, known foreign row invisibility and denied-write readback, finance role preservation, own-role bootstrap, owner/member preservation, ordinary stepped-up-user/metadata forgery denial, Storage proof read/delete controls, stale `aal2` after last-factor removal, unverified-factor/suspension/missing-profile/revoked-staff denial, service backfill and internal grants, repeat-install refusal and reviewed rollback/preservation.

Controller/Edge tests execute the new controller and actual typed Edge handlers in isolated Node VM adapters. They cover denied/failed status, deferred account/token changes, enrollment versus authorization, invalid/valid mocked challenge, secret cleanup, factor-removal/replacement/refresh guards, invitation and currency denial before effects, exact human role matrix and existing scheduled currency path. Both actual dispatch handlers reject missing/wrong/empty secrets and forged source before queue work; local legitimate empty-queue controls return success without sending push. Currency positive controls call a local provider adapter only; invitation positive-role controls stop on invalid harmless input. **No email, provider or hosted queue call occurred.** Typed Edge execution is modeled Node execution, not a Deno gateway/transport deployment check.

During local preparation, the Storage model needed RLS enabled; the final 58-check receipt uses enforced Storage RLS. Two initial existing regression checks were blocked by incomplete local file retrieval (an added trailing migration newline and absent workflow). Restoring exact pinned baseline migration bytes and fetching the workflow resolved them; no migration/schema/test assertion was weakened. Final existing regression result is 16/16. These preparation failures are not reported as hosted security findings.

## Frozen acceptance and limits

The existing [A01–A05 matrix](SECURITY_STAGE_3_4_ADMIN_MFA.md) remains the hosted acceptance boundary. The local subset is exactly the 58 named database checks and 16 named controller/Edge tests in the receipts/source; the 16 regression tests are preservation checks. This does not assert every combination of staff role, RPC, table, request, concurrency, Storage path and session state.

Still **NOT VERIFIED/BLOCKED pending hosted prerequisites**: genuine Supabase-issued low/stepped-up tokens and invalid/valid TOTP; effective hosted definitions/grants/settings; isolated controlled privileged identity; safe recovery/re-enrollment; browser-rendered enrollment and refresh/resume UI; Deno/gateway configuration; real revoked-session behavior; legitimate safe hosted dispatch/provider control. No installed local Chromium was available, so browser rendering was not performed. Native Windows clipboard execution was not performed. Token `aal2` plus a currently verified TOTP factor and active staff profile is the server predicate; factor presence does not itself prove which enrolled factor produced a particular historical token or globally revoke every Auth session.

The two shared ordinary accounts and Personal/Family/manual-conversion fixtures remain untouched. Business hosted fixture/API acceptance stays **BLOCKED, zero API checks**, with its outbox source mismatch carried forward. Do not count local MFA results as a Business authorization pass.

## 3.4.3 — One read-only owner handoff

From the existing local repository folder in PowerShell, use the exact audit commit given in the chat handoff:

```powershell
git fetch origin security/stage-3-authorization
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }
$AuditCommit = '<exact pinned commit from the handoff>'
$sql = git show "${AuditCommit}:supabase/diagnostics/security_stage_3_admin_mfa_readiness.sql"
if ($LASTEXITCODE -ne 0) { throw 'Pinned readiness SQL could not be read.' }
($sql -join "`n") | Set-Clipboard
```

Open the Supabase SQL editor for **STAGING `dczlddwbtgvfdujgcitb`**, paste only this diagnostic and run once. Confirm the dashboard project selection yourself: this SQL cannot establish dashboard identity. Return the `admin_mfa_readiness` JSON or its error text; no screenshot or secret is needed. **Do not run either candidate installer or rollback, change Auth settings, create/promote an identity or send jobs/invitations from this handoff.**

Zero verified active super operators means `BLOCKED_NO_VERIFIED_SUPER_OPERATOR`. A nonzero count means only that a verified super operator exists; controlled test identity and recovery remain unverified. Source/policy mismatches are review blockers, not permission to bypass a guard. Missing Auth metadata or insufficient owner read access is a BLOCKED readiness result. The next bounded checkpoint records available hosted acceptance evidence or carries unavailable cases to final remediation without repeated setup loops.

## Operator recovery and rollout runbook — review candidate only

1. Review selected staged source parity/effective grants and a separate controlled staff identity. Do not promote `audit.owner@example.com` or `audit.outsider@example.com`. Verify project TOTP settings through an authorized operator path; source defaults do not prove hosted availability.
2. Review a private, operator-controlled lost-factor process and a second independent recovery/operator route before enforcement. Infrastructure-console MFA is separate from application-user MFA. Do not assume pinned SDK support for recovery-code APIs.
3. In a later explicitly approved staging rollout, permit factor setup without granting Admin data before SQL authorization is available. Prepare a verified isolated super-operator factor first; deploy server/helper/Edge and matching frontend changes as a coordinated reviewed release. Missing server RPC fails administrative authorization closed. Installation requires operator acknowledgement of the reviewed recovery process; no acknowledgement is supplied in this readiness handoff.
4. Prove genuine `aal1` denial/`aal2` permitted-role success, direct RLS/RPC/Edge controls, role/profile revocation and removal/refresh controls with denied-effect readbacks. Authorize provider/job/email positive controls only when harmless destinations and effects are independently ready; otherwise BLOCKED.
5. For a lost factor, use an independently authenticated authorized operator and privately verified identity, record the scoped action without secrets, reset only that isolated user's factors/sessions through the supported Auth administration route, then require re-enrollment and recheck. Confirm actual revocation behavior; factor-presence enforcement alone is not global JWT/session invalidation. Never recover by changing a browser role flag, disabling MFA globally or weakening RLS.
6. Exercise recovery against an isolated actor, never the sole operator. A last-factor removal is refused by the app; replacement requires another verified factor. Direct last-factor removal causes protected database access to fail even if an old JWT still carries `aal2`. A failed or switched-account enrollment may leave an unverified Auth factor: inspect/clean it only in that actor's verified session/operator process, never via a stale account action.
7. Owner-only rollback requires separate explicit review and exact candidate guards. Restore source/grants/policies as a coordinated release and record that original authorization risks return. Recovery acceptance and production promotion remain final-remediation decisions.

This completes 3.4.2 candidate preparation, not MFA enforcement. The full Stage 3 report/action plan remains due at **3.6**.
