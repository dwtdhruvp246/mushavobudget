# 3.4 — Privileged entrypoints and application Admin MFA

**Current — 3.4.2 complete at candidate/local scope, S3E20:** 90 local checks pass, exit 0. No hosted enforcement or genuine MFA acceptance. Two of three milestones have outcomes; next is 3.4.3 read-only readiness/one bounded hosted-or-BLOCKED checkpoint. Read [the candidate, receipts, recovery guidance and exact handoff](SECURITY_STAGE_3_4_ADMIN_MFA_CANDIDATE.md). F08/F15 remain open. The 3.4.1 findings below describe the unchanged baseline; the audit candidate is separate.

**3.4.1 source review complete — 11 October 2026, S3E19.** Reviewed audit parent `cc75028f6434635ba9d33d56ea2aec7a7e26a20e`. This records source boundaries and a frozen request matrix; it does not record hosted authorization or MFA acceptance. Next is **3.4.2**, a staged candidate and meaningful local verification. Stage 3's full report remains due at 3.6. F08/F15 stay open.

## Three bounded milestones

| Milestone | Work | Current outcome |
|---|---|---|
| 3.4.1 | Review platform privilege paths, current MFA/recovery evidence and the existing A01–A05 caller matrix | Complete at selected source scope; no hosted acceptance |
| 3.4.2 | Prepare enrollment/challenge, protected backend/Edge candidate and recovery runbook; prove permitted/denied behavior and preservation locally | Candidate prepared; 90 local checks pass; not deployed |
| 3.4.3 | One controlled staging acceptance batch with genuine stepped-up staff sessions and safe service controls | Next: read-only readiness and one bounded acceptance/BLOCKED result |

## What the source shows

`app.js` loads the caller's `app_admins` row in `loadAccess`, sets `state.isAdmin`/`state.adminRole`, then loads both direct tables and administrative RPCs. The reviewed app, signup page and plan module have no Supabase MFA enrollment/challenge/assurance flow. UI role checks exist, but hiding a tab cannot protect a direct request.

The current SQL helpers `is_app_admin()` and `is_platform_staff(text[])` check server-side staff identity/roles without an assurance requirement. Some RLS policies use them; other policies query `app_admins` directly. Some newer RPCs explicitly check `my_account_suspended()`, while older helpers and selected administrative RPCs do not contain that check. This is a source mapping observation, not a demonstrated hosted suspended-account exploit; restrictive policies, triggers, grants and complete call paths affect reachability.

The reproducible local catalog inventory applies all **52 ordered migrations** to PGlite 0.5.8 with minimal modeled Auth/Storage and broad modeled default grants. It identifies **36 public routines** whose bodies directly reference staff helpers/rows or whose names start with `admin_`, and **55 policies across 34 public relations** with direct staff references. None of these 36 bodies contains the selected explicit assurance patterns. The [inventory](security-stage-3-admin-source-inventory.json) contains signatures, body hashes and source policy expressions, not customer rows. These counts are a syntactic selection, not every transitive privilege path, Storage policy, dynamic call or effective hosted grant. Modeled grants are explicitly labeled and must not be treated as deployed grants.

Reproduce the source inventory without hosted requests or repository dependency changes:

```sh
node scripts/inspect-stage-3-admin-source.mjs /absolute/path/to/external/pglite/dist/index.js /absolute/path/to/local-output.json
```

## Selected administrative boundaries

The existing four platform roles remain `super_admin`, `admin_staff`, `finance_staff` and `support_staff`. MFA adds an assurance requirement to each operation's existing role rule; it does not grant broader permissions. The proposed candidate protects administrative reads as well as writes for all four roles. Ordinary customer workspace operations keep their current account/membership/entitlement rules.

