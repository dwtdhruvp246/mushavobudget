# 1.2 checkpoint report — external backups and recovery

Date: 8 October 2026. Intended production project: `kttkospkblwvguuwnhjj`. Evidence through S1E64. **Checkpoint CLOSED WITH CARRY-FORWARD; full external protection NOT VERIFIED.** All four finite work items have recorded outcomes and no 1.2 work item remains pending. Stage 1 continues at 1.3. This is a step checkpoint, not the detailed Stage 1 completion report (1.6), a complete recoverability certification, F16 closure or release approval.

The owner executes Windows/provider actions and retains real exports, credentials, hashes, configuration copies and customer file bytes privately. The assistant records redacted summaries and prepares repository tooling. No private backup, customer file, key or exact protected setting value has been inspected by the assistant. Owner execution, synthetic tooling tests, metadata comparisons, approved decisions and actual destination recovery are different evidence scopes.

## Four work-item outcomes

| Work item | Recorded result | Evidence and limits |
|---|---|---|
| 1.2.1 Database/roles exports and local checks | DONE WITH CARRY-FORWARD; local component passes | Database/role exports, encrypted package/extracted-file hashes, selected role attributes/memberships/key/grant shape and full TOC entry presence. Exact values/effective/managed authority and recovered destination behavior unverified. |
| 1.2.2 Actual Storage files | DONE WITH CARRY-FORWARD; byte checks PASS, packaging REVIEW | Four buckets/two downloads/771,059 bytes, zero file failures, matching complete inventories/recorded sizes/local hashes. Archive extraction failed, with no verified encrypted Storage package. |
| 1.2.3 Provider/configuration/credential inventory | DONE WITH CARRY-FORWARD; six SAVED, one PARTIAL, one UNSURE | Categorical owner report only. Auth recovery configuration PARTIAL; Cron/Vault/integration material UNSURE. Protected contents/completeness/independent recovery not inspected or tested. |
| 1.2.4 Operating decisions/checkpoint report | DONE WITH CARRY-FORWARD; targets APPROVED | Daily, 30-day retained versions, 24-hour maximum-data-loss and recovery objectives; owner run/failure records and same-day review. No execution/alert/deletion automation or achieved recovery guarantee follows from approval. |

## Database and roles: what passed

Owner-compatible Windows PostgreSQL clients 17.11 were verified against the observed hosted server 17.6. The selected export route is standalone PostgreSQL commands; earlier Docker-engine and npm PowerShell-wrapper blockers are historical and did not block that selected route. The owner verified a certificate/hostname-checked session-pooler connection with TLS 1.3; that establishes the observed connection, not recovery authority or backup completeness. Private local NTFS permissions and owner encryption/capacity reports are retained at their actual scope.

The custom database export is **2,109,566 bytes** (S1E30). Native offline archive reading and selected table-of-contents review passed. The encrypted database component is **566,080 bytes**, containing three source files; header privacy/wrong-password filename denial and extracted source hashes passed locally (S1E32). The password-excluded roles SQL is **6,310 bytes**, with 16 role definitions, 21 exported membership statements and one parameter ACL statement; its encrypted two-file package is **1,919 bytes** with matching extracted/source hashes (S1E46/S1E48). These original private artifacts are retained, not overwritten or cleaned.

Private comparisons match 16 selected role attributes and 21 exported membership/grantor/ADMIN/INHERIT/SET tuples against the earlier source metadata (S1E50). All 15 role setting-key identities across nine roles and one added parameter GRANT shape match S1E52 (S1E54). Counts/key names/grant deltas do not prove exact setting values, bootstrap owner/default/effective privilege semantics, database-scoped property values, independent credentials or managed authority at a recovery destination. Three builtin-to-builtin memberships omitted by roles-only export and managed extension/queue/Vault/key dependencies remain explicit recovery considerations; they are not commands to restore managed grants indiscriminately.

