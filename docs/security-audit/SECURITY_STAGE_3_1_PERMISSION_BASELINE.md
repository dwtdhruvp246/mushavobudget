# 3.1 — Permission map and baseline

**Checkpoint closed — 3.1.3, 10 October 2026.** All three finite baseline work items have outcomes. Owner supplied the complete eight-row STAGING inventory; source classification and the bounded follow-up matrix are recorded. Two narrow metadata checks pass, three rows require review, and three are informational. Application authorization tests and hosted body/production parity remain unverified. F08/F15 remain open. Next is 3.2.1.

## Three bounded work items

| Work item | Work | Position |
|---|---|---|
| 3.1.1 | Review current source, define the permission matrix and prepare one eight-row staging metadata inventory | Complete: source map, 12 local diagnostic fixture checks and owner PostgreSQL 17.11 eight-row receipt (S3E02–03) |
| 3.1.2 | Reconcile the received inventory with source; classify selected entrypoints and prioritize demonstrated gaps | Complete: 57 anonymous-executable definers classified at source/metadata scope; direct behavior, actual grant origins and hosted body parity remain pending (S3E04). No new runtime candidate justified by metadata alone |
| 3.1.3 | Record the baseline outcome and freeze the controlled 3.2–3.5 acceptance groups | Complete: 24 acceptance groups frozen, prioritized effects/rechecks recorded, no further baseline SQL requested (S3E05) |

Do not reopen Stage 1/2 or repeat their successful batches. The later stage-end report consolidates outcomes. Missing prerequisites do not create an unlimited sequence of baseline diagnostics.

## Existing principal and scope map

| Principal | Current source contract to verify | Sensitive boundary |
|---|---|---|
| Anonymous caller | Public signup/pricing lookups remain available; no direct private-row access or internal conversion writes | Public lookup is distinct from administrative/write RPCs |
| Personal owner | Selected own payments, paid records and workspace access; account/entitlement and currency guards still apply | Another user's IDs or payload ownership fields must not provide access |
| Family head | Existing family ownership, invitation/member administration and active entitlement rules | Head power is limited to the matching family; head role is not platform staff |
| Active Family member | Family participant rules permit selected shared reads and own attributed writes where existing policies allow them | Do not assume all member writes are forbidden or all household records are writable; test operation and ownership separately |
| Unrelated/removed Family member | No protected access through a former or foreign membership | Current membership and recipient checks must survive direct requests and stale UI |
| Business Owner | Active Business membership/entitlement plus owner operations; custom role administration is owner-gated | Workspace ownership is not platform Admin status |
| Business Admin (`business_admin`) | Seeded broad business permissions, subject to current overrides and scope/role administration guards | No self escalation, ownership assignment or authority beyond the manager's permissions/scopes |
| Finance Manager | Seeded finance, approval, budget, report and document permissions; membership/scope checks remain required | Finance permissions do not imply team/owner/platform powers |
| Team Manager | Seeded team management and selected finance/approval/report access, scoped by existing rules | Cannot assign a role or scope that exceeds their own authority |
| Staff / Contributor | Seeded creation and own-record workflows, with relevant view/approval restrictions | Must not read or change unrelated colleagues' private rows through substituted IDs |
| Viewer | Seeded read permissions; selected default write requests should be denied | Names are not enforcement: changed role permissions/overrides must be captured in the fixture's expected result |
| Custom role | Existing `own`, `assigned`, `all` scope modes; built-ins retain `legacy`. Required permission dependencies and member overrides apply | `all` refers to its workspace, not every workspace. No unsupported/owner-only permission via overrides |
| Platform staff | `super_admin`, `admin_staff`, `finance_staff`, `support_staff`; operations use different role allowlists | Do not treat every staff role as a universal Admin. Proposed app MFA is separately mapped in 3.4 |
| Service/cron | Protected backend operations use reviewed service/cron authentication | Browser-supplied fields do not confer service authority; legitimate jobs must remain usable |

