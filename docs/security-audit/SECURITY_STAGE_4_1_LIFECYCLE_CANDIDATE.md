# 4.1.2 — Account lifecycle review candidate and local checks

**COMPLETE at offline candidate/local scope — 11 October 2026, S4E02.** Baseline parent `6b0f30c116ecb4fdddbf43b4ccd3671cbaf3e622`; branch `security/stage-3-authorization`. **46 PASS / 0 FAIL, exit 0; three syntax checks PASS**, Node v24.19.0. Next is **4.1.3**, one bounded acceptance/readiness outcome. The full Stage 4 report remains due at **4.4**.

This is a local review/preflight and state-transition model. It does not implement or install a product deletion endpoint, privileged worker, durable queue, Storage/Auth adapter, public deletion page or adopted retention policy. No account or file has been deleted. F02 and DL-R01–DL-R06 remain OPEN.

## Prepared artifacts

| Artifact | Purpose and limit |
|---|---|
| [Offline review module](../../scripts/lib/stage-4-lifecycle-review.mjs) | Trusted synthetic identity/inventory ports, self-request/preflight gates, immutable review plan, safe summary and pure retry simulation |
| [Lifecycle tests](../../tests/stage-4-lifecycle-review.test.mjs) | 35 review/preflight cases and 11 state-simulation cases, using fictional UUIDs, fake tokens and TEST-ONLY decisions |
| [Local verifier](../../scripts/verify-stage-4-lifecycle.mjs) | One finite Node batch plus syntax/hash receipt; no install, credential or hosted request |
| [Local result and SHA-256 hashes](security-stage-4-lifecycle-local-checks.json) | Exact current candidate/test/verifier/decision-template hashes and scope flags |
| [Unapproved retention template](security-stage-4-retention-decisions.json) | Eight unresolved categories; approval flags false, legal/product decision fields null |
| [4.1 source review](SECURITY_STAGE_4_1_ACCOUNT_LIFECYCLE.md) | Selected source declarations, existing transfer/removal behavior, 25 frozen DL01–DL05 hosted cases and original actions |

The module lives under scripts/lib and is not imported by the app, Business UI, public site or Edge entrypoints. It has no network, SQL, Auth, Storage or filesystem integration. Its only external behaviors are the injected synthetic verification/inventory callbacks. The verifier writes a local safe receipt when given an output path.

## Candidate request and identity boundary

The accepted request shape contains only `request_id` (UUID) and exact confirmation `DELETE MY ACCOUNT`. Caller-provided target UUID/email/project/verified flags are rejected before inventory access. Only the trusted verification port supplies the subject/session and verification/expiry state. Inventory is requested for that verified subject.

A server-verified source, active session, unexpired identity and recent verification are required, including a second time check after inventory loading. Browser claims, absent/stale/future verification, wrong subject and adapter failures produce DENIED/BLOCKED with no plan or private exception details. A token's issuance time must not be substituted for genuine recent verification in a future adapter.

**The model does not verify a real JWT or prove a hosted session.** A boolean/string fixture field is not a production authentication mechanism. Integration must verify genuine Auth identity/session and recent verification server-side, bind durable requests to that subject, enforce replay/rate limits and guard sensitive operations. The proposed five-minute recent-verification limit, one-minute snapshot age and three attempts per phase are model bounds, not approved settings, legal deadlines or user-facing guarantees.

## Preflight and unresolved decisions

A snapshot must be scoped to staging `dczlddwbtgvfdujgcitb`, the verified subject and current revision, and marked server-enumerated. The production project `kttkospkblwvguuwnhjj` is rejected in the candidate. Required independent confirmations:

- Complete database, Storage and copied-identity inventories; missing enumeration is not silently empty.
- Current source/constraint parity, historical finance integrity and recoverable isolated testing.
- Verified provider lifecycle and residual-access controls.
- Reviewed ownership resolution for every workspace: Personal closure; ordinary shared member departure; valid successor transfer; or separately approved shared closure.
- Current product guards remain satisfied. A Family transfer needs a reviewed guarded implementation; none was established at 4.1.1. A blocked Business guard stays a blocker, with no subscription/role bypass.
- All eight data categories have approved disposition, decision ID, purpose, supported grounds, expiry rule, access rule and notice version, plus approved operator facts.

The tracked template intentionally has no approved category or adopted deadline. A test loads that **actual template** and confirms it blocks even an otherwise complete synthetic inventory. TEST-ONLY purposes/grounds/expiry in positive tests cannot approve the product policy.

Inventory-completeness, current-guard and provider flags are trusted-port assertions in this model, **not collected or independently proven facts**. Actual adapters must enumerate final constraints/triggers/transitive references, authoritative rows/copied identity, original/derived object ownership and processor/session state. The 38 declarations from 4.1.1 remain a selected source inventory, not a final hosted catalog.

## File and shared-data boundaries

The candidate refuses foreign scope, wrong owner, unauthorized foreign-object mutation, malformed/ambiguous traversal paths, duplicate object keys, unapproved shared-object actions and disposition/decision mismatch. Same name in different buckets remains distinct. Shared transfer requires a verified different recipient and explicit action approval. Retained files cannot still be Storage-owned by the departing user; an approved transfer/removal outcome must resolve that dependency first.

This is a conservative manifest model, not complete validation of all valid Storage names or a proof all objects were found. Do not derive authoritative file cleanup solely from loaded browser arrays, assume a path prefix proves ownership, delete all UUID matches, or drop financial FK guards. Retention of shared finance/files needs supported category and object decisions that preserve other users' legitimate records while minimizing personal data.

