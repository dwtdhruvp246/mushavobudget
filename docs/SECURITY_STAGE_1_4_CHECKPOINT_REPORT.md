# 1.4 — Synthetic recovery checkpoint report

Closed 9 October 2026 **with scoped native passes and carry-forward**. All four finite work items have outcomes; zero remain in 1.4. Stage 1 continues at 1.5.1. Full Stage 1 completion/reporting remains 1.6, followed by the owner's requested final remediation and re-audit.

## Outcome and evidence boundary

The owner successfully restored the staging public application archive into the separate Windows PostgreSQL 17.11 recovery cluster. At 2026-10-09T08:17:46.8281144Z the native script returned SYNTHETIC_NATIVE_APPLICATION_RESTORE_SCOPED_PASS: transaction committed, thirteen selected role checks passed, relation/RLS metadata and selected payment/workspace values matched, dummy-file SHA-256 matched, original source hashes remained unchanged, and its local server stopped. Problem code was null. Reported elapsed time was 11 seconds.

This proves the selected application recovery drill under documented dependency substitutions. It does not establish production backup completeness, hosted Auth/Storage/API recovery, restored global role authority, every tenant/workflow boundary or an achieved 24-hour full-service recovery target. Source staging reference was dczlddwbtgvfdujgcitb; production kttkospkblwvguuwnhjj was not connected by the restore. The owner supplied native summaries; root did not independently run Windows or access private artifacts.

| Work item | Outcome | Evidence |
|---|---|---|
| 1.4.1 Target and scope | Native PASS with managed-service limits | S1E79: private local PostgreSQL 17.11 target, SCRAM, loopback-only port 55439, empty application scope, pgcrypto available, own server stopped. |
| 1.4.2 Synthetic exports | Scoped native PASS | S1E82: 1,330,785-byte readable public archive, 80 public table-data entries, 380 public ACL entries; two synthetic identities, one USD 20 payment item/paid record and two Personal workspaces; private manifests. |
| 1.4.3 Restore and compare | Scoped native PASS after correction | S1E84–S1E87: first transaction failed safely; validation setting corrected and regression tested; owner retry committed with 13 checks, metadata/value/file/source comparisons and shutdown passing. |
| 1.4.4 Checkpoint report | Complete with carry-forward | S1E88: this report preserves limits, prior failure evidence and remaining remediation actions; no additional diagnostic loop in 1.4. |

## What the thirteen access checks prove

Archived public application ACL/RLS definitions were restored; application policies/grants were not weakened to make the native drill pass. Required authenticated permissions and non-bypassing test roles were checked before role queries. SQL identity helpers supplied two synthetic identities and an anonymous identity.

For each of owner, outsider and anonymous, validation checked the selected owner's payment item, paid record and workspace reads, plus a same-name payment update: twelve checks. The owner had positive read/update controls; outsider and anonymous were filtered or privilege-denied. The thirteenth check required the outsider to read their own separate Personal workspace. Missing seed rows or failed owner positive controls could not count as successful isolation. Every attempted update and its trigger/audit/timestamp effects were rolled back inside validation.

The native summary also confirms public relation names/kinds/RLS flags and selected typed payment/record/workspace values matched the private source metadata. These comparisons cover the selected records, not every restored row or routine behavior. The local dummy file was copied into a fresh private destination and its hash matched; this is local file-byte recovery, not Supabase Storage restoration. Five source component hashes and the private manifest remained bound to the originals.

## Failures encountered and resolution

| Failure | Resolution and evidence | Current status |
|---|---|---|
| Initial initdb lacked postgres.bki and sample configuration files despite executable version checks | Owner installed the complete PostgreSQL server component; supporting files and native initialization subsequently passed. S1E78–S1E79. | Resolved for this target. |
| Initial staging export login rejected | Correct staging database password used on retry; export/offline read passed. S1E81–S1E82. | Resolved for this export; no password was shared. |
| First restore validator inherited row_security off from dump loading | S1E84 reports no commit and server stopped. Error-only log S1E85 identified the RLS error. S1E86 added SET LOCAL row_security = on before role tests, without changing policies/grants. Exact old error reproduced in regression; corrected native retry passed S1E87. | Resolved for this drill; prior failed evidence retained. |