Business role defaults are initial configuration, not immutable product permissions. `business_has_permission` checks active membership, account/entitlement, permission definitions and role validity; custom-role restrictions and dependencies precede member overrides and role permissions. `business_claim_in_scope` and reporting/operation-specific guards also matter. No single role label proves the final access decision.

The source contains broad platform exceptions in some workspace/Family helpers. These are explicitly reviewed in 3.4, not mistaken for a cross-tenant flaw in a test account that is itself platform staff. Synthetic outsider accounts must be verified as ordinary accounts.

## Bounded acceptance groups for the next steps

These are **24 selected groups**, not a claim of full combinatorial coverage. Each group requires a named operation, known synthetic fixture, verified caller, allowed positive control and denied variants. Freeze exact requests before each step's acceptance batch. Add a case only for a concrete source change, observed failure or uncovered sensitive boundary; document the reason.

| IDs / step | Selected groups | Expected evidence |
|---|---|---|
| PF01–PF06 / 3.2 | Personal own/foreign/anonymous reads; own/foreign create/update/delete; Family head/member/outsider shared reads and attributed writes; invitation recipient/pending/decline/replay/cancel; removed-member requests; selected currency settings/conversion-helper boundaries | Correct allowed effect; no unauthorized row revealed or changed; legitimate conversion flow retained. Family writes use the current ownership/entitlement model |
| B01–B08 / 3.3 | Built-in role permission snapshot; own/assigned/legacy scope; custom own/assigned/all roles; member allow/deny and dependency guards; invitation recipient/replay/cancel; self/role/scope escalation and removal; selected expense/bill/budget/approval operations; report/export/receipt access | Current per-fixture permissions and scope explain each result; cross-business substitution fails. No customer communication is required |
| A01–A05 / 3.4 | Platform role-specific operations; ordinary/revoked/suspended caller denials; Admin MFA enrollment/challenge and privileged aal1/aal2 requests; reviewed factor removal/recovery and refresh; Edge/cron absent/wrong/legitimate authentication | Verified identity/role and server assurance at protected actions; safe operator recovery; job checks use controlled dispatch destinations or recorded blockers |
| AU01–AU05 / 3.5 | Signup/confirmation/unconfirmed sign-in guidance; Admin/Business first-password invitation setup; normal sign-in and password change; recovery/expired/used links; refresh/logout/switch and selected rate/failure cases | Actual Free-plan-compatible backend settings match UI. Record residual token lifetime/revocation behavior, not an assumed immediate logout revocation |

The earlier Personal API read/no-op update receipt remains historical scoped evidence; it is not insert/delete, Family, Business, RPC, Storage or MFA proof. File-content handling stays in Stage 4, full social identity/shared email architecture in Stage 6, broader commerce in Stage 7, and device/notification lifecycle in Stage 8.

## One staging metadata handoff

Target: **STAGING dczlddwbtgvfdujgcitb**. Verify the Dashboard URL yourself before running. Production **kttkospkblwvguuwnhjj** is not this query's target. The SQL's project label cannot independently prove where it ran.

Use [security_stage_3_permission_baseline.sql](../../supabase/diagnostics/security_stage_3_permission_baseline.sql), copied from the pinned commit supplied in chat. Paste the entire script into one new STAGING SQL Editor query and run it once. It uses a read-only repeatable-read transaction, bounded timeouts, a single SELECT result set and ROLLBACK. It queries catalog metadata only, not application tables or routines.

| Row | What it reports | Meaning |
|---|---|---|
| 01 | Target label, timestamp, engine and read-only/isolation context | INFO; owner supplies hosted target confirmation |
| 02 | Three database API roles and public-schema access | INFO or REVIEW for missing roles; these are not user-facing roles |
| 03 | Public relation coverage, views/foreign tables, 24 selected tables' RLS/grants/policy/trigger counts | REVIEW; metadata cannot prove policy behavior or hosted source parity |
| 04 | Prior seven-table anonymous SELECT restriction, including column and inherited access | PASS/FAIL only for the narrow installed metadata restriction |
| 05 | 20 selected routine signatures, security-definer flags, search-path-setting presence and effective EXECUTE | REVIEW; no body, setting value or application routine execution |
| 06 | Two protected currency helpers' prior definition/grant metadata | PASS/FAIL only for installed helper flags and effective grants; legitimate callers/jobs still need behavior checks |
| 07 | Remaining anonymous public security-definer inventory | REVIEW; categorize triggers, public lookups and guarded RPCs before any revoke |
| 08 | Review boundaries and next batches | INFO; no Auth/MFA, runtime deployment or application data change |

