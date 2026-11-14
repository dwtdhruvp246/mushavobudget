# 4.2 — Upload/download source review and bounded contract

**4.2.1 COMPLETE at source/documentation scope — 11 October 2026, S4E04.** Baseline `9373887eeb70ac8285485f1fbd804f1cb4d9e541`, branch `security/stage-3-authorization`. Step 4.1 is [closed with carry-forward](SECURITY_STAGE_4_1_CHECKPOINT_REPORT.md). Next **4.2.2**, reviewable control candidate and meaningful local checks; full Stage 4 report remains due at **4.4**.

This review preserves F13, the original 123 coverage rows/20 finding definitions, DL-R01–DL-R06, earlier F08/F15/F20 dependencies and existing audit fixtures. Source gaps and unverified deployed behavior remain distinct. No upload, object removal, signed URL, parser/scan service, hosted SQL/settings, account/provider/email/job, deployment/production or native action was performed.

## Evidence scope

Reviewed app.js/business.js, their two HTML pages, sw.js, cumulative schema and 52 ordered migrations, and seven tracked Edge entrypoints. **65 local selected files match pinned Git blobs:** 53 SQL, five client/page/SW files and seven Edge entrypoints. This is source integrity, not 65 security tests.

The [source inventory](security-stage-4-upload-source-inventory.json) records four literal private-bucket definitions, nine file inputs, 14 selected named client functions, 15 latest literal Storage policy declarations (12 permissive/three restrictive), and 22 latest selected routine definitions. Ordered literal CREATE/DROP extraction is **not SQL execution, complete transitive analysis, an overloaded routine/effective-grants catalog, conditional-DDL proof, deployed policy parity or a live Storage inventory**.

No Node/DB/browser/API/content test ran at 4.2.1. Earlier 46 local lifecycle cases are historical 4.1.2 evidence, not upload validation results. Bucket/provider/runtime settings and real object bytes have not been queried.

## Existing accepted surfaces and source limits

| Surface / bucket | UI allows | Bucket metadata allows | Source cap |
|---|---|---|---|
| Personal/Family recorded or completed payment — payment-proofs | JPG/JPEG, PNG, WebP, PDF | Same four MIME types | 10,485,760 bytes (10 MiB; UI says 10 MB) |
| Personal/Family renewal/extra places and Business subscription — subscription-proofs | JPG/JPEG, PNG, WebP, PDF | Same four MIME types | 10,485,760 bytes |
| Business expense claim/bill/payment attachment — business-documents | JPG/JPEG, PNG, WebP, PDF | Also text/csv and XLSX MIME for general Business documents | 10,485,760 bytes |
| Business setup/settings logo — business-logos | PNG, JPG/JPEG, WebP | Same three MIME types | 2,097,152 bytes (2 MiB; UI says 2 MB); browser decode dimensions at most 4096×4096 |

All four source bucket inserts/upserts specify private access. Do not infer the hosted buckets retain these exact settings. Preserve accepted proof/logo types and distinguish wider Business document backend formats from the receipt UI; do not silently remove PDF/CSV/XLSX or accept executable content because a MIME label looks correct.

## Existing controls worth preserving

- All reviewed upload calls use upsert:false and generated UUID components. Client filenames are sanitized or converted to a MIME-derived extension; the supplied display name remains separate metadata.
- Business proof clients reject empty files and enforce their 10 MiB cap. Logos use createImageBitmap, close the bitmap, bound dimensions and revoke discarded preview object URLs.
- Payment/subscription buckets use user/workspace/family paths and authenticated owner/member/staff policies. Business document upload/read/delete helpers incorporate workspace permissions, active state, registered documents and claim/bill visibility.
- Business register_business_document checks path, permission, own editable claim parent and existing storage metadata, with additional parent/bill registration triggers. DB document columns constrain MIME, nonzero size and optional checksum syntax.
- Business subscription payment registration checks actual Storage metadata for equality. Submitted subscription proof deletion is guarded by an existing-reference check. Document archive and bill/claim proof locks preserve relevant submitted/paid evidence.
- Business logos have active owner/membership/subscription helpers and profile-version/object metadata checks. Reads admit intended members for linked logos and owner checks for own drafts.
- Business billing proof-open and logo-refresh paths have load-sequence/context guards; their existing protections must survive changes. The SW fetch handler declines cross-origin requests and /storage/ paths; a limited static-shell allowlist is cached.

