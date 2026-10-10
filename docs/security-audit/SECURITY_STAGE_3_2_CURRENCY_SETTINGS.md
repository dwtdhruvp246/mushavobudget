# 3.2.3 — Selected currency settings and conversion boundaries

**Last of the three 3.2 milestones — prepared, owner result pending (S3E12).** The Personal checkpoint is recorded with carry-forward (S3E07), and all 33 Family API checks passed in the owner receipt (S3E11). Two milestones are complete; this milestone requires **one API batch**, followed by reconciliation of its result and the 3.2 checkpoint summary. Failed, blocked and unverified cases go to final remediation and the fresh re-audit. The Stage 3 report remains at 3.6.

## Owner action and exact target

Use **STAGING `dczlddwbtgvfdujgcitb`**, with config served at `https://mushavo-budget-staging.pages.dev/config.js`. Run the complete immutable-commit PowerShell block supplied in chat from `C:\Users\HP\Desktop\Mushavo Budget`. It fetches `security/stage-3-authorization` and reads the runner/checker from the full supplied commit without switching or overwriting the checkout.

The runner asks for these two existing **staging app login passwords** with masked input:

1. `audit.owner@example.com`
2. `audit.outsider@example.com`

These are not Supabase database passwords. No SQL Editor query, new account, fixture setup, Cloudflare upload or function deployment is required. Do not repeat the completed Personal or Family batches or the Family fixture SQL.

The checker verifies the staging config, both Auth identities, ordinary active account status and exact retained Family scopes before writes. The primary former member must still be inactive in both membership models. Each head fixture must have its existing inactive USD 1 item and paid record, original USD settings, disabled conversions/reminders and no conversion row for that paid record. Changed, missing or ambiguous fixtures stop for review rather than being rebuilt automatically.

## What the batch changes

Both Personal owners save their **existing** currency values through the authorized RPC as a positive control. Existing Personal conversion/reminder flags are preserved, including a conversion flag that is already true. The batch does not select or mutate the retained Personal payment fixtures.

Each Family head temporarily changes the new fixture's default/reporting/base currency to INR with USD and INR enabled. Mixed case, spaces and duplicate inputs must normalize correctly. Automatic conversion remains disabled. The head then restores the original selected USD settings before the denied requests. Successful final readbacks require the original selected values on all four workspaces. Settings `updated_at` may advance; this is selected-value restoration, not a byte-for-byte or all-column rollback.

Matching heads also create **two locked manual conversion rows**, one for each existing synthetic USD 1 Family paid record, at USD-to-USD rate 1 and converted amount 1. Those conversion rows remain as audit fixtures. The existing payment values, memberships and invitation history are preserved in the selected checks. This does not process a real payment or enable automatic currency conversion.

On review, the batch stops subsequent work and retains incomplete effects for inspection. It does not attempt an automatic repair or conceal the failed state. Send the summary instead of rerunning or manually removing unrelated data.

## Frozen acceptance groups — 23 checks

| Group | Checks | Required evidence |
|---|---:|---|
| Staging config, two ordinary sessions, four scoped workspaces and supported currencies | 4 | Exact target and identities; distinct workspaces; inactive former member; USD/INR active and unsupported test code absent |
| Personal owner settings controls | 1 | Both owners save existing values; selected settings and flags remain unchanged |
| Family normalization and restoration | 2 | Each matching head changes normalized INR settings, restores USD/disabled-conversion settings, and preserves selected payment values |
| Foreign/removed/anonymous settings and owner validation | 3 | Known foreign settings hidden; RPC/PATCH denied; owner readbacks unchanged; empty, unenabled and unsupported inputs rejected |
| Direct conversion INSERT and internal helpers | 5 | Ordinary owner direct table INSERT and signed-in/anonymous calls to both internal helpers receive explicit database permission denial; selected effects remain absent |
| Manual conversion authorization and positive controls | 3 | Foreign/removed/anonymous manual conversion denied; each matching head reads its correctly attributed locked manual row |
| Conversion row isolation and protected direct mutations | 2 | Known foreign rows remain hidden; denied PATCH/DELETE leave owner readbacks unchanged; owner direct mutation cannot bypass the protected RPC |
| Disabled backfill | 1 | Matching head receives zero with no selected effect; foreign/removed/anonymous callers are denied |
| Final preservation and generated-session logout | 2 | Selected original settings and Family payment values match; exactly the expected manual rows remain; local-scope logout requests accepted |
| **Total** | **23** | Full success returns `STAGING_CURRENCY_API_SCOPED_PASS` and runner exit 0 |