Send **all eight result rows** using Copy/export CSV in the results panel, plus redacted errors if any. No screenshot, password, token, private endpoint or customer data is required. REVIEW is an expected inventory status, not a failed user action. A narrow PASS does not close F08/F15.

## Validation and evidence limits

[verify-stage-3-permission-baseline.mjs](../../scripts/verify-stage-3-permission-baseline.mjs) passed **12 disposable catalog fixture checks** using externally installed PGlite 0.5.8 / PostgreSQL 18.3. Repository dependencies are unchanged. Checks cover eight-row/read-only output; no customer/body/setting-value disclosure or application routine invocation; column-only, inherited and PUBLIC SELECT leaks; inherited signed-in helper EXECUTE; default PUBLIC routine execution inventory; disabled RLS; view/restrictive-policy metadata; missing helper/table/API role. Missing prerequisites cannot silently produce a narrow PASS.

This is local PostgreSQL-compatible diagnostic validation, **not native PostgreSQL 17.11 hosted execution**, verified application authorization, provider parity, or deployment evidence. The owner STAGING PostgreSQL 17.11 receipt was subsequently received in S3E03; it validates hosted query execution at owner-reported scope, not application behavior or independent hosted identity. No grant, policy, function body, Auth setting or runtime implementation has been changed in this checkpoint.

## Source references

