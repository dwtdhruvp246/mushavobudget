# FR.3.3 account deletion checkpoint

**Stage 4/10 · FR.3/8 · FR.3.3 · Updated 16 November 2026**

| Scope | State | Evidence |
| --- | --- | --- |
| Authenticated deletion request, status and cancellation | Staging API passed | [Acceptance run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43755043392) on `00ef2bebd4091a0ca97866a868499fa4f3345858` |
| Account Settings browser and release | Published and verified on main staging | The account security controls sit under workspace Settings. [Layout checks](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43830875653), [preview browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43831993584) and [main staging browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43832314600) passed. Main staging deployment is `5889780c-a7f6-4a03-ba3d-f2c9cb10581f`. |
| Business owner review | Hosted pass | The owner of retained Business test workspaces received `ownership_review`. No workspace ownership or membership was changed. |
| Deletion of owned Family and Business workspaces | Owner rule confirmed. Warning and request confirmation verified on the candidate. | Active and inactive owned workspaces are included in account erasure. Main staging publication of the warning, applicable retention rules and execution remain pending. |
| Account erasure, execution retry, Storage and provider cleanup | Pending | The installed workflow has no destructive executor. The policy and provider prerequisites below still apply. |

## Verified on staging

The migration is installed on Supabase project `dczlddwbtgvfdujgcitb`. The private request table has forced RLS and ordinary API roles have no direct access. Only the authenticated API role can call the three public functions. Request submission requires a server-verified password sign-in from the last ten minutes. A token refresh alone does not reset that window.

GitHub Actions verified anonymous denial, recent password submission, two concurrent submissions returning one identifier, the owner review hold, isolation from a second test account, repeatable cancellation, and denial after sign-out. Independent database readback found **zero active test requests, one cancelled test record and zero remaining test sessions**. The CI flow used the two established staging accounts and recorded no credentials or individual identities.

The candidate Chromium run verified that dismissing the confirmation submits no request, confirming shows an ownership review hold, the second account sees no request, reloading preserves the hold, and cancellation clears it in both the screen and the database. The two browser test sessions were logged out. Database readback across both runs found **zero active test requests, two cancelled test records and zero remaining test sessions**.

The 43-file staging archive contains 40 pinned web assets and three preserved Pages control files. Only `auth.html` and `auth-flows.js` differ from the verified FR.3.2 baseline. Archive SHA-256 is `c3e7e082c406fdd28941e16ef4733926e0fd4c1b633d1192b18290b632859983`. The user selected the archive in Cloudflare, which deployed preview `47f4d139-3cd1-43dc-99e4-ec0b060a7c68`. After the preview passed readback and browser checks, the same manifest and controls were published to the main staging URL. The earlier FR.3.2 staging deployment `78498daf-0020-47a3-96fc-7a96c72e7954` is the recorded rollback target.

Both hosted browser runs verified the exact Account Settings document, script and staging configuration by SHA-256. They also checked the existing Pages Worker and verified the complete request, reload and cancellation flow with two staging accounts. Independent database readback across all four staged request runs found **zero active requests, four cancelled test records and zero remaining test sessions**.

Local regression checks passed **52 of 52**, including the previous 46-case simulation and six tests of the actual request migration. The migration tests covered role grants, persistence and idempotency, cross-account isolation, stale password verification, ownership and membership precedence, and cancellation. The frontend passed JavaScript syntax checking.

## Account security placement

Personal and Family Settings, Business Settings and Admin Settings now show separate actions for password changes and deletion requests. A fixed set of return destinations takes users back to the Settings screen they opened. A locked Business workspace shows the account security card in Settings and keeps workspace controls hidden.

The responsive Chromium checks covered the three Settings panels at phone and desktop widths. Route tests also covered Business ownership tiers, workspace locks and incomplete setup. Hosted preview `441ddf26-7b63-4d52-816b-73c11d7cd8c9` and main staging `5889780c-a7f6-4a03-ba3d-f2c9cb10581f` each verified nine hosted asset hashes, the Pages Worker, request status and cancellation, and the return to Personal Settings. The Settings archive SHA-256 is `cbeb73f177c34a96d3557fdd7360d3c6557f70151301db4a586b277f0c56b632`. The previous main staging deployment `eda0290a-50ac-479d-9b26-9e446ad5c18c` is the rollback target for this layout release.

Database readback after the layout validation found zero active requests, six cancelled test records and zero remaining test sessions.

## Private dependency review on staging

An operator can run `mushavo_account_deletion.review_dependencies(request_id)` for a current open request. The reviewer is read-only and reports table/column paths and matching counts. It uses the request subject from the database, counts direct foreign keys, and checks Storage ownership and the three existing upload ledgers. It returns the same unavailable status for unknown and cancelled requests. Supabase API roles, including the service role, have no execute access.

The 16 November 2026 trial operated on the established staging account used for the six earlier request tests. It inspected all 99 current direct Auth constraints, found 14 restrictive references with matching rows and eight cascading references with matching rows, and rolled back the temporary request. A subsequent count showed zero active requests and six cancelled fixture requests. All 53 request and lifecycle tests passed locally.

The catalog also lists 26 cascading constraints one level below the directly affected tables. For example, the Family reference can cascade into workspaces and payment records. The review checks direct subject matches and file metadata. It leaves transitive records, copied identities, actual file bytes, and processor or backup handling for policy-bound review. No erasure state is advanced by this function.

## Owned workspace warning and confirmation

On 16 November 2026 the owner confirmed that permanent account erasure automatically deletes owned Family and Business workspaces, including active workspaces. Workspace membership without ownership does not include that workspace in the deletion. The confirmation names owned workspaces and warns that all their members lose access.

The staging migration derives the impact from the authenticated subject and records a confirmation digest on the request. It rejects stale confirmation after a workspace change. Legacy submissions without the new confirmation require fresh authorization before any future executor can use them. No account or workspace deletion executes from the confirmation endpoint.

All 54 local tests passed, including both workspace types, legacy Family deduplication, cross-account isolation, and changed-scope rollback. The [candidate browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43835595786) exercised the new warning and the live staging endpoints. Readback found zero open requests, one cancelled test with confirmation and zero remaining test sessions. The warning archive is ready for staging publication and the canonical website still serves the preceding layout release.

## Requirements for actual erasure

1. Review the [proposed workspace and retention rules](SECURITY_FR_3_1_ACCOUNT_DELETION_DECISIONS_20261115.md), then adopt the [retention decisions](security-stage-4-retention-decisions.json) for identity, personal records, shared finance, invitations and support, telemetry and devices, Storage, processors and backups, and the completion record. Record the data disposition, any required retention period, access and responsible operator for each category.
2. Use the approved automatic workspace closure rule to plan database and file cleanup for owned Family and Business workspaces. Confirm the disposition of shared finance, attachments and historical attribution before enabling the executor.
3. Use the approved decisions to implement and verify durable erasure execution with restart and retry, authoritative file cleanup, Auth session and account cleanup, and residual provider access. Test those effects with disposable identities and known synthetic files. Verify that completion and retained records are reported accurately before offering erasure to users.

This checkpoint covers request intake, status, cancellation and the published staging Account Settings workflow. **FR.3.3 remains open.** No account was erased. Production was outside the execution scope.
