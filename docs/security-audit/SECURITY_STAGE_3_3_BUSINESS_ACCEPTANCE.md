# 3.3.2 preparation / 3.3.3 controlled Business acceptance

Prepared 11 October 2026 from audit parent `ebebb5e42fc0775d9098e4e1c701959304036012` (S3E16). Preparation is complete. **Hosted Business acceptance has not run.** Stage 3 remains active; its full report is due at 3.6. This is the same existing permission model, with no runtime migration, Auth setting, launch switch, platform elevation, production promotion or native change.

## Frozen executable scope

One fixture transaction creates two isolated Business workspaces for the existing `audit.owner@example.com` and `audit.outsider@example.com` accounts. Each has an ordinary Owner, seven-day synthetic entitlement with four seats, two active organisation dimensions, one synthetic expense category and two approved USD 1 owner claim seeds. Approved seed states are setup evidence, not a successful submit/review flow. Reminders and automatic conversion are disabled. The transaction uses the existing exact workspace/owner/actor provisioning permit and deletes it; no purchase, approval or platform-staff identity is fabricated.

The checker uses the two ordinary app sessions. It joins the second owner to the primary business through a database-only invitation, then uses the matching Owner RPC for six built-in and three custom role transitions. Six built-in effective permission sets plus the Owner set are captured without private identifiers. A Team Manager gets a permitted lower-role invitation control without blanket denial of all nonowners. The invitation for `audit.pending@example.com` is a synthetic unregistered placeholder, is never sent, and is cancelled by the matching manager. No new account or real inbox is required.

The executable success path has **24 PASS groups and five BLOCKED carry-forward groups**. In the local source adapter it uses 484 requests with both completed Family fixtures and the two manual conversions present. A hosted request count can differ if its previous-stage fixture inventory differs. The hard ceiling is 1,400 requests; every request has a 20-second timeout. It stops at the first REVIEW, attempts local logout of the generated sessions, prints no raw row/UUID/credential/response, and retains incomplete fixtures for review. Do not rerun a stopped or successful batch without reviewing its receipt.

| Group | Selected executable controls |
|---|---|
| B01 | Ordinary active identities, Owner and all six built-in effective permission captures, required dependencies, legitimate workspace/report controls, unknown permission, known foreign/anonymous rows |
| B02 | Known own/other-submitter claims, matching/outside assigned dimensions, custom own/assigned/all report row IDs, empty assigned scope, foreign Business rows |
| B03 | Owner custom role create/edit/archive, dependency and own-mode conflicts, protected system role, stale version, in-use archive/scope changes, nonowner/direct role or override writes, Owner deny/allow/clear, denied report view suppresses export permission |
| B04 | Owner invitation create/edit/cancel, correct recipient acceptance, wrong recipient/anonymous/cancelled/accepted replay, stale edit, matching scoped manager create/edit/cancel, self/Owner/foreign-member/privilege/scope escalation |
| B05 | Member USD 1 draft create/edit, other submitter and stale edit, foreign category/dimension/workspace, direct claim mutation, explicit missing-receipt state guard, unauthorized review; Owner draft budget and Finance Manager synthetic claim payment with denied/replayed counterparts |
| B06 | Exact known missing-receipt report rows under own/assigned/all, protected original export request, stale fingerprint, foreign filters/business, Viewer read positive and export denial |
| B07 | Exact member removal, same-session permission/known-claim/report loss, accepted invitation replay and direct membership reactivation denial; separate business Owner still works |
| B08 | Owner readbacks after denied mutations, direct-table and protected backend-permit denials, Business label never confers platform staff, selected secondary Business and prior Personal/Family/payment/conversion preservation |

| Carry-forward group | Reason and concrete follow-up |
|---|---|
| Complete claim submission/review and review replay | Submission requires a real controlled receipt. Check the missing-receipt guard now; later use a harmless uploaded/registered file to exercise legitimate submit/review/replay. Do not manufacture Storage metadata. |
| Receipt metadata and private original/download authorization | No harmless private object is prepared. Later test a known registered object with allowed/foreign/outside-scope/removed callers and owner byte readbacks. File content processing remains Stage 4. |
| Bill and spending-request lifecycle | Matching bill/request fixtures are not prepared for this finite batch. Later add exact synthetic supplier/bill/request parents and state/version controls, preserving disabled reminders. |
| Nonowner manager removes another ordinary member | A third distinct controlled identity is needed for a manager, target and protected Owner positive control. Owner removal and manager scope/escalation checks do not substitute for it. |
| Suspended account and expired entitlement acceptance | Isolated state fixtures are not prepared. Later test same-session permitted/denied transitions without suspending either shared previous-stage account. |

BLOCKED groups are not PASS, not errors to work around with production, and not evidence that every operation/role combination has been covered. Any failed/unavailable cases join final remediation and fresh re-audit. F08/F15 stay open.

## Local validation and dispatch limits