- [Base schema](../../supabase/schema.sql): Personal/Family policies, workspace/role helpers and platform staff role vocabulary. It contains cumulative definitions; inspect later replacements and migrations before judging an operation.
- [Business security foundation](../../supabase/migrations/20260928070000_business_stage_2_security_foundation.sql): permission definitions, seeded role grants, document/RLS/RPC boundaries.
- [Business team rules](../../supabase/migrations/20260928170000_business_stage_4_team.sql) and [custom roles](../../supabase/migrations/20261004153000_business_custom_roles.sql): current scope/permission dependency, assignment/escalation and owner-only role administration contracts.
- [Suspension guards](../../supabase/migrations/20260925090000_expiry_and_account_suspension.sql), [private read restriction](../../supabase/migrations/20261006043000_security_stage_0_private_reads.sql) and [currency helper restriction](../../supabase/migrations/20261006050000_security_stage_0_currency_helpers.sql).
- [Admin invitation Edge function](../../supabase/functions/invite-admin-user/index.ts), [Business invitation Edge function](../../supabase/functions/invite-business-member/index.ts), [exchange-rate Edge authentication](../../supabase/functions/sync-exchange-rates/index.ts) and [function gateway config](../../supabase/config.toml): selected source authentication paths, not attestation of deployed versions.
- PostgreSQL 17 primary references: [privilege inquiry functions](https://www.postgresql.org/docs/17/functions-info.html), [policy catalog](https://www.postgresql.org/docs/17/catalog-pg-policy.html) and [routine catalog](https://www.postgresql.org/docs/17/catalog-pg-proc.html), reviewed 10 October 2026.
- [Six-step plan](SECURITY_STAGE_3_AUTHORIZATION_PLAN.md), [progress](SECURITY_AUDIT_PROGRESS.json), [Stage 3 evidence](security-stage-3-evidence.json) and [carry-forward](SECURITY_AUDIT_CARRY_FORWARD.md).


## 3.1.3 — Received result and baseline closure

Owner result timestamp: **2026-10-10T16:50:07.798355+00:00**, intended STAGING **dczlddwbtgvfdujgcitb**, PostgreSQL **17.11**, read-only repeatable-read. All eight rows received. Project identity still relies on the owner execution context; no hosted function/policy bodies or production parity were retrieved.

| Observation | Result and limit |
|---|---|
| Prior seven-table anonymous read restriction | **PASS**, effective SELECT/column restriction retained on all seven named tables |
| Two internal conversion/date helper restrictions | **PASS**, anon/authenticated cannot execute, service EXECUTE and expected definer/path metadata retained |
| Public application tables | 81; none reported with RLS disabled. RLS being enabled is not correctness of every policy |
| Selected objects | All 24 selected tables and all 20 selected routines present; all 20 have a search-path setting. Presence does not prove the path or function body is safe |
| Cashbook balances view | `security_invoker=true` metadata present; selected cashbook behavior is not tested by this query |
| Database API roles | anon/authenticated are non-superuser and do not bypass RLS; service_role has BYPASSRLS. Public schema USAGE is available and CREATE is false for all three |
| Broad anonymous grants | INSERT, UPDATE and DELETE remain effectively granted on 15 of the 24 selected tables. RLS still applies; this is a least-privilege/behavior review target, not proof a write succeeded |
| Elevated routines | 263 nonextension public SECURITY DEFINER routines total; 57 anon-executable, including 25 trigger/event-trigger return types; zero anon-executable entries lack a search-path setting |

### Classification of the 57 anonymous-executable entries

This partitions the received inventory at source/metadata scope, not into “safe” and “unsafe” verdicts. Matching migration symbols do not prove the hosted bodies are identical. The exact names/source locations are recorded in S3E04.

| Category | Count | Source contract / follow-up |
|---|---|---|
| Application trigger functions | 24 | Conversion locks, validation, account/finance guards, synchronization, notification and seed triggers; preserve legitimate trigger execution. A function grant is not proof it is an ordinary callable HTTP RPC |
| Provider event-trigger candidate | 1 | `rls_auto_enable` was previously present in fresh-target event-trigger metadata; application migration body not matched. Managed body/authority remains unverified |
| Public signup/pricing lookups | 2 | Existing explicit public catalogue/currency flows; preserve legitimate access |
| Shared currency information | 2 | Latest rates and status; source returns shared rate/status fields with Admin details gated. Review intended anonymous access and selected output scope; not a private-row write |
| Identity, membership and entitlement helpers | 12 | Source evaluates caller identity/membership or guarded entitlement/usage; false/empty is a valid denial for these reads. Platform staff exceptions require role-specific review |
| Signed-in owner/recipient/workspace operations | 10 | Family create/delete/invite/respond/remove, own provisioning/renewal/request, workspace currency settings/backfill; selected source guards exist. Test foreign identifiers, pending/replay/removal, account/entitlement and valid positive controls in 3.2 |
| Protected finance/platform operations | 6 | Admin subscription monitor, global currency backfill, Admin finance settings, manual conversion, plan definition/price. Source uses staff/owner/backend checks; manual conversion has different workspace/platform/subscription branches. Exercise those distinctions in 3.2/3.4 |
| **Total** | **57** | **No application routine was invoked in the baseline** |

### Prioritized controls and decision

1. **3.2:** verify ordinary/anonymous foreign-row reads and create/update/delete with legitimate positive controls. Include Family recipient/head/member/removal boundaries and owner/outsider currency/entitlement RPCs. An HTTP 200 alone cannot prove permission success or denial.
2. **3.3:** apply the existing per-fixture Business permission/override/dependency/scope rules, then test cross-business substitution and management escalation.
3. **3.4:** verify platform staff operation allowlists and direct protected actions at verified MFA assurance. Broad platform exceptions must be exercised separately from ordinary outsider accounts.
4. **Final remediation:** retain actual grant-origin/hosted body/production parity, managed event-trigger authority and unavailable API/device cases at their real scope; no finding closes from this inventory.

No new runtime migration is issued at the baseline: the two narrow restrictions are retained, while the broad grants require compatibility-aware direct testing. There is no blanket revoke, FORCE RLS change, secret/setup loop or further owner baseline SQL request. This finishes **3.1**, not Stage 3; five main steps remain. The frozen PF/B/A/AU acceptance groups above govern the next work.
