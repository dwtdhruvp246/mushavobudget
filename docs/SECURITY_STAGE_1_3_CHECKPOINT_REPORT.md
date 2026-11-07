# 1.3 — Isolated staging checkpoint report

Closed 8 October 2026 **with scoped passes and carry-forward**. Stage 1 remains in progress and advances to 1.4, synthetic recovery testing. This report covers five finite 1.3 work items; zero remain in this setup checkpoint. It is not full staging isolation, all-role security, backup recovery, mobile-store or release acceptance.

## Intended environments and evidence

Production reference: kttkospkblwvguuwnhjj. Staging reference: dczlddwbtgvfdujgcitb. Owner supplied https://mushavo-budget-staging.pages.dev as the separate frontend. Identity/reference and provider configuration are owner-reported; root had no signed-in provider or customer access. Actual hosted SQL/API result summaries came from the owner. Read-only SQL labels alone do not establish hosted identity.

| Work item | Outcome | Evidence and limits |
|---|---|---|
| 1.3.1 Separate target | Owner-reported complete | New project reference differs from production. Account-wide inventory and independent Dashboard identity were not verified. |
| 1.3.2 Initial metadata | Complete with review limits | PostgreSQL 17.11; zero Auth users, Storage buckets/objects and public nonextension relations; one public routine identified. Not an all-schema emptiness proof. |
| 1.3.3 Application schema | Owner execution PASS | Native psql completed the guarded, combined 51-migration script. SQL Editor size limit and wrong-password precheck were resolved without evidence of a partial schema import. Exact production schema/data parity remains unverified. |
| 1.3.4 Test configuration | Prepared/confirmed scope PASS | 34 static files; production project-reference scan passed and VAPID public key removed. Deployed config checked; owner confirmed staging Auth URLs, Confirm email on, SMTP off, Google disabled, no Edge functions/production secrets added. |
| 1.3.5 Synthetic operation/access | Scoped PASS | Five owner UI outcomes and twelve actual Data API checks passed for two synthetic Personal accounts and one USD 20 payment. Untested workflows remain below. |

## Initial routine review

The public routine was postgres-owned plpgsql SECURITY DEFINER rls_auto_enable(), returning event_trigger, linked to enabled ensure_rls for CREATE TABLE / CREATE TABLE AS / SELECT INTO. Six additional Supabase-admin-owned triggers concerned extension access and API schema handling. They were retained. Names/linkage indicate the helper's purpose but do not prove its exact body, SECURITY DEFINER authorization, search path or all runtime behavior.

## Schema and frontend preparation

All 51 source migrations replayed individually and as one combined transaction in a disposable embedded PostgreSQL fixture. The fixture substituted minimal Auth/Storage definitions and omitted pgcrypto extension creation; it did not prove hosted service semantics. Owner then executed the actual script via installed PostgreSQL psql, verified TLS, explicit staging pooler user, no startup file, ON_ERROR_STOP and an empty-target guard. Password authentication initially failed before setup; owner confirmed the wrong password and later reported successful completion.

The frontend export read reviewed commit e5b1936847e22a04a3f5fd63785ceed3b4d0f9da from Git, preserving the original dirty Windows checkout. Production project references were replaced and the production VAPID public key removed. Owner reported a separate Cloudflare Pages upload and four true deployed-config flags. Root's web retrieval service could not access the new site, which is not evidence the site was down. API verifier later successfully loaded the deployed config and authenticated against staging using its publishable key. This is meaningful endpoint/key acceptance evidence; it does not exhaustively inspect every browser runtime request or deployed asset.

## Actual synthetic results

Two manually created confirmed staging accounts used reserved fictional emails. No production account import or email invitation was requested. Owner reported both sign-ins, Personal workspace separation, persistence after reload and the first user's payment hidden from the second user.

The direct verifier returned **PERSONAL_API_READ_AND_NOOP_UPDATE_PASS**, problem_code null, twelve PASS results:

1. Deployed config restricted to staging.
2. Two distinct staging Auth sessions and identities verified.
3. Owner reads the USD 20 Personal item and owner-owned workspace.
4. Owner reads its matching paid record.
5. Owner same-name update succeeds as a positive control.
6. Outsider item read returns no rows (HTTP 200).
7. Outsider paid-record read returns no rows (HTTP 200).
8. Outsider same-name update affects no owner row (HTTP 200).
9. Anonymous item read returns no rows (HTTP 200).
10. Anonymous paid-record read is rejected (HTTP 401 / verifier requires PostgreSQL privilege-denial code).
11. Anonymous same-name update affects no owner row (HTTP 200).
12. Owner can still read unchanged selected payment values.

An HTTP 200 with an empty array can represent row filtering; HTTP status alone was not counted as denial. Missing owner seeds, generic HTTP errors, invalid JWTs and unexpected readable/updated rows fail the verifier. The same-name positive update can run timestamps/triggers on the synthetic row; it intentionally changes no amount, currency or name. Script-issued sessions were signed out, credentials/tokens/raw rows/identifiers were omitted, and the test payment remains in staging. Independent browser sessions are separate.

## Carry-forward and actions

| Gap | Action / later scope |
|---|---|
| Full runtime/provider isolation | Reconcile deployed assets, browser network destinations, provider configuration and dispatch inventory. Keep production secrets out of staging. |
| Insert/delete/RPC and Family/Business/custom-role access | Test normal and denied cases in their dedicated permissions/workflow audit scope. These Personal read/update results do not substitute for that matrix. |
| Storage object authorization and bytes | Use controlled synthetic file operations and restoration checks; bucket definitions alone are insufficient. |
| Email, push, currency-provider and Edge workflows | Keep dispatch disabled until distinct test credentials/destinations and explicit test scope are prepared. Delivery behavior remains unverified. |
| Production parity and managed helper behavior | Reconcile metadata/configuration and managed dependencies before any broader recovery conclusion. |
| Backup/recovery, offsite and operating gaps from 1.2 | Remain open. 1.4 uses synthetic exports/restoration, not customer imports; Google Drive remains deferred. |

No control above is silently converted to PASS. The final audit must resolve failed/uncertain items and rerun affected checks. Full Stage 1 reporting remains at 1.6.

## Next: 1.4 — four finite recovery work items

1. **1.4.1 Target and scope:** verify native PostgreSQL server tools and prepare a separate local recovery target; document supported/missing managed dependencies.
2. **1.4.2 Synthetic exports:** export the staging test database scope and a controlled dummy file, recording private hashes and export scope. Production backup completeness remains a separate owner-private review.
3. **1.4.3 Restore and validate:** restore into the separate recovery target; compare records, relations, selected grants/RLS and file bytes, recording elapsed time and actual failures.
4. **1.4.4 Checkpoint report:** classify passes, partial coverage and blockers; carry unsupported platform/service recovery rather than claim a full disaster-recovery guarantee.

No production database overwrite, customer-data import into staging, Google upload, Docker requirement, new paid project or enabled dispatch is proposed by this plan. PostgreSQL commands remain the owner's chosen workflow. Local tool version checking starts no server and changes no database.
