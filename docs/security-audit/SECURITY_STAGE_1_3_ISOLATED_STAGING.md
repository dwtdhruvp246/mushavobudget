# 1.3 — Isolated staging

**Current: CLOSED WITH SCOPED PASSES AND CARRY-FORWARD, S1E75.** Read the [checkpoint report](SECURITY_STAGE_1_3_CHECKPOINT_REPORT.md). Historical preparation instructions below are retained for traceability; do not repeat project creation or initialization. Active work advances to 1.4 synthetic recovery.

Started 8 October 2026 after [1.2 checkpoint closure with carry-forward](SECURITY_STAGE_1_2_CHECKPOINT_REPORT.md), evidence S1E63–S1E65. Stage 1 remains in progress; no full backup/recovery or release acceptance is inferred. Approved operating targets remain objectives, and existing DB/Storage/configuration/offsite gaps remain carried rather than reopen 1.2.

## Current owner target and preflight — S1E66–S1E67

Owner clarified there was only one legitimate database, Mushavo Budget, and no staging project. After separate Free-project creation instructions, the owner replies **done** and provides **dczlddwbtgvfdujgcitb**. Record staging created/reference at **owner-report scope**. It differs from production **kttkospkblwvguuwnhjj**; that string comparison is not independent hosted identity, actual database-version/count evidence or frontend/dispatch isolation proof. Paused-project count was not reported; no current complete account inventory or Dashboard eligibility result is invented.

**One read-only staging preflight before application-schema writes.** [Diagnostic](../../supabase/diagnostics/security_stage_1_staging_preflight.sql), [disposable fixture verifier](../../scripts/verify-security-stage-1-staging-preflight.cjs). Four rows report transaction context, PostgreSQL/extensions, five selected count indicators and explicit isolation/initialization REVIEW. Zero public nonextension relations/routines, Auth users and Storage buckets/objects gives a **narrow count-only PASS**; any nonzero counter gives REVIEW. Managed extension-owned objects are excluded from public counts. Missing-table/permission errors are not converted to zero. No all-schema emptiness, hosted project identity or dispatch isolation is established by this SQL. No rows/customer values/paths, function bodies, cron commands or Vault/credential values are returned.

Seven meaningful disposable PostgreSQL cases PASS: empty/nonempty counts, value omission, extension-owned exclusion, write denial, permission failure and missing relation failure. Actual owner hosted execution is **pending**. A repeatable-read read-only transaction with short statement/lock timeouts creates no schema/data/configuration. Source migration initialization, frontend/backend/Auth/Storage/Edge isolation and safe dispatch settings are still to be prepared after version/initial-state evidence arrives.

Run the inline PowerShell, then open **the staging project** and verify the Dashboard URL contains `/project/dczlddwbtgvfdujgcitb/`. Manually paste the copied SQL into that project's SQL Editor and run. The embedded expected reference is merely a label; it cannot make a query run against the right database. Return the **four result rows or redacted error only**. Unexpected counts/errors get reviewed before any writes, not ignored or destructively cleared. The original dirty Windows checkout is preserved; fetch updates remote refs only.

```powershell
& {
    $ErrorActionPreference = "Stop"
    Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
    git fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
    $mushavoStagingSql = git show "FETCH_HEAD:supabase/diagnostics/security_stage_1_staging_preflight.sql" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoStagingSql)) {
        throw "Staging preflight SQL could not be read."
    }
    Set-Clipboard -Value $mushavoStagingSql
    Write-Output "Copied read-only staging preflight SQL."
    Write-Output "Paste only in staging dczlddwbtgvfdujgcitb, after checking its Dashboard URL."
}
```

**Current state:** owner-reported separate project/reference, preflight pending, application schema not initialized and staging requests/credentials/dispatch not verified. Next work is controlled source/schema setup and staged synthetic configuration after this evidence. No production rows/restoration/SMTP/Vault/dispatch key copying or live frontend switch is requested by the preflight. Prior quota/count handoff below is historical; do not create a second staging project or repeat quota questions now.

## Prior first-owner capacity check — superseded by S1E66 creation/reference report

Open the Supabase Dashboard projects overview and review organizations where you are Owner/Admin. Report only:

1. Count of **active Free projects**, across those organizations.
2. Count of **paused Free projects**, separately (if any).
3. Whether a **dedicated isolated Mushavo Budget test/staging project** already exists: YES / NO / UNSURE.

Example reply: `Active Free: 2; paused: 0; Budget staging: no`. Example is not observed evidence. No project names/keys/passwords/screenshots/customer data are needed. This is a read-only inventory; it is not a request to create, pause/delete/upgrade a project, change access roles, purchase resources or reuse another application's live project as staging.

## Current documented constraint — actual account eligibility pending

Official [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), checked 8 October 2026, states two active Free projects; paused projects do not count towards that quota. It also notes that project-creation eligibility in an organization can depend on other Owner/Admin members' exhausted free-project quotas. The generic limit does not prove that this owner has a spare slot or can create a particular project. Record actual owner inventory and, if needed, the observed creation eligibility before selecting a hosted target. Do not assume different organizations automatically provide more free projects.

If there is a suitable existing isolated target or eligible free capacity, prepare concrete identification/configuration steps for that target. If hosted capacity is unavailable, record the blocker and assess a compatible owner-local staging stack after its actual prerequisites are verified; a standalone PostgreSQL backup client alone is not full Supabase Auth/Storage/Edge staging. No paid resource or existing-project pausing is selected by this check. Backup Docker refusal/selection related to the earlier export route is not presumed to settle the later full-stack staging choice.

## Required isolation before writes or test dispatch

- Explicitly identify the staging frontend and backend; verify its Supabase project reference and reject production endpoint/credentials. Production is `kttkospkblwvguuwnhjj`.
- Separate frontend/backend Auth redirect URLs, Storage buckets, Edge function configuration and secrets. Reconcile deployed/source migration parity, not only a branch name or preview URL.
- Use synthetic users/workspaces/file fixtures and controlled test inboxes. Do not import private production customer backups as test fixtures.
- Keep automatic mail/push/currency/cron dispatch disabled or test-bound until target identity and destinations are verified; do not copy production scheduler/SMTP/Vault/API secrets into an active test dispatch path.
- Verify selected staging identity/capabilities before migrations/configuration/restore writes. Protect the original dirty Windows native checkout and signing identity; no APK update requested.

## Work outcome and reporting

Current state: **owner reports separate staging dczlddwbtgvfdujgcitb created; hosted preflight/identity/isolation checks remain pending (S1E66–S1E67).** Record a concrete blocker where present rather than certify isolation. Once a target is chosen, implement and verify staging-specific identities and synthetic app flows, then provide the scoped 1.3 outcome. Recovery drill is 1.4; monitoring/operations 1.5; detailed Stage 1 report 1.6. Keep active stage.step numbers on all messages and retain failures/unknowns for final remediation/full re-audit. Google backup work remains deferred.