These observations are source behavior, not fresh allowed/denied API acceptance. An optional client-supplied checksum with format validation is not a server-computed byte integrity result.

## Concrete review targets

| Area | Source observation | Consequence / next evidence |
|---|---|---|
| Byte content | Proof clients rely on File.type and declared size; logo decode is browser-side. No trusted byte parser/normalizer/quarantine/scan route was identified in selected clients/Edge entrypoints/routines | Direct Storage API callers bypass browser checks. Candidate needs a justified trusted validation design and honest processing state; MIME/signature matching alone must not claim malware-free content |
| Empty files | app.js validateProofFile and recorded/completed payment checks enforce type and upper size, without the explicit nonzero browser check used by Business | Add consistent nonempty validation; source DB size constraints remain separate and need exact direct-effect tests |
| Filename/path binding | Payment proof paths retain a sanitized client basename; subscription helper derives extension from file.name. Sanitization does not bound every basename or establish byte type | Use bounded canonical storage names/path validation while preserving separate safe display names; test long/double/mismatched/ambiguous names |
| Registration evidence | Ordinary renewal validates declared proof/path values without a Storage metadata lookup in its reviewed latest routine. Business registration uses coalesce(actual metadata, supplied value) fallbacks; other Business payment paths require actual equality | Review per-path authoritative object/type/size/owner/parent/content-status binding; missing metadata must not quietly become trusted client assertions |
| Policy composition | Four bucket-specific permission sets plus three restrictive Business subscription guards; no selected UPDATE policy | Evaluate effective permissions and API operations, including overwrite/list/download/sign differences. Restrictive guards are additional AND constraints; their non-subscription branch does not itself grant access to other buckets |
| Family payment files | Read/insert/delete depend on family/user path/helper checks; Family delete policy does not check a proof's current payment-record link | Verify actual parent/owner/member rules and desired active-evidence deletion semantics without banning legitimate record deletion or silently detaching finance history |
| Link/session race | Payment proof opener and claim/bill receipt click handlers await signed URLs then open without the captured user/workspace/epoch checks present on billing/logo paths | Late response may open after a context change; source REVIEW, not demonstrated cross-user disclosure. Capture/recheck context and test account/workspace switching |
| Link lifetime/serving | Proof links request 60 seconds; logo links 600 seconds, locally refreshed before expiry. Clients generally open links/inline image previews rather than an authenticated streamed download | Verify actual URL access/expiry/role-removal, Content-Type/disposition/security/cache behavior and browser/native handling. No immediate revocation guarantee |
| Capacity/processing | Per-object byte caps and browser logo dimensions exist; no complete aggregate-count/byte/concurrent reservation, parser/decompression, upload/sign/download rate budget or trusted processor flow identified | Define actual supported limits and processor privacy facts; do not invent paid-plan quotas or send financial files to a public scanning service |
| Failure/cleanup | Upload/register failure compensation, DB-first payment deletion and old-logo removal run in the client; some remove results are ignored or only promise later admin cleanup | Failures/ambiguous responses, workspace/owner changes and orphan/active evidence need authoritative manifests, durable reconciliation and truthful status. No live orphan was created or observed here |

Business logo upload can succeed before a subsequent context check rejects the result; the path is not a durable account/workspace cleanup record. Replaced-logo cleanup is fire-and-forget after confirmed save, and its current-owner permission helper can differ after ownership transfer. These are concrete failure-path review targets, not evidence existing hosted files were leaked or erased.

No server scanner was identified in the reviewed application source; this does not attest every external provider capability. Existing service/storage controls must be verified rather than assumed absent.

## Candidate contract for 4.2.2

