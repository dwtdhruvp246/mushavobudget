# Business Stage 11 — platform admin controls

Release 4.9.26. Requires the completed Stage 10 migration. Public Business purchase and creation stay closed. Existing private plan configuration, paid capacity approvals and Finance review continue unchanged.

Admin → Workspaces → Business → View details opens a protected support view with the Owner/account state, workspace state, subscription activation and expiry/countdown, current and next seats, reservations, and paginated support actions. It loads metadata through a protected RPC; it does not query Business operating finance records. Plan configuration remains in Plans and paid capacity/payment review remains in Finance.

| Platform role | Read support metadata/history | Suspend/restore workspace | Recover/transfer ownership |
|---|---|---|---|
| Super admin | Yes | Yes | Yes |
| Admin staff | Yes | Yes | No |
| Finance staff | Yes | No | No |
| Support staff | Yes | No | No |
| Business members / other users | No | No | No |

A suspended platform account cannot use these procedures. None of these actions automatically makes a platform administrator a Business member or grants access to operating finance records.

## Suspension and restoration

Require the exact workspace name, a reason/verified support reference (8–1000 characters), current support version and request UUID. Changes are serialized on the workspace row; stale requests fail. Retrying the same successful request does not duplicate the action or notification. Closed workspaces cannot be restored here.

Suspension sets the workspace status only and locks Business operations through existing access gates. Data and paid-through dates remain intact. Restoration clears only this workspace suspension; it does not renew an expired subscription, unsuspend a subscription or unsuspend any user account. Owners receive an access-change notification; the support history records actor, time, reason and before/after state.

Business status, ownership and support version cannot be changed through direct client table writes. Private transaction permits are issued only inside the protected procedures and removed before returning. Existing Personal/Family updates and Business name/setup edits are unaffected.

## Ownership recovery and transfer

Super admin only. Verify identity and the authorization for the request outside the app, then record the verified support reference/reason. Require the workspace name, new Owner's exact email, expected previous Owner, current support version, and an idempotency UUID. The recipient must be an existing active Business member with an active registered account, completed invitation setup where applicable, and no platform admin role. The procedure does not create users or add members; if no eligible member exists, the existing invitation workflow must be used first.

Resolve a pending subscription payment through Finance before changing the Owner. This prevents leaving a submitted payment under the previous Owner. Unsubmitted private quotes are cancelled during the change. Existing paid receipts and historical finance attribution retain their original actors.

The previous Owner becomes a Viewer, retains their current active/inactive membership state, and loses member permission overrides/scopes. The recipient becomes the Owner without adding a seat. Other stray Owner-role rows are demoted too. Workspace/subscription suspension and expiry remain in force. The procedure classifies the action as recovery when the former Owner's account or Owner membership is unavailable. Both Owners receive an ownership-change notification. It records protected platform support history and a Business ownership audit event; operating finance records are never rewritten.

The existing active Owner's own Team transfer remains available, uses the same ownership guard, checks the recipient's active account/platform role, blocks pending subscription payments and invalidates unsubmitted quotes. Its original previous-Owner → Business Admin behavior is preserved. A former Owner can no longer use Owner-only billing after either path.

Support history is private, immutable, paged in groups of 20 and exposed only through role-checked RPCs. Closing details, signing out, opening another record or receiving out-of-order reads prevents stale support data from replacing the current screen. The forms fit desktop and phone dialogs, scroll vertically and wrap long references safely.

## Deployment

```powershell
git fetch origin feature/business-stage-11-admin
git show "FETCH_HEAD:supabase/migrations/20260930110000_business_stage_11_admin.sql" | Out-String | Set-Clipboard
```

Run the copied migration in Supabase SQL Editor. Expected: `Success. No rows returned.` Then:

```powershell
git show "FETCH_HEAD:supabase/diagnostics/business_stage_11_admin_diagnostic.sql" | Out-String | Set-Clipboard
```

All **24 rows** must PASS before the frontend is merged/deployed. No new Edge Function deployment is required.

## Verification

- Actual migration in disposable PostgreSQL: role matrix, confirmation checks, stale requests, idempotent retries, private immutable support history, direct-write protection, restoration preserving expiry/suspension, pending payment blocking both transfer paths, valid transfer, account-suspended Owner recovery, Owner billing revocation, quote invalidation, no automatic platform membership, existing Owner transfer, and all 24 diagnostic rows.
- Five client regression checks cover role controls, pending-payment UI, safe audit text, stale dialog/session responses, duplicate submission suppression, captured Owner/version and exact schema mirror.
- Offline browser checks render actual app support functions and styles at 1366, 390 and 320 pixels: both action forms, typed confirmations, captured versions, scrolling/wrapping, audit paging, pending payment warning, staff restrictions and late-response isolation.
- Existing project regression suite and Stage 10 billing SQL/browser checks remain required.

```sh
MUSHAVO_PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite node scripts/verify-business-stage-11-sql.cjs
CODEX_PRIMARY_RUNTIME_NODE_MODULES=/path/to/node_modules MUSHAVO_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/verify-business-stage-11-ui.cjs
```

Live pilot checks after deployment: view a Business as support staff; verify mutation controls are absent. Suspend a test workspace and verify access on another device. Restore it with an expired plan and verify it still requires renewal. Transfer to an existing member using a verified test request, verify former/new Owner billing access and retained finance history, and inspect support history. Stage 12 remains the full cross-device/pilot acceptance stage.
