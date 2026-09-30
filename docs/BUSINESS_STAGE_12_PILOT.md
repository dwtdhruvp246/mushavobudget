# Business Stage 12 — verification and private pilot

Release 4.9.27. Public Business purchases and customer workspace creation remain closed. Stage 12's automated checks and pilot preparation do not declare the live pilot accepted.

## Changes

Business devices now subscribe to a private, per-workspace change signal. Its only fields are workspace ID, data/access counters and update time. Financial rows, amounts, file paths and receipts are not published through this new channel. Only active Business memberships with active user accounts can read the signal; platform staff receive no automatic access. Expired/suspended members can receive neutral access changes so the screen can check its lock; operating data still requires the existing active access gates.

Signals are generated transactionally for 22 access/operational tables and account suspension. Rolled-back writes do not publish a change. INSERT/UPDATE subscriptions are filtered to the selected workspace. The client re-fetches using the existing RLS and protected RPCs, coalesces events, catches up on reconnect, and removes old channels/timers when switching companies, leaving or signing out. It does not render realtime payload records.

Ordinary data refresh preserves open dialogs and unsaved forms. An updates banner remains until edits finish, with a Refresh button for retries. Search/report filter forms do not count as unsaved drafts. Access changes deliberately recheck access and reload the workspace, clearing obsolete dialogs/data if permissions changed. Existing minute-based access checks and local expiry checks continue when realtime is disconnected. Removed/suspended accounts can lose signal visibility, so these independent access checks remain necessary. Reminder delivery stays server-side and does not depend on this UI realtime connection.

Also fixed: an old expense-save response could close a new workspace form; a late Team response could replace another company's Team; access refresh could reload a stale workspace Owner from the cached directory; narrow-phone expense headings could push the close button beyond the dialog.

## Automated evidence

| Requirement | Automated evidence | Live acceptance |
|---|---|---|
| Personal/Family isolation, one Business versus another | Existing access/role regressions; operational SQL scope checks; signal RLS tests | Pending |
| Roles and assigned project/branch scopes | Stage 8/9 actual SQL and role UI checks | Pending |
| Self-approval protection | Request/claim SQL; Staff expense UI; billing self-review SQL | Pending |
| Partial payments and no request/bill/payment double counting | Stage 8/9 actual SQL lifecycle and report sources | Pending |
| Mixed currencies and locked conversion snapshots | Stage 8/9 actual SQL | Pending |
| Private receipt access | Existing receipt/storage guards and report/billing SQL; Staff upload path UI | Pending |
| Invitation capacity and retries | Stage 10 actual SQL reservations/usage/version checks | Simultaneous live transactions pending |
| Expiry and suspension | Stage 8–11 actual SQL; locked Owner/Staff browser checks | Pending |
| Mobile expense submission | Actual Staff draft → receipt → submit UI, at 1366/390/320px | Pending |
| Desktop finance management | Income, planning, reports, Owner billing and admin browser suites | Pending |
| Rapid switching and stale responses | Workspace/Team/billing/report regressions and two-client orchestration tests | Pending |
| Realtime changes and reconnects | Actual signal migration/RLS; two independent browser clients with simulated delivery | Real Supabase transport/reconnect pending |

332 regression checks and all 56 npm test files passed. Disposable PostgreSQL suites for Stages 8, 9, 10, 11 and 12 passed. Actual browser workflows for income, requests/budgets, reports, billing, admin support, realtime orchestration and Staff expenses passed at desktop and phone widths. The read-only Stage 12 diagnostic has 20 rows. None of these checks log in to or mutate the live customer database.

## Deployment

```powershell
git fetch origin feature/business-stage-12-pilot
git show "FETCH_HEAD:supabase/migrations/20260930130000_business_stage_12_realtime.sql" | Out-String | Set-Clipboard
```

Run the copied SQL in Supabase SQL Editor. Expected: `Success. No rows returned.` Then:

```powershell
git show "FETCH_HEAD:supabase/diagnostics/business_stage_12_pilot_diagnostic.sql" | Out-String | Set-Clipboard
```

All 20 rows must PASS before merging the frontend. No new Edge Function deployment is needed. The diagnostic checks prerequisites only, not real cross-device delivery or full pilot acceptance.

## Live pilot setup