| Entry point | Current source authority | Required candidate/recheck boundary |
|---|---|---|
| Admin directory, finance, support and enquiry direct table requests | Mixed helper-backed and direct `app_admins` RLS branches | Every administrative branch requires authorized active staff and verified assurance; preserve owner/member/public branches where already permitted |
| `admin_analytics_foundation`, `admin_analytics_page`, `admin_subscription_monitor` | Existing staff helpers; no explicit assurance check | Protect direct RPC calls and administrative returned rows, including low-assurance existing staff |
| Plan workbench/scheduled price and Business billing settings | `super_admin` or `admin_staff`; newer RPCs check suspension | Same role allowlists plus server assurance, version/dependency controls and denied-effect readbacks |
| Subscription review and currency administration | Operation-specific role sets, commonly super/admin/finance | Retain each exact allowlist; assurance cannot turn support staff into a finance writer |
| Business support snapshot and subscription-payment detail | Existing source permits all four staff roles for these reads | Stepped-up staff-only reads, known foreign-customer records and stale/revoked caller controls |
| Business suspension/status and owner transfer | Status: super/admin; transfer: super only | Same role/state/replay rules plus assurance; safe synthetic targets only |
| Manual entitlement grant | `super_admin`, active caller and existing source limits | Verified super Admin, exact synthetic target/readbacks, no fabricated payment or launch-switch change |
| `set_user_account_status` and account-status trigger | Super/admin or protected service path | Protect caller assurance/active status and target restrictions; do not suspend either shared previous-stage account |
| `invite-admin-user` Edge function | `getUser` validation then service-side super/admin lookup; service reservation/delivery calls | Validate the same bearer session's assurance and active caller before any service mutation/email; no client role/MFA flags |
| `sync-exchange-rates` manual Edge branch | Verified caller plus service-side super/admin/finance lookup | Human branch requires assurance; scheduled branch retains its dedicated secret authentication |
| `dispatch-push-reminders`, `dispatch-admin-notifications` | Nonempty matching `x-mushavo-cron-secret`, POST and exact `source=cron`, before queue work | Missing/wrong-secret denials and safe legitimate control; interactive MFA must not replace job authentication |
| Customer `invite-business-member` and `send-test-push` | Verified app caller plus existing workspace/recipient checks | Preserve customer semantics; a Business Admin label is not platform staff or a new mandatory customer MFA rule |

Source dispatch secrets are read from server environment/Vault configuration. The cron files use named secrets and source placeholders; no actual value is obtained or used in this review. Source config has `verify_jwt=false` for selected functions that perform custom authentication. This flag alone does not prove an unauthenticated execution path, and hosted gateway/configuration parity is unknown. Admin and Business invite sections are not explicitly listed in the reviewed config; their hosted gateway setting is not inferred.

## Candidate design constraints

1. Keep raw staff identity separate from privileged authorization. Do not simply redefine `is_platform_staff` to return false at low assurance: it is also used for shared workspace behavior, staff exclusion and other identity decisions. Preserve identity semantics; gate each reviewed positive administrative privilege branch. The caller's own limited staff-role lookup must remain available for bootstrap into enrollment/challenge, without opening the staff directory or privileged data.
2. Use server-trusted identity, active account status, existing operation role and sufficient session assurance together. PostgREST/RLS uses validated request claims; Edge verifies the bearer token and checks assurance for that same token before service-client work. Body fields, user-editable metadata and browser booleans cannot establish staff or `aal2`.
3. Add a TOTP enrollment/challenge view reachable before administrative data loads. Enrolling alone does not authorize actions: successful factor verification must produce a stepped-up session. Clear sensitive administrative state on assurance loss, refresh failure, logout or account switch; retain the appropriate enrollment/retry/sign-out route instead of an endless login loop.
4. Audit direct RLS branches and security-definer/service-client bypass paths separately. A new permissive policy does not narrow an existing permissive grant; an RPC can bypass underlying RLS as its owner. Check shared customer branches, dependent helpers and Storage proof-access helpers before any blanket restrictive policy or shared helper change.
5. Jobs retain protected service/cron authentication. Never accept browser `source=cron`, claimed `service_role` or client MFA fields as service authority. Missing/wrong-secret local tests must stop before enqueue/claim/provider calls. Any hosted positive control requires harmless controlled destinations/provider behavior; otherwise it is BLOCKED.
6. Prepare operator recovery before enforcement. No app-side password-only bypass, global MFA-off switch or self-assigned role. Lost-factor recovery requires a separately verified operator path, controlled factor/session reset, recorded action and re-enrollment. A real lockout/recovery test uses an isolated controlled staff identity, never the sole operator or either retained ordinary account. Factor removal and refresh must be checked against actual residual JWT behavior.

