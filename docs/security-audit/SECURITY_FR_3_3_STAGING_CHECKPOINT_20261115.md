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

## Private confirmed account deletion transaction

[Migration `20261116142531`](../../supabase/migrations/20261116142531_fr33_execute_confirmed_deletion.sql) is installed on staging. The private executor locks the request and account, rechecks the confirmed ownership snapshot, preserves supported shared payment records, explicitly deletes supported owned workspace roots, and removes the Auth user in one database transaction. The successful request keeps only its dates and identifier. Replaying it returns the same completion timestamp. An unsupported dependency rolls back all writes.

The [staging rehearsal](../../supabase/diagnostics/security_fr_3_3_confirmed_erasure_rehearsal.sql) submitted the request through the normal authenticated RPC with a fresh password session fixture. It removed the disposable account, profile, session and owned Personal and Family workspaces, including their payments. An ordinary surviving owner could read the retained Family payment and Business bill payment, both with the original name. The test confirmed that both shared membership access rows were removed and a JWT for the deleted session was rejected by the application session check. Stale confirmation and an unresolved shared record were rejected. Retrying after the test blocker was cleared succeeded. Each fixture transaction was rolled back.

The initial rehearsal confirmed the warning lists an owned Business. At that checkpoint, the existing immutable audit event blocked that workspace's deletion. The staging executor also holds requests involving unresolved paid claims, income receipts, platform billing references or Storage cleanup when they are detected. No scheduler is enabled. The app and service API roles have no execute grant. Readback found no fixture accounts, open or completed requests, or deletion permits. All 101 targeted local tests passed.


## Owned Business workspace erasure and audit archive

[Migrations `20261116144517`](../../supabase/migrations/20261116144517_fr33_erase_owned_business.sql) and [`20261116144751`](../../supabase/migrations/20261116144751_fr33_protect_closed_business_audit.sql) are installed on staging. In the existing confirmed deletion transaction, owned Business audit events move to a private archive as exact snapshots. The archived events are immutable and inaccessible to app and service API roles. In a surviving workspace, only the departing actor's Auth reference is cleared. All other fields of those live audit events remain intact.

The executor deletes owned Business bill payments before bills, then schedules, claims, spending requests, income receipts and budgets. The existing ownership and Storage checks apply. The [expanded rolled-back rehearsal](../../supabase/diagnostics/security_fr_3_3_confirmed_erasure_rehearsal.sql) confirmed that an active owned Business appeared in the warning and that account deletion removed that workspace, its active memberships and all seven fixture finance record types. The other Business owner still had access, and another workspace's payment and the departing person's actual name stayed visible. The archive matched the original owned audit events and rejected deletion outside the executor. A linked platform billing grant stopped the request and rolled back the archive and financial changes. The unchanged stale-confirmation, session invalidation and replay tests passed.

Four of six existing Business workspaces on staging have manual subscription grants. One has platform subscription invoices and payments, and two have support actions. These dependencies need separate handling. The staging archive layout preserves existing evidence for the rehearsal. A retention term and production access policy are undecided. All 101 targeted local tests passed. After the hosted rehearsals there were zero archived events, completed requests, erasure permits or disposable accounts. No automatic processing was enabled.


## Retaining names on shared Business claims and income

[Migration `20261116183515`](../../supabase/migrations/20261116183515_fr33_retain_business_payment_attribution.sql) is installed on staging. A confirmed deletion disconnects the departing submitter, payer and reviewer on paid claims in a surviving Business. The same step disconnects recording and voiding actors on retained income receipts. The person's existing profile name stays on the affected financial row, so the current Business row-access rules also protect the name. The executor verifies the exact update in its transaction. An unpaid claim or unresolved proof link can still hold the request.

The [rolled-back rehearsal](../../supabase/diagnostics/security_fr_3_3_confirmed_erasure_rehearsal.sql) preserved a paid claim, a received receipt and a voided receipt, including their amounts, dates and retained names. The surviving owner could read the records and successfully void the received receipt after erasure while preserving the recorder name. A signed-in nonmember could see neither record. Attempts to change historical names or clear a paid actor directly were blocked. Readback found zero remaining fixture accounts, completed requests or attribution permits. All 102 targeted local tests passed, including the details display.