Eleven executable source scenarios passed using **PGlite 0.5.8**, all 52 ordered migrations, broad modeled default grants and deliberately minimal Auth/Storage/HTTP adapters. They include setup rejection for an unknown trigger, a changed trigger body and a known function attached as an unexpected trigger; completed Family removal and the two manual conversions as preservation controls; duplicate setup rejection; the complete selected lifecycle; and fault injection for misleading FK denial, missing RPC, hidden write, foreign-row leakage and logout failure. Eight isolated tests passed for environment rejection, strict denial classification, redaction and the extracted Windows Node expression.

This is local source evidence. Hosted PostgREST, native Windows PowerShell execution, Supabase Storage bytes, independent function/policy/grant parity, real delivery, scheduler/provider execution and full concurrency are unverified. No repository dependency was added: PGlite was installed outside the repository for local validation only.

Before fixture writes, the SQL checks the two exact synthetic Auth/profile identities, absence of staff assignments and pre-existing businesses, empty push subscriptions and no active cron jobs. Known involved public relations must have reviewed trigger bodies and associations. The selected trigger/static-public-call closure must match the prepared source-body hashes; recognized network/dblink/program-dispatch calls reject setup. These are conservative selected metadata guards, not independent attestation of every hosted extension/dynamic dispatch path. All template data stays synthetic; the checker never invokes invitation-email Edge functions, providers, scheduler or real payment channels. In-app notices and Business change counters are expected database effects. A guard mismatch is a bounded REVIEW/BLOCKED receipt, not permission to remove the guard or rebuild the environment indefinitely.

The SQL label cannot prove project identity. **Manually verify the Supabase Dashboard project is STAGING `dczlddwbtgvfdujgcitb` before pasting.** Production `kttkospkblwvguuwnhjj` is excluded. Keep all previously retained Personal/Family fixtures and two manual conversions.

## Complete owner handoff

Use the full pinned commit supplied in the chat handoff, not a moving branch head. Start in Windows PowerShell:

```powershell
$ErrorActionPreference = "Stop"
cd "C:\Users\HP\Desktop\Mushavo Budget"
git fetch origin security/stage-3-authorization
if ($LASTEXITCODE -ne 0) { throw "Audit branch fetch failed. Stop here." }
$mushavoBusinessCommit = (git rev-parse FETCH_HEAD).Trim()
# The chat handoff checks this against its concrete 40-character preparation commit.
git show "${mushavoBusinessCommit}:supabase/diagnostics/security_stage_3_business_fixture.sql" | Out-String | Set-Clipboard
if ($LASTEXITCODE -ne 0) { throw "Business fixture SQL could not be copied. Stop here." }
Write-Output "3.3.2: Business fixture SQL copied. Paste the whole script in STAGING dczlddwbtgvfdujgcitb only."
```

Paste the entire clipboard into that project's SQL Editor and run once. No password prompt is expected in this step. Expected receipt: `STAGING_BUSINESS_FIXTURE_PREPARED`, two businesses, four USD 1 claim seeds, four dimensions, seven entitlement days, four seats per business and all named enable/change flags false. Send only the summary or error code. If SQL fails, stop; do not disable triggers, change launch settings or run partial statements. The transaction rolls back its fixture writes on an error.

After its fixture receipt is reviewed, the pinned acceptance command is:

```powershell
$ErrorActionPreference = "Stop"
cd "C:\Users\HP\Desktop\Mushavo Budget"
if ($mushavoBusinessCommit -notmatch '^[0-9a-f]{40}$') { throw "Use the pinned preparation commit from the fixture handoff." }
$env:MUSHAVO_STAGE3_BUSINESS_COMMIT = $mushavoBusinessCommit
try {
    $mushavoBusinessRunner = git show "${mushavoBusinessCommit}:scripts/run-stage-3-business-acceptance.ps1" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoBusinessRunner)) { throw "Pinned Business runner could not be read." }
    & ([ScriptBlock]::Create($mushavoBusinessRunner))
} finally {
    Remove-Item Env:MUSHAVO_STAGE3_BUSINESS_COMMIT -ErrorAction SilentlyContinue
}
```

The runner prompts privately for the **staging app password** for `audit.owner@example.com`, then `audit.outsider@example.com`; neither is the database password. Both are passed only to the child process and cleaned up in `finally`, including secure buffers. The ASCII checker uses stdin to avoid Windows' single-environment-value length limit. Do not change execution policy. Expected result is `STAGING_BUSINESS_API_SCOPED_PASS_WITH_CARRY_FORWARD`, 24 PASS groups, five BLOCKED groups, no problem code and exit 0. A REVIEW produces exit 1 and retains incomplete synthetic effects. Share only the JSON summary and redacted error codes.

The 3.3.3 receipt is still required before recording a Business checkpoint summary. Setup alone is not authorization acceptance; source/local results are not added to the owner PASS total.
