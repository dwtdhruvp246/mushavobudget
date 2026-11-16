# FR.3.3 account deletion checkpoint

**Stage 4/10 · FR.3/8 · FR.3.3 · Updated 16 November 2026**

| Scope | State | Evidence |
| --- | --- | --- |
| Authenticated deletion request, status and cancellation | Staging API passed | [Acceptance run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43755043392) on `00ef2bebd4091a0ca97866a868499fa4f3345858` |
| Account Settings browser and release | Published and verified on main staging | The account security controls sit under workspace Settings. [Layout checks](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43830875653), [preview browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43831993584) and [main staging browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43832314600) passed. Main staging deployment is `5889780c-a7f6-4a03-ba3d-f2c9cb10581f`. |
| Business owner review | Hosted pass | The owner of retained Business test workspaces received `ownership_review`. No workspace ownership or membership was changed. |
| Deletion of owned Family and Business workspaces | Owner rule confirmed. Warning and request confirmation verified on main staging. | The [signed-in trial](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43855085805) exercised an active Family workspace and the Business workspaces. Permanent erasure and the applicable retention rules remain pending. |
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

All 54 local tests passed, including both workspace types, legacy Family deduplication, cross-account isolation, and changed-scope rollback. The [candidate browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43835595786) exercised the new warning and the live staging endpoints. Readback found zero open requests, one cancelled test with confirmation and zero remaining test sessions. The warning archive was published to [main staging](https://mushavo-budget-staging.pages.dev/auth?flow=account) as deployment `b01f8c14-85ee-44df-9947-fa2cbcfbf372`. Twenty hosted readback checks passed, and the [canonical browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43851996066) passed with exit code 0.

## Active Family acceptance and owned workspace dependencies

The [signed-in active Family trial](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43855085805) passed with exit code 0. The owner saw the active Family and Business workspaces listed, and the browser verified confirmation, request isolation, reload and cancellation. Readback after cleanup showed zero temporary workspaces, open requests, and browser test sessions.

The [owned workspace dependency diagnostic](../../supabase/diagnostics/security_fr_3_3_owned_workspace_dependency_review.sql) checks the current confirmation and counts direct database dependencies and upload ledger entries for the owner's workspaces. Another owner's workspace is excluded. The diagnostic rejects stale or missing confirmation and is unavailable to API roles. A staging trial with disposable Family data passed and rolled back the fixtures and diagnostic installation. The request and lifecycle suites passed 55 of 55 local tests.

The database erasure rehearsal used two disposable identities and Family workspaces in one staging transaction. Deleting the confirmed owner's Family removed its synchronized workspace and member rows. Deleting the fixture Auth account removed its profile while the other identity and workspace remained. The transaction rolled back and readback confirmed that no fixture identities persisted.

A separate rollback trial verified the diagnostic against the two existing Business test workspaces and confirmed that they have restrictive dependencies. Business erasure, Storage byte deletion, and access revocation with real sessions still require acceptance.

## Payments after a member leaves

The owner confirmed that a departing member’s payments stay in a Family or Business workspace that belongs to someone else. The existing membership-removal procedures mark the member inactive.

A rolled-back staging trial called the Family removal procedure as the workspace owner. Both membership records became inactive and a full comparison showed the payment row was identical before and after. A Business staging readback found both bill payments still linked to an inactive finance member. The trial used existing Business payment history. Renewing or reactivating the suspended Business fixture was outside this check.

The dependency diagnostic now counts Family payment links and Business bill payments, income receipts and paid claims that involve a departing member in somebody else’s workspace. The revised diagnostic passed both staging trials and 55 local tests. It only reports dependencies. The permanent erasure executor still needs to preserve these payment rows without leaving an Auth dependency. Proof files and platform billing/audit retention remain open. The retained payment name rule is confirmed.

## Database protection for retained payments

[Migration `20261116122201`](../../supabase/migrations/20261116122201_fr33_protect_payment_history.sql) is installed and verified in staging. The account references for Family and Personal payment items and payment records now reject a direct Auth deletion while those references exist. Existing Family and payment-item deletion cascades still run when those objects are explicitly deleted. Business bill payments already had a restrictive recorder reference.

The post-install staging rehearsal deliberately attempted to delete a disposable recorder and verified the payment row in the surviving Family workspace was identical. The same rehearsal then used the existing Family closure procedure with its owner and verified that the owned workspace’s payment item and record were removed. The transaction rolled back and readback found no disposable identities. All 56 local tests passed.

The permanent erasure worker still needs to detach shared payment attribution and handle proofs before it removes the login. For owned workspaces it must run explicit scoped cleanup before deleting the account. Production deployment remains pending.

## Name shown on retained payments

On 16 November 2026 the owner confirmed that a deleted account’s existing name stays on its retained payments in other people’s Family and Business workspaces. The approved display is the person’s name.

The read-only diagnostic now reports whether the Family payer and recorder can be named and whether a profile name is available for Business records. Missing names require attention. Email addresses do not serve as a name source and the report emits only counts and availability. All 56 local tests and a rolled-back Business staging trial passed. Name capture and payment history support are recorded below.

## Saved names for retained payments

[Migration `20261116124345`](../../supabase/migrations/20261116124345_fr33_retained_payment_names.sql) is installed on staging. The private capture step requires an open, confirmed request with the current owned-workspace confirmation. It saves only the departing member’s payer or recorder name for a surviving Family payment, and their recorder name for a surviving Business bill payment. The resulting name rows inherit read visibility from the underlying payment.

The staging rollback rehearsal saved and read a disposable Family name as the authorized owner and exercised two existing Business test payments. Readback found no retained test names, temporary identities or open requests. All 58 local tests passed, including the renderer using saved names after the original links disappeared.

The Family payment history, Family paid badges and reports, and Business bill history were updated on the remediation branch. The web assets still need a staging deployment. Permanent erasure still needs to call capture in the erasure transaction and detach the original Auth references. Business paid claims and income receipts are outside this capture migration.

## Removing the account link from a retained Business bill payment

[Migration `20261116130629`](../../supabase/migrations/20261116130629_fr33_detach_bill_payment_recorders.sql) is installed on staging. The private erasure step saves the name and clears the recorder only for a confirmed request’s bill payments in another owner’s Business. Normal payment creation still requires a recorder. At that checkpoint, a linked proof blocked the operation and undid any partial name capture. API roles cannot invoke the detachment step.

The post-install rollback test removed a disposable Auth account after detachment and verified that the Business payment’s amount, other fields and saved name remained. Zero temporary accounts, open requests and detached test rows remained. All 60 local tests passed.

The staging web archive `mushavo-budget-fr33-retained-names-staging.zip` contains only the Family and Business name display patch and updated script version references relative to deployment `b01f8c14-85ee-44df-9947-fa2cbcfbf372`. Offline rendering and archive checks passed. Archive SHA-256 `734ee18939e076304d9597147a17f2bd9fe7e6d6b480166b458232ff5033261f`. Cloudflare deployment `cb4afeb3-86cc-44a4-9447-508cefba57a2` was verified. The four deployed files matched the archive byte for byte.

## Proof retention for surviving workspaces

On 16 November 2026 the owner approved keeping payment proofs in surviving Family and Business workspaces through their existing access rules.

[Migration `20261116133213`](../../supabase/migrations/20261116133213_fr33_retain_business_bill_proofs.sql) is installed on staging. For a supported Business bill proof already stored without a personal owner and outside the uploader-bound ingestion path, erasure saves the proof’s Storage reference and removes the record’s uploader link. The same object, document details and payment survive the original Auth user. App roles cannot invoke detachment or read the internal proof records.

A rolled-back staging trial removed a disposable account, verified the exact existing bill, saved name, document fields and Storage metadata, and left no trial records. All 60 local tests passed. Managed uploads and files still tied to a person’s Storage ownership need their respective handoffs. Family proof retention and an authenticated end-to-end download after erasure remain pending.

## Detaching retained Family payment and membership records

[Migrations `20261116135009`](../../supabase/migrations/20261116135009_fr33_detach_retained_family_payments.sql) and [`20261116135504`](../../supabase/migrations/20261116135504_fr33_detach_retained_family_memberships.sql) are installed on staging. They prepare payments in a surviving Family workspace for account deletion. A confirmed request allows only exact changes to the departing recorder and creator references. The workspace owner takes any required ownership reference. Ordinary writes still require actor attribution. The helper disconnects the departing membership, clears its contact details and transfers creator references so other members are not removed by cascade.

The [rolled-back staging rehearsal](../../supabase/diagnostics/security_fr_3_3_family_erasure_rehearsal.sql) deleted a disposable Auth account and verified that the payment item and record remained identical apart from actor links. The surviving owner could read the payment and the person's name through normal application RLS. The test verified that the departing account's access row was removed, an unrelated Family member's record survived, and no trial accounts or update permits persisted. A linked Family proof still requires a confirmed Storage object. This rehearsal used a proof-free payment.

## Managed Business bill proofs

[Migration `20261116135850`](../../supabase/migrations/20261116135850_fr33_retain_managed_bill_proofs.sql) is installed on staging. The ingestion guard now permits clearing only the uploader of a retained bill document when the exact linked Storage object has no individual owner. The operation uses a private permit limited to the same transaction and leaves the payment, proof path and Storage object unchanged. Other managed document edits still use the existing guard. Local regression tests exercised managed and legacy proofs and checked that ordinary uploader changes are denied. A rolled-back staging check verified the installed function bodies and grants. No managed bill proof fixture was available for a hosted download after deletion. The three FR.3.3 test files, the personal deletion regression and the Stage 4 lifecycle suite passed 101 of 101 checks. Staging readback found zero open deletion requests, disposable Family accounts or active detachment permits.

## Requirements for actual erasure

1. Review the [proposed workspace and retention rules](SECURITY_FR_3_1_ACCOUNT_DELETION_DECISIONS_20261115.md), then adopt the [retention decisions](security-stage-4-retention-decisions.json) for identity, personal records, shared finance, invitations and support, telemetry and devices, Storage, processors and backups, and the completion record. Record the data disposition, any required retention period, access and responsible operator for each category.
2. Use the approved automatic workspace closure rule to plan database and file cleanup for owned Family and Business workspaces. Confirm the disposition of shared finance, attachments and historical attribution before enabling the executor.
3. Use the approved decisions to implement and verify durable erasure execution with restart and retry, authoritative file cleanup, Auth session and account cleanup, and residual provider access. Test those effects with disposable identities and known synthetic files. Verify that completion and retained records are reported accurately before offering erasure to users.

**FR.3.3 remains open.** The staging account workflow records requests. A private staging rehearsal deleted disposable identities only inside rolled-back transactions. The automatic executor, owned Business workspace cleanup, retained Business claims and receipts, Storage handoff for personally owned files, and signed-in proof downloads after erasure still require completion. Staging has no active erasure worker. Production was outside the execution scope.