The staging web archive `mushavo-budget-fr33-business-history-staging.zip` (SHA-256 `fdacea1783394fc20ebe830ff69ef8dc58ed638d9e1dbab48c509aa594780e49`) changes only `business.js` and the version reference in `business.html` relative to the 43-file verified staging archive. It displays the existing names in the claim and income details. Cloudflare reported staging deployment `72b10e81-ebde-4cad-b921-f15473d8a5ca` successful. The [live Business script](https://mushavo-budget-staging.pages.dev/business.js?v=30) contains the retained claim, recorder and voider fields.


## Handling shared payment proofs and completed upload cleanup

[Migration `20261116190818`](../../supabase/migrations/20261116190818_fr33_retain_shared_proof_files.sql) is installed on staging. Before account deletion, the executor now checks whether an ordinary upload journal entry is already removed and has neither a Storage object nor a live reference. Those entries can be cleared. The executor may disconnect the upload actor for a linked proof in a surviving Family or Business workspace only when the existing payment or document, MIME type, byte count and ownerless Storage object match. For supported active paid-claim proofs it also clears the uploader reference on the document, preserving the path and the existing workspace permissions.

The [hosted rehearsal](../../supabase/diagnostics/security_fr_3_3_confirmed_erasure_rehearsal.sql) verified that an unfinished upload blocks erasure and rolls back any earlier journal changes, then verified successful erasure after the unfinished fixture entry was cleared. It used disposable accounts and no stored objects were written. The [local regression](../../tests/fr33-retained-shared-proofs.test.mjs) exercised ownerless Family, Business bill and paid-claim proof metadata, tested mismatch and user-owned rejection and verified the original paths and object rows were unchanged. All 103 local tests passed. Staging readback found zero completed requests, fixture accounts or proof-detachment permits. The operation remains private.

Owner-bound files, objects belonging to a workspace being erased, and downloads of actual stored files after account deletion still need a Storage API workflow and acceptance. No automated processing was enabled.

## Hosted Family proof download after account deletion

On 17 November 2026, the [staging acceptance run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/44037807250) authenticated three new disposable ordinary accounts over the normal Auth API. The uploader sent a harmless RGB PNG through the deployed managed upload function and linked it to a USD 11 Family payment. The owner downloaded the 75-byte stored proof through the deployed private-file function. The uploader submitted a real deletion request from its authenticated session.

The private confirmed-request executor erased that disposable account on staging. The same owner then downloaded a byte-for-byte match at the original proof path. The payment and original recorder name remained, while the deleted account's old session and the unrelated account were denied a fresh download. Database readback verified that the managed upload no longer referenced the deleted actor. The successful runner recorded 31 requests through its result and exited successfully.

After the check, the synthetic payment was removed and the deployed cleanup worker removed the file. Independent readback found zero disposable accounts, workspaces, Storage objects or upload journal rows for the fixture. The acceptance plan is disabled. The uploader deletion was operator-triggered and narrowly bound to this disposable request. The live Business proof-download case, account-owned file handling, and automatic processing of ordinary deletion requests remain open.

## Hosted Business claim proof after account deletion

On 17 November 2026, the [hosted Business acceptance run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/44043414301) used an isolated Business workspace and three authenticated disposable accounts. Its uploader registered a 75-byte managed PNG on a draft claim using the deployed upload and register functions. The claim was submitted, approved and paid through the normal endpoints. The owner downloaded the file before erasure.

The live claim flow created an owner notification with the uploader as its creator. The initial executor rejected that dependency in a rolled-back rehearsal. [Migration `20261117080454`](../../supabase/migrations/20261117080454_fr33_keep_recipient_notifications.sql) recognizes the existing nullable `notifications.created_by` reference. The database clears only the departing creator link and the recipient's notification remains otherwise identical. The exact request passed with the migration in a rolled-back rehearsal before staging installation.

On the committed test request, the uploader's Auth identity and membership were removed. The paid claim, USD 11 amount, retained submitter name and document link remained in the other owner's workspace. The owner downloaded a byte-for-byte match at the same path. The deleted account's old session and an unrelated signed-in account were denied. The runner reported a passing result after 53 requests.

The test document was retired and the deployed cleanup worker removed the file. The private executor then closed the disposable owner's Business workspace after its file cleanup completed, and the remaining disposable identities were removed. Readback found zero active fixture accounts, workspaces, stored proof objects or upload journal rows. Six synthetic Business events remain in the private audit archive, and the test plan is disabled. These erasures were explicitly invoked for the fixture. Automatic processing, account-owned file cleanup, and platform billing and support dependencies still require completion.

## Managed proof cleanup on owned workspace closure

[Migration `20261117083345`](../../supabase/migrations/20261117083345_fr33_owned_workspace_file_cleanup.sql) hands off verified managed payment proofs and Business documents from a confirmed owned-workspace closure to the existing staging Storage cleanup worker. The executor matches each file to its workspace, upload journal and linked record before scheduling it. When database erasure commits, the private receipt reports `files_pending`. The worker records completion only after the final target is unreferenced and Storage confirms its object is absent. The worker then clears the file path and upload journal from the pending inventory.

| Hosted acceptance | Before owner erasure | On erasure commit | After the worker |
| --- | --- | --- | --- |
| [Disposable Family](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/44048115964) | Workspace named in confirmation. Real 75-byte proof downloadable by an authorized account. | Owner, workspace, and payment removed. Other member's account survived. One file pending. | Object, journal and pending target cleared. Private receipt completed. |
| [Disposable Business](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/44049319813) | Workspace named in confirmation. Real 75-byte proof uploaded to a claim that was submitted, approved and paid. | Owner, workspace, claim and document removed. Other member's account survived. One file pending. | Object, journal and pending target cleared. Private receipt completed. |

Both hosted sessions confirmed the deleted owner's old session was invalid and denied downloads to the former workspace member and the unrelated signed-in account after closure. A rolled-back two-file rehearsal rejected wrong and replayed cleanup tokens and kept the receipt pending until the last target cleared. All nine offline account-deletion request tests passed. Remaining disposable accounts were removed. Six synthetic Business audit records from this Business test remain archived under the existing handling.

The tested handoff covers linked, ownerless managed files in the payment-proof and Business-document buckets. Legacy paths, provider-owned files, Business logos and subscription proofs require separate handling. The staging owner-erasure requests were executed through the private operator function. The existing schedule processed the file cleanup.

## Scheduled account erasure and managed Business logo cleanup

[Migrations `20261117085504`](../../supabase/migrations/20261117085504_fr33_schedule_account_erasure.sql) and [`20261117090124`](../../supabase/migrations/20261117090124_fr33_owned_business_logo_cleanup.sql) add a private scheduled processor and hand off linked managed Business logos to the existing file cleanup worker. The processor selects only current, uncancelled confirmations after its configured cutover. It serializes overlapping runs, processes up to three requests per invocation, retries transient locking conflicts and records review reasons privately. The registered job and control start disabled.

A [live disposable Business acceptance run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/44052199254) submitted an actual Settings deletion confirmation through the published staging API. The confirmation named the owned Business. Supabase Cron processed the request once and erased the owner, workspace, Business profile and paid claim. A different member's account remained active. The GitHub runner verified the old owner session failed and the logo and proof could no longer be downloaded via the app. Immediately after database erasure both objects were still present and the receipt was pending. The deployed file cleanup worker removed both objects. Database readback confirmed zero matching objects, journals or pending targets and a completed receipt.

The fixture-only schedule was paused after its successful run. The two remaining disposable accounts were removed. Seven synthetic Business audit records remain archived under the existing handling. All nine offline request tests passed. A rolled-back stale-confirmation test showed that the scheduler held the request for review and left the account intact.

Staging metadata identified older linked Business Storage outside the managed flow and subscription proof files. These still require a verified disposition. Platform billing and support retention rules remain pending in the [decision register](security-stage-4-retention-decisions.json).

## Requirements for actual erasure

1. Review the [proposed workspace and retention rules](SECURITY_FR_3_1_ACCOUNT_DELETION_DECISIONS_20261115.md), then adopt the [retention decisions](security-stage-4-retention-decisions.json) for identity, personal records, shared finance, invitations and support, telemetry and devices, Storage, processors and backups, and the completion record. Record the data disposition, any required retention period, access and responsible operator for each category.
2. Use the approved automatic workspace closure rule to plan database and file cleanup for owned Family and Business workspaces. Confirm the disposition of shared finance, attachments and historical attribution before enabling the executor.
3. Use the approved decisions to implement and verify durable erasure execution with restart and retry, authoritative file cleanup, Auth session and account cleanup, and residual provider access. Test those effects with disposable identities and known synthetic files. Verify that completion and retained records are reported accurately before offering erasure to users.

**FR.3.3 remains open for release.** Staging verified automatic database erasure and managed file cleanup for the disposable Business scope. Broad activation remains paused. Legacy and provider-owned Storage, and the disposition of the platform's invoices, subscription payments and proofs, renewals, grants and support tickets require completion before broad activation.