Denied requests use valid existing targets and inputs. Empty RLS representations or explicit `42501` permission errors are accepted where appropriate; protected RPCs also allow the precise expected `P0001` authorization/validation messages. A missing function, bad token, foreign-key failure, generic server error or timeout is not an authorization PASS. Owner readbacks after selected attempts detect hidden changes behind a denial or a zero backfill result.

The four helper requests recheck signed-in/anonymous function-level restrictions using a valid retained Family paid record. If the owner batch passes, this supplies new evidence for those role/function boundaries. It does not rewrite the historical S3E07 receipt or prove execution of the stopped Personal batch's exact entity requests. The Personal binding failure, foreign-item relink and own-fixture deletion cases remain open for final remediation/re-audit.

## Current source contract

The latest `save_workspace_currency_settings` replacement in [Business Stage 3 migration](../../supabase/migrations/20260928130000_business_stage_3_onboarding.sql) authorizes the selected non-Business owner controls, normalizes currency inputs and validates supported currencies. Business settings require their separate path; ordinary test-account checks prevent platform authority from masking these controls.

`payment_conversions` has a protected write path. The selected manual RPC resolves the known paid record and its workspace, authorizes the matching head, verifies amounts and records manual attribution. A disabled Family workspace backfill must return zero. Internal writer/date helper execution remains restricted by [Stage 0 helper hardening](../../supabase/migrations/20261006050000_security_stage_0_currency_helpers.sql). No product migration, RLS policy, grant or Auth setting is changed by this preparation.

## Validation and practical limits

- [API checker](../../scripts/check-stage-3-currency-api.cjs) and [PowerShell runner](../../scripts/run-stage-3-currency-acceptance.ps1) are ASCII. The runner clears temporary password environment variables, secure strings and unmanaged buffers in `finally`; summaries omit passwords, tokens, keys and raw rows/identifiers.
- [Source validator](../../scripts/verify-stage-3-currency-source.mjs) passed **nine cases**, loading 52 ordered migrations into external PGlite 0.5.8 / PostgreSQL 18.3. It runs the completed 33-check Family flow locally to obtain the post-removal state, then verifies the full 23-check currency flow (197 fetches) and eight faults: hidden settings changes, foreign settings exposure, false FK denial, missing helper, executable helper, wrong manual attribution, hidden backfill effect and logout failure.
- [Eight isolated tests](../../tests/stage-3-currency-api.test.cjs) passed for config/credential guards, strict denial classification, error redaction, runner cleanup and extracted Node success/review paths. Native PowerShell execution of this new batch remains owner-pending.
- Local validation uses explicit minimal Auth, Storage, initial default-grant and HTTP adapters. Unavailable `CREATE EXTENSION pgcrypto` is omitted locally; composite RPC/date responses are adapted. This is source/checker evidence, not hosted Supabase body parity or native PostgreSQL recovery evidence.
- Automatic FX/provider rates, service scheduler execution, historical conversion integrity, global finance settings, Business currency roles and rendered invitation UI are outside this selected batch. Local logout acceptance is not immediate invalidation proof for every previously issued JWT. Transitive hosted dispatch remains independently unverified.

**Send the JSON summary and redacted errors only.** Full success is 23 PASS checks, `STAGING_CURRENCY_API_SCOPED_PASS`, exit 0 and selected-settings restoration verified. A `STAGING_CURRENCY_API_REVIEW`/exit 1 is an intentional stop for result review; retain the fixtures. After the receipt, record the 3.2 checkpoint and its carry-forward list before proceeding to 3.3 Business authorization. F15 remains open until the required remediation and affected rechecks are complete.