Use registered test accounts and Business test subscriptions granted through Admin. Keep customer/public Business purchase closed and configure only intentional pilot prices. Keep testing records in clearly named pilot workspaces. Use at least two Business workspaces, an Owner, a Finance Manager/reviewer and a Staff member. Retain a Personal/Family workspace with different test payments to check separation. Test on PC and phone signed in to different accounts, plus a second browser/tab for same-role concurrency checks. Record each result and any screenshot/error under the checklist below.

### Pilot A — Owner only

- [ ] Open Business from the normal sign-in/workspace selector; its UI and records are separate from Personal/Family.
- [ ] Complete setup, add an income and a company expense, and record payment through the supported Owner-only direct expense path.
- [ ] Confirm paid spending and unpaid commitments remain separate; receipt and activity history retain their original actors.
- [ ] Check Dashboard/Activity/Reports period selectors independently and open report source records.

### Pilot B — Owner with Finance Manager

- [ ] Invite the Finance Manager; accept using the correct registered account. Check pending invitation cancellation and resend.
- [ ] Record mixed-currency income/expenses; confirm original amounts and locked reporting conversion, totals and report sources.
- [ ] Create a spending request, review it with a different eligible user, create its bill and pay part of it. Confirm the remaining balance and one commitment/one paid amount, without duplicate request counting.
- [ ] Finish the payment and confirm the outstanding amount is zero. Test a retry/double click without duplicate payment.
- [ ] With one available seat, open two tabs and submit two distinct invitations as close together as possible. Confirm only one succeeds and usage never exceeds capacity. Repeat acceptance on the same invitation in two tabs; confirm one membership.

### Pilot C — Staff expenses

- [ ] On the phone, save a reimbursement draft with amount/currency/category, personal payment source and receipt; scroll to every field/action and submit.
- [ ] Confirm Staff cannot approve their own submission, see Owner billing or see other members' private records beyond their assigned permissions.
- [ ] Review as Finance Manager/Owner, request changes with a reason, resubmit, approve and reimburse. Confirm only reimbursement adds company paid spending.
- [ ] Request a receipt through another unauthorized account/workspace and confirm denial. Test unavailable receipt feedback. Authorized signed links are temporary bearer links; requesting an unauthorized file path must remain blocked.

### Pilot D — projects or branches

- [ ] Create Branch A and Branch B and assign a scope-limited member to A.
- [ ] Record items in each branch; confirm the scoped member cannot view/edit B or whole-company totals/exports without explicit permission.
- [ ] Compare scoped budgets and reports with their source records. Rename/archive a category/tag and check another device refreshes its labels/options.
- [ ] Switch rapidly between the two Businesses while reports, Team or billing loads; confirm no old-company names/amounts/receipts appear.

### Access, billing and live updates

- [ ] Open the same Business on PC and phone with different authorized users. Save a transaction/claim/review/payment on one; confirm the other updates without a page reload and respects its own role.
- [ ] Keep an unsaved expense dialog open on the second device; make an ordinary data change on the first. Confirm the draft is retained and an updates banner appears; finish/close the draft and confirm refresh catches up.
- [ ] Disconnect/reconnect the second device, then switch away/back to the tab. Confirm missed changes are loaded. Verify no duplicate subscriptions or repeated updates after changing Businesses.
- [ ] Suspend the workspace in Admin. Confirm Business operations lock on both devices; restore it and verify any separate account/subscription restriction still applies.
- [ ] Expire the test plan. Owner sees renewal/billing only; Staff sees the expiry message. Confirm finance mutations, invitations, approvals and exports fail. Renewal restores the correct role access.
- [ ] Quote extra seats partway through a monthly/annual term, submit and approve with another admin. Confirm approved capacity changes while expiry stays the same. Test rejection and no self-review.
- [ ] Pay an early renewal with a supported lower capacity. Confirm current seats remain until the boundary and pending invitations reserve the smaller next capacity.
- [ ] Transfer/recover test ownership through Admin using an eligible member and verified test reason; confirm previous/new Owner billing access and retained financial history.

## Completion gate

Stage 12 remains open until all live checks above pass, the four pilot business patterns are accepted and reported defects are fixed. Public Business availability/pricing is a separate launch decision after acceptance. Do not enable public purchase solely because the 20 prerequisite rows PASS.