S1E56 corrected an audit counter error: default selected `pg_restore --list` output hid DATABASE/PROPERTIES entries. The actual native full/verbose listing has **2,329 entries**, one intended DATABASE and one DATABASE PROPERTIES entry, exit zero/no native messages, private receipt binding and unchanged original bytes. This is entry-presence PASS. The earlier zero/zero selected counts do not establish archive corruption or omitted database properties. Required property key/value content and recovered behavior remain unverified. Source snapshots were collected at different times; known routine/source drift and exact archived-to-live parity remain open. No further database/role diagnostic pass is requested in 1.2.

## Storage: downloaded bytes and packaging failure

Actual owner run S1E59 completed **2026-10-08T10:48:13.621Z** with four buckets and two objects. Both objects downloaded; **771,059 bytes**, zero failed files, complete before/after inventories equal, expected baseline bucket identifiers present, all downloaded recorded sizes/reread local hashes matched. This supplies actual current file-byte/local integrity evidence that database Storage metadata alone cannot supply. Source names/id mappings/private JSON/hashes/customer payloads remain in the private local run directory.

Overall result is **STORAGE_COMPONENT_REVIEW**, with **ARCHIVE_EXTRACT_FAILED**. The native operation says it cannot open the encrypted archive and asks whether the password is wrong; zero files/bytes are reported for that failed archive operation. This does not contradict the two successful earlier downloads, and it does not establish whether password entry, archive validity, prompt/tool behavior or another cause produced the failure. **Encrypted package and extracted-file hash verification remain false.** Preserve source files/partial archive/receipts; no automatic retry/password investigation/repackage or cleanup is requested here.

Matching two current inventories is not an atomic snapshot or proof of historical/deleted version coverage. Database and Storage exports are from different times. Local hashes show downloaded/local/package equality at their tested scope, not upstream content authenticity or guaranteed historical completeness. No current Storage package has verified offsite or isolated-destination recovery.

## Protected configuration inventory

| Category | Owner report | Remaining scope |
|---|---|---|
| Database/API recovery credentials and required key dependencies | SAVED | Protected copies/complete keys/authority and independent recovery untested. |
| Supabase Auth configuration/templates | PARTIAL | Owner says half done and still needs work; missing subsettings unspecified. |
| Zoho SMTP settings/credential | SAVED | Actual protected contents and independent sender reconstruction untested. |
| Deployed Edge Functions/source/configuration/secrets | SAVED | Deployed parity/dependency/secret completeness and isolated execution untested. |
| Cron/Vault/currency-provider/Web Push/VAPID integrations | UNSURE | Owner does not know; usage, recoverable values and required key/dispatch dependencies unresolved. |
| Cloudflare hosting/domain/DNS settings | SAVED | Actual configuration completeness and isolated rebuild untested. |
| GitHub deployment/access recovery | SAVED | Independent access/deployment reconstruction untested. |
| Provider account and backup-passphrase recovery arrangements | SAVED | Categorical presence only; independent login/backup unlock/recovery untested. |

`done` is interpreted as SAVED under the prior protected-copy reply contract (S1E61). It is not a blanket recovery PASS. No source/private copy is attached to public audit evidence. Keep values in owner-controlled encrypted storage/password manager; share only redacted outcome/status evidence. Existing Auth/integration gaps remain carried rather than spawn more settings/secret investigation in this checkpoint.

## Approved operating targets — S1E63

The owner explicitly replies **use these targets** on 8 October 2026.

| Target | Owner-approved objective | Implementation status |
|---|---|---|
| Frequency | Daily intended component backups; also before significant database/configuration changes | Reliable scheduled execution/completeness not verified. |
| Retention | Keep protected dated backup versions for 30 days | Retention process/capacity not verified; no deletion/cleanup scheduled. This is not a settled customer-data/legal retention policy. |
| Maximum acceptable data loss | 24 hours | Objective only; incomplete/offsite-deferred artifacts do not demonstrate this guarantee. |
| Service recovery time | Working service within 24 hours | Actual restoration time/correctness untested; measure in isolated recovery work. |
| Completion/failure responsibility | Owner records component/date/outcome and reviews missed/incomplete/failed runs the same day, preserving last verified copies | Automatic execution/failure alerts and response drill unverified. |