1. Prepare reviewable changes for consistent file/name/type/size handling and captured-session/workspace proof-link/upload results, with meaningful isolated tests. Preserve supported product types and valid permission branches.
2. Separate client usability validation from trusted enforcement. Document a coherent server ingestion/content-status design; direct Storage upload permissions, committed registration and private serving must not bypass any newly promised server content gate.
3. Validation must use actual bytes and resource-bounded type-specific handling. Image decode/dimensions, PDF structure/active-content disposition, and general CSV/XLSX parsing/formula/ZIP risks need supported controls. An extension/magic header or mock processor cannot certify content safety.
4. Review actual metadata and object/parent/owner/version bindings, policy composition and operation-specific authorization. Preserve Business locks/restrictive billing policies and unresolved Stage 3 parity/MFA/Personal-binding dependencies; no blanket revokes, staff elevation or guard bypass.
5. Design durable upload/commit/cleanup states with idempotent retry/reconciliation. A timeout can mean committed registration; do not delete a linked proof solely because a browser call rejected. Costs/processor/privacy decisions remain explicit DECISION/BLOCKED where unsupported.
6. No hosted upload, object deletion, bucket/policy install, real scanner dispatch, production/native rollout or broad retrospective rewrite is inferred. Candidate/local checks are scoped evidence, followed by one bounded 4.2.3 outcome.

## Frozen UF01–UF06 acceptance matrix

**30 selected grouped cases** (six groups × five); none executed. Variants across four bucket/surface types are documented effects within a case, not a promise of exactly 30 API calls. Use harmless well-formed synthetic files and safely malformed benign fixtures; never submit real malware or customer finance files to third-party scanners.

| Group | Five selected cases | Required observed outcome |
|---|---|---|
| UF01 — Formats/content | Valid allowed formats per surface, including general Business CSV/XLSX; Declared MIME/extension/byte mismatch using harmless fixtures; Empty/truncated/malformed content; Disallowed HTML/SVG/script or harmless polyglot masquerade; Large dimensions/processing or archive-structure boundaries | Valid supported content preserved; invalid or unsafe/unverified processing never served as validated. |
| UF02 — Object authorization | Own Personal and intended Family object access; Foreign workspace/uploader/path spoof; Inactive removed member and outsider denied; Suspended/expired state with intended read/delete exceptions; Business scoped role and actual staff/MFA allowlists | Direct Storage list/read/sign/upload/delete effects match final permissions; no reliance on hidden UI. |
| UF03 — Registration/binding | Valid object matches record/parent/workspace; Missing/null object metadata and nonexistent object; Object MIME/size/owner/path mismatch; Foreign or disallowed claim/bill/payment parent; Overwrite/delete/archive of active or submitted evidence | Authoritative valid binding; impossible/foreign/mismatched registrations denied; approved evidence rules preserved. |
| UF04 — Download/link/session | Allowed view/download renders with safe response/name treatment; Foreign authenticated GET/list/sign attempt denied; Issued URL before/after TTL, removal and role change; Account/workspace switch during pending proof/sign operation; Browser/SW/cache/log/referrer or device residual link exposure | Correct bytes and observed access window; stale context never opens another session's result; private tokens omitted from shared receipts. |
| UF05 — Limits/cost/processors | Exact file caps and just-over boundary for proof/logo; Count/aggregate bytes and concurrent reservation boundary; Repeated upload/sign/download rate or egress boundary; Bounded image/ZIP/spreadsheet/PDF processing resource behavior; Known processor/quarantine status and privacy failure/outage | Actual supported budgets and failure states enforced; no infinite client retries or unreviewed third-party disclosure. |
| UF06 — Failure/cleanup/preservation | Upload succeeds then registration fails; cleanup result observed; Ambiguous committed registration response; referenced bytes preserved; User/workspace change after upload; orphan manifest retained; Logo replacement/owner transfer/shared evidence cleanup; Idempotent bounded reconciliation and retained audit/financial history | Truthful resumable cleanup, no deletion of committed/shared proof, exact unrelated fixture/history preservation. |

A missing deployed candidate, exact source/policy/metadata parity, controlled actor/known path, supported processor/limit decision or recoverable cleanup boundary makes dependent cases BLOCKED at 4.2.3. Existing Personal-binding, Business trigger/policy and privileged MFA/recovery limitations remain prerequisites for affected variants; they must not be bypassed. One finite hosted/owner phase or recorded BLOCKED result follows local preparation, then 4.3.1.