Disposable embedded PostgreSQL 18 fixtures replayed 51 migrations and modeled hosted default ACLs absent from migration-only fixtures. They reproduced the prior row_security error, passed the corrected thirteen-check sequence and rejected six application faults (broad read policy, missing update grant, disabled RLS, altered record amount, bypass-RLS role, extra selected-table column), plus private source hash and path faults. Those fixtures are separate from the owner's PostgreSQL 17.11 native evidence.

## Explicit substitutions and unresolved recovery scope

| Dependency | Drill implementation | Remaining limitation |
|---|---|---|
| Ownership/global roles | Local recovery administrator owns objects; fixed provider names are non-login, nonprivileged placeholders | Original hosted ownership, memberships, global settings and managed authority not recovered. |
| Auth | Minimal auth.users with two identity-only rows; SQL claim settings and uid/role/jwt helpers | Auth passwords, real sign-in/token validation, provider configuration and complete hosted Auth schema/runtime not recovered. |
| Storage | Minimal empty SQL dependency tables/helper; local dummy file copy | Storage service, production bucket/object metadata and actual Storage file recovery not proved. |
| Managed providers | pgcrypto installed; one schema/provider TOC entry excluded | Realtime/event-trigger/other extension initialization and managed dispatch behavior not recovered. |
| Public application | Archived definitions/data/ACL/RLS plus selected comparisons | All-row/routine parity, insert/delete/RPC and Family/Business/custom-role boundaries untested here. |
| Source consistency | Selected before/after metadata equal, archive and private hashes verified | Probes and dump did not share one snapshot; all-public-row drift/provenance not independently proved. |
| Offsite/operating delivery | Local artifacts retained; no cloud upload in this drill | Google remains deferred; offsite protection, scheduled reliable backups/retention and failure-alert delivery unverified. |

## Carry-forward action plan

1. **Production backup completeness:** privately reconcile database properties/settings, role/parameter permissions, omitted managed memberships, required credentials/keys and provider configuration. Bind components to a documented recovery point before full recovery acceptance. Prior 1.2 gaps remain open.
2. **Storage encryption and recovery:** resolve the earlier production Storage package extraction failure with retained originals; verify a completed encrypted package and controlled object/service restoration. The dummy-file pass does not close that failure.
3. **Hosted service recovery:** prepare a controlled recovery path for Auth sign-in, Storage, Edge functions, SMTP, currency/scheduler/push dependencies and original authority. Validate positive/negative workflows with isolated test destinations before claiming restored service.
4. **Untested access matrix:** test insert/delete/RPC, Family/Business/custom-role and Storage access in their dedicated audit scope, then recheck affected controls after fixes.
5. **Operational protection:** 1.5 inventories actual deployment and monitoring/response arrangements. Establish evidence of backup/dispatch failure detection, ownership and reliable operating delivery; 24-hour objectives remain targets.
6. **Offsite decision:** retain the owner's Google deferral. Revisit an approved offsite option in final remediation; do not silently mark local-only backups externally protected.
7. **Final remediation/re-audit:** preserve each failed/partial/uncertain control, implement agreed fixes and rerun affected evidence before closure. This checkpoint does not close F16 or clear release/mobile-store gates.

The successful target now contains the committed synthetic restore. Retain its protected files and receipts and keep its server stopped. The empty-target restore handoff is not a repeatable command for this committed target; no cleanup/reset/drop is requested. Original source/backup files and the original dirty native project remain retained; APK updating stays deferred.

## Next: 1.5 — four finite operational work items

Read [1.5 inventory, monitoring and response](SECURITY_STAGE_1_5_OPERATIONS.md). Start with one consolidated read-only deployment/operations inventory at 1.5.1; review the evidence before configuration or test dispatch. Missing/unavailable proof is carried explicitly rather than extending the checkpoint indefinitely.