Approval records targets; it does not create a job, alert, retention deletion, offsite destination or provider setting. A database-only file or successful one-time export is not evidence that the daily complete-component objective is met. The owner chose to defer Google Drive work (S1E40); that decision remains unchanged and does not remove offsite resilience requirements.

## Carry-forward action plan

| Item | Gap / current classification | Concrete later action and acceptance |
|---|---|---|
| R01 Storage package | REVIEW/failed extraction; cause unknown | Resolve the package/password/prompt issue in recovery/final remediation. Require native decrypt/integrity and every extracted/source hash to match the private manifest. Retain original files until proven; do not label current package PASS. |
| R02 Auth configuration | PARTIAL | Complete protected recovery copies of required Auth URLs/providers/toggles/templates/SMTP dependencies, then reconcile source and verify isolated Auth workflows. |
| R03 Integrations/keys | UNSURE | Inventory actual Cron/Vault/currency/Web Push/dispatch dependencies privately, including required credentials/encryption keys and source/config; demonstrate isolated reconstruction without production dispatch. |
| R04 Database/settings/authority | REVIEW/UNVERIFIED | Reconcile exact role/database setting values, parameter/default/effective/bootstrap and managed/builtin/extension/key/credential semantics privately against an explicitly identified isolated target. Record authorized recovered behavior, not count equivalence alone. |
| R05 Snapshot/completeness | UNVERIFIED | Reconcile archived/current scope and source drift, required component mappings and any version/deleted/unlogged/managed limitations. Document consistent recovery-point scope and excluded data; do not assert atomicity from two listings. |
| R06 Offsite protection | DEFERRED/UNVERIFIED | At owner-authorized final remediation, settle protected independent-copy scope/privacy/key retention and demonstrate downloaded-byte/private-receipt/decrypt integrity. Google remains deferred now. |
| R07 Operating execution | APPROVED TARGETS / UNVERIFIED DELIVERY | Implement and verify complete daily export/encryption, 30-day retention and completion/failure handling under later authorized scope; verify failure reporting and protect prior verified versions. No targets become achieved by documentation. |
| R08 Isolated recovery/time | UNVERIFIED | Choose and verify isolated target in 1.3. Perform synthetic recovery and private production-artifact completeness review in 1.4; measure actual restoration correctness/time and record limits against the 24-hour objectives. |

These are follow-up actions under existing **F16**, not replacements for the original 20 findings or release gate. Resolve failed/uncertain items at final remediation and perform the agreed full re-audit; independent provider/account recovery properties remain their separate existing findings where applicable. No original finding is closed merely because work-review is complete.

## Checkpoint verification and next step

All four finite work items have outcomes (S1E57 stopping rule applied); no new 1.2 command loop remains. The prior 62 evidence events and original 123 audit/20 carry-forward table rows are preserved. JSON, links, Markdown fences, exact approved targets, counters, report/progress references, diff and published tree are checked. This closure is documentation-only; existing helpers/tests/SQL/runtime/dependencies/native tooling remain unchanged and were not redundantly rerun. Earlier synthetic helper tests remain tool evidence, separate from actual owner file/native outcomes.

**Next: 1.3 isolated staging.** Start with a read-only owner capacity/existing-target check before choosing hosted versus local resources. Verify staging frontend/backend/Auth/Storage/Edge identity separately, synthetic fixtures/controlled inboxes only, and prevent production credentials/customer data/dispatch from being used by tests. No production restore or store/APK build is part of this transition. The full Stage 1 report remains 1.6.

Related: [evidence](security-stage-1-evidence.json), [progress](SECURITY_AUDIT_PROGRESS.json), [1.2 detailed history](SECURITY_STAGE_1_2_BACKUP_INVENTORY.md), [1.3 current instructions](SECURITY_STAGE_1_3_ISOLATED_STAGING.md), [carry-forward register](SECURITY_AUDIT_CARRY_FORWARD.md), [foundations plan](SECURITY_STAGE_1_FOUNDATIONS_PLAN.md).