## Actions

| ID | Current result | Required work and closure evidence | Finding/dependency | Owner |
|---|---|---|---|---|
| UF-R01 | Declared MIME/size and browser-logo decode exist; server content validation not identified | Prepare type-specific validation from actual bytes with bounded decode/structure/resource checks, canonical names and a justified trusted processing/quarantine design; preserve JPG/PNG/WebP/PDF and separately supported CSV/XLSX. Header/signature checks alone are not malware or parser safety proof. | F13,F20 | Developer/Both |
| UF-R02 | Private bucket/source permission policies exist; exact hosted effects unverified | Verify final buckets/policy composition/grants/helper roles and direct own/foreign/removed/suspended/expired/scoped actor operations; preserve restrictive Business billing guards, intended staff roles and valid owner/member permissions without bypassing Stage 3 parity/MFA blockers. | F13,F15,F08 | Both |
| UF-R03 | Proof object/record binding varies; some metadata paths trust fallbacks | Require authoritative existing object/path/size/type/owner/parent/workspace binding and suitable approved content status before registration or serving; reject missing/mismatched/foreign uploads and protect submitted/active evidence according to product rules; recheck actual bytes and financial history. | F13,F15 | Developer |
| UF-R04 | 60-second proof and 600-second logo links; selected late-response context guards differ | Bind pending proof/link operations to captured user/workspace/epoch; verify download response treatment and actual signed-link lifetime/replay after access removal, cache/log/referrer handling and native/WebView behavior; do not claim Auth rotation revokes Storage signatures. | F13,F08,F15,F20 | Developer/Both |
| UF-R05 | Per-file caps present; aggregate/rate/decode/processor limits not verified | Define supported count/byte/processing/egress budgets without inventing paid-plan limits; enforce server bounds/concurrent reservations and scoped rate limits where justified; document parsers/processors/data handling and test harmless boundary/decompression cases. | F13,F20 | Both |
| UF-R06 | Selected compensation and old-file cleanup are browser operations | Use authoritative manifests and durable bounded cleanup/reconciliation; distinguish failed versus ambiguous registration, respect active/submitted/shared evidence, handle user/workspace/owner changes, report retained cleanup truthfully and recheck fixtures/history before final full re-audit. | F13,F02,F15,F20 | Developer/Both |

All actions remain OPEN. They extend the original F13/F15/F08/F02/F20 action scope, not original finding definitions. Keep existing audit.owner@example.com/audit.outsider@example.com, Personal/Family records, inactive former member and both USD1 conversions intact; any new upload-test bytes/rows need their own exact fixture/cleanup scope.

## Primary requirements checked 11 October 2026

- [OWASP File Upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): user MIME is untrusted; combine extension/type/content handling, bounded processing, safe names, authorization and appropriate private scan/normalization controls. Signature validation alone is insufficient.
- [Supabase bucket restrictions](https://supabase.com/docs/guides/storage/buckets/creating-buckets) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): MIME/size bucket settings and operation-specific RLS serve different purposes; overwriting needs additional permissions. Service credentials bypass RLS and stay server-side.
- [Supabase private downloads/signatures](https://supabase.com/docs/guides/storage/serving/downloads): private access uses signed links or authenticated requests. Storage signing keys are separate from Auth; Auth key changes do not revoke unexpired Storage signatures.
- [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html): permissive alternatives combine by OR, restrictive constraints by AND.
- [Supabase object deletion](https://supabase.com/docs/guides/storage/management/delete-objects): remove bytes via the Storage API; SQL metadata deletion alone is not file removal.

These primary references establish review principles, not Mushavo deployment/compliance or server processing acceptance.

[Stage 4 plan](SECURITY_STAGE_4_DATA_PRIVACY_PLAN.md), [source inventory](security-stage-4-upload-source-inventory.json), [Stage 4 evidence](security-stage-4-evidence.json), [progress](SECURITY_AUDIT_PROGRESS.json), [carry-forward](SECURITY_AUDIT_CARRY_FORWARD.md).