## Simulated resumable states

The seven ordered phases are:

1. Capture and acknowledge the authoritative durable manifest.
2. Revoke/gate application access.
3. Resolve approved ownership.
4. Remove file bytes or verify approved transfer and absence of departing Storage ownership.
5. Resolve approved data actions and verify historical integrity.
6. Verify Auth account removal.
7. Reconcile data, files, processors, backup treatment, residual-access window and approved retention.

These are **synthetic proof receipts**, not executed effects. Each receipt binds request/subject/revision/operation; current revision and guards must still match. Out-of-order effects and foreign/stale receipts throw before progress. Confirmed-phase replay does not repeat a simulated effect. Failure or missing proof keeps RETRY_REQUIRED; three unsuccessful attempts reach MANUAL_REVIEW. Later effects cannot jump over unfinished work.

Auth-absence proof alone is insufficient for simulated completion. Final reconciliation reaches only **SIMULATED_COMPLETE**; all outward summaries still say `account_deleted=false`, `execution_allowed=false` and `hosted_acceptance=false`. This does not prove durable persistence, crash recovery, provider cleanup or exactly-once side effects. A future worker needs durable leases/checkpoints, transactional version checks, idempotent effect keys, bounded retry/backoff and independent reconciliation, with a truthful partial-failure state.

Storage and Auth are separate services. An actual worker must use the Storage API for bytes and keep a manifest before destructive metadata work. Hard Auth deletion affects refresh/session state but does not retroactively revoke every already-issued JWT; actual sensitive-operation gates and residual signed-URL/device/provider behavior remain hosted tests. See [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), [sessions](https://supabase.com/docs/guides/auth/sessions), and [Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects), checked 11 October 2026. No setting has been changed to implement these controls.

## Local verification

| Batch | Expected | Observed |
|---|---|---|
| 35 review/preflight cases | Safe positive synthetic plan; denial/blockers for spoof/stale identity, production/stale inventory, actual unapproved template, absent data decisions, ownership/shared/file hazards and safe-summary leakage | 35 PASS |
| 11 pure state-simulation cases | No effects before durable manifest; strict phase/receipt/version order; failed Storage does not advance data/Auth; bounded retry/manual review; no false completion before reconciliation | 11 PASS |
| Syntax | Module, test and verifier parse | 3 PASS |
| Hosted DL01–DL05 | Genuine deployed self-deletion/provider/byte/access/retention behavior | 0 run; 25 planned cases remain unverified |

Counts are named test cases, not every loop assertion, database tests, live Auth checks or new finding closures. Existing application/SQL/Edge/native source was not edited; this batch does not replace final full regression/re-audit.

Optional offline reproduction from a checkout containing this candidate:

```powershell
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'
node .\scripts\verify-stage-4-lifecycle.mjs
if ($LASTEXITCODE -ne 0) { throw 'Lifecycle model checks failed.' }
```

No owner action is needed now. This command is documentation for a candidate checkout, not permission to deploy or delete identities; it prints only the local summary.

## 4.1.3 prerequisites and bounded handoff

The next milestone records one acceptance/readiness outcome. Required prerequisites are approved data/ownership/operator decisions; genuine deployed workflow with durable safe adapters and usable in-app/web paths; exact final dependency/source parity; separate recoverable owner-controlled disposable identities/workspaces/files; provider/access/recovery controls; and scoped permission for actual test effects.

Those prerequisites are **not available as verified evidence at this checkpoint**. Do not request erasure of the existing Stage 1–3 audit accounts, retry the earlier generic delete-all-UUID approach, create/elevate the sole operator, deploy a mock or substitute a manual dashboard deletion. If prerequisites remain unavailable at 4.1.3, record **BLOCKED / 0 hosted checks**, retain all six DL actions and advance to 4.2.1 under the finite Stage 4 plan.

Preserved: `audit.owner@example.com`, `audit.outsider@example.com`, all previous Personal/Family fixtures, the inactive former member and two USD1 conversions. No hosted account, Auth, Storage, SQL, setting, provider/email/job, production or native change occurred at 4.1.2.

| Action | 4.1.2 progress | Still required |
|---|---|---|
| DL-R01 | Eight-category decision template prepared; unresolved template blocks planning | Adopt supported factual retention/ownership/operator decisions and disclosures |
| DL-R02 | Self-request shape/recent identity/preflight gates modeled and tested | Genuine server verification, persistent idempotent request, usable initiation/status flow |
| DL-R03 | Personal/member/owner transfer/closure and current-version guards modeled | Exact dependency catalog, guarded household path, approved shared closure and actual invariant effects |
| DL-R04 | Manifest/ownership/file-scope/order/retry/reconciliation modeled | Authoritative collectors, actual Storage/Auth/data adapters, durable partial-failure recovery and provider/backup treatment |
| DL-R05 | Access/provider confirmations required; false completion refused | Genuine JWT/refresh/signed URL/realtime/push/cache/provider tests and installed access gates |
| DL-R06 | 46 local model cases recorded separately from DL01–DL05 | Functional public/in-app paths and all 25 scoped hosted cases; final fresh full re-audit |

[Stage 4 plan](SECURITY_STAGE_4_DATA_PRIVACY_PLAN.md), [evidence](security-stage-4-evidence.json), [carry-forward](SECURITY_AUDIT_CARRY_FORWARD.md), [progress](SECURITY_AUDIT_PROGRESS.json).