## Frozen A01–A05 acceptance matrix

| Group | Selected positive/negative controls |
|---|---|
| A01 — Platform role operations | Existing per-operation super/admin/finance/support permissions; ordinary/anonymous/Business-role denial; direct privileged table/RPC request; known row and denied-effect readback; role-field forgery cannot elevate |
| A02 — Revocation and suspension | Same-session revoked staff and isolated suspended staff lose administrative reads/writes; permitted ordinary owner/member controls remain usable; missing profile/role and inactive state fail the protected candidate boundary |
| A03 — Enrollment, challenge and backend assurance | Genuine TOTP enrollment, invalid/valid verification, conventional staff session denied, authorized stepped-up staff succeeds; ordinary stepped-up user still lacks staff authority; tampered bearer/MFA fields cannot substitute; direct RPC/table/Edge bypass attempt |
| A04 — Factor lifecycle, refresh and recovery | Safe removal/replacement, stale-session assurance behavior, refresh/resume, account switch and sign-out; controlled lost-factor/re-enrollment and rollback readiness; no enrollment secret/code/token appears in logs or receipts |
| A05 — Edge and service jobs | Human Admin invitation/manual currency branch assurance and role controls; service-only SQL helper grants; absent/wrong cron secret and forged source denial; safe legitimate job positive control or explicit BLOCKED provider/destination outcome |

Exact selected operations and counts are fixed during 3.4.2. These five groups are retained from the Stage 3 baseline; they are not an assertion of every combination of staff role, table, RPC, file and session state.

## Staging prerequisites and limits

Only STAGING `dczlddwbtgvfdujgcitb` and the staging frontend may be used for this acceptance. Production `kttkospkblwvguuwnhjj` is excluded. The two shared accounts remain ordinary active identities; do not silently promote them, remove their memberships or enroll them as the operator fixture. Preserve Personal/Family fixtures and both manual conversions.

A meaningful hosted positive MFA test needs a separately controlled platform-staff identity, enabled enrollment/verification settings, a genuine Auth-issued stepped-up session and a reviewed recovery path. Their availability is **unverified**, not assumed from source defaults or infrastructure-account MFA. No owner SQL, Auth setting change, enrollment code/secret, new account, staff elevation, invitation email, job/provider execution, deployment or APK update is requested by 3.4.1. 3.4.2 prepares the concrete candidate and preflight; 3.4.3 records unavailable hosted cases without endless environment setup.

The Business blocker and unrun batch remain on the [3.3 carry-forward report](SECURITY_STAGE_3_3_CHECKPOINT_REPORT.md). MFA work must not bypass the unreviewed outbox function, rewrite retained finance history or claim that Business authorization has passed.

## Primary documentation checked 11 October 2026

- [Supabase MFA overview and enforcement](https://supabase.com/docs/guides/auth/auth-mfa): enrollment/challenge must be paired with database/API rules; access tokens carry assurance claims. Factor removal can leave assurance in an existing token until refresh, so immediate global revocation is not assumed.
- [TOTP enrollment/challenge](https://supabase.com/docs/guides/auth/auth-mfa/totp): supported authenticator flow; documented default availability is not a check of this project's current settings.
- [Assurance API](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel): distinguish current and possible next assurance; a passed JWT is validated through a network request. The candidate must be checked against the pinned SDK and hosted behavior.

This source review closes one of three 3.4 work items. It makes no hosted security PASS claim and does not close F08/F15. The full Stage 3 report/action plan remains at 3.6.
