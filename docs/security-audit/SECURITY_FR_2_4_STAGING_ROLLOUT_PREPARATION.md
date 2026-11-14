# Current checkpoint — separate activation/recovery candidate passes70 local checks

21 October 2026, FRE99. Execution is available again. [Candidate and Windows handoff](SECURITY_FR_2_4_STAGING_ACTIVATION_RECOVERY_CANDIDATE.md), [contract](security-fr-2-email-staging-rollout-contract.json), [70-case receipt](security-fr-2-email-staging-rollout-local-checks.json). Separate candidate registration and activation recheck selected prerequisites; activation starts quarantined; committed containment retains guards/proofs/data and explicit resume refuses selected catalog drift. Original55 migrations/canonical/installer remain unchanged. Windows offline result, trusted staging target attestation, candidate/canonical integration, coordinated deployment/runtime/recovery and hosted acceptance remain pending. No hosted SQL or upload command is requested. Historical review follows.

---

# FR.2.4.E5.8 — coordinated staging rollout preparation

20 October 2026. Source reviewed at `9f878b258a2e2dc804fb9d37b11f00ac27615459`. Preparation remains incomplete until the live activation/recovery implementation is tested. The read-only owner refresh below has passed; no further owner command is requested at this checkpoint. This document does not authorize deploying or activating the existing offline installer.

## Accepted evidence retained

- [E5.7 outcome](SECURITY_FR_2_4_STAGING_SECRET_INSTALLATION_OUTCOME.md): both channels of `mushavo-budget-staging` report 13 encrypted bindings plus three retained markers. Independent metadata readback passed. Secret equality and runtime access were not established. Do not rerun the installer that expects those names to be absent.
- [Accepted modern package receipt](security-fr-2-email-modern-package-owner-Windows-pass.json): 44 entries independently read through Windows .NET; only the Worker changed from the preceding package. ZIP SHA256 `cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24`; Worker SHA256 `a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651`. Older package contracts carry an older Worker hash and must not identify this replacement.
- [Private readiness](security-fr-2-email-private-readiness-owner-pass.json) and E5.7's fresh readiness checks verified selected limiter/namespace/public-URL configuration and key acceptance by staging Auth settings. They do not establish service-role database authority or runtime limiter behavior.
- [Current Worker/SQL evidence](security-fr-2-email-current-runtime-contract.json) and [Deno evidence](security-fr-2-email-deno-edge-contract.json) retain their scoped Windows passes. Neither is provider-hosted Edge deployment evidence.
- [Refreshed owner database baseline](security-fr-2-email-rollout-baseline-owner-pass.json), checked 2026-10-20T17:27:41.729355+00:00: all nine selected checks match, including 278 routine and 166 policy fingerprints, 81 public tables and eight Storage tables with RLS, one invoker view, seven hooks, exact Auth/profile types and privileged origin. Email installer/backend/guards remain absent. The diagnostic was read-only; project selection is not independently verified by its literal target label.

## Source blockers identified

The actual [generator](../../scripts/lib/email-atomic-source.mjs) and [registration migration](../../supabase/migrations/20261017000000_email_verification_atomic_installer.sql) still accept only `OFFLINE_ATOMIC_REHEARSAL`, returning `ATOMIC_EMAIL_SOURCE_REHEARSAL_INSTALLED`. There is no implemented staging activation acknowledgement. Do not set the offline acknowledgement on hosted staging as a substitute.

The exact reviewed `ensure_rls` hook is already allowed in current source; older atomic handoff text describing it as unreviewed is historical. Current source still checks exact hook definitions and privileged origin. Do not disable or alter hooks to force installation.

Existing tests demonstrate transaction rollback on activation failure and caller rollback before commit. They do not provide a tested reversal after committed activation. A Pages rollback alone cannot undo 82 restrictive policies or 148 guarded RPCs.

## Proposed dependency order — not executable deployment instructions

| Order | Required work and evidence | Stop/recovery handling |
|---|---|---|
| 1 | Refresh the unchanged reviewed-types catalog diagnostic in the explicitly selected staging project `dczlddwbtgvfdujgcitb`. Compare all nine checks. | Any false check/error requires review; do not alter Auth column types or hooks to make it pass. |
| 2 | Implement a staging activation path with explicit target checks, preserving private ACLs, privileged origin, exact hook/catalog guards, atomicity and canonical generation. Define and test recovery for committed activation and partial cross-service rollout. | No live activation using the offline acknowledgement. Recovery must distinguish database transaction failure from a later provider/UI failure. |
| 3 | Review the deployed staging Edge inventory against the source used by the four-function Deno suite; specify the exact deployment list, configuration and previous versions to retain. Refresh Pages/limiter metadata with a checker that expects installed secrets. | Do not reuse E5.6's absence precondition or E5.7's write path after installation. Do not redeploy the unchanged limiter without a reason. |
| 4 | Record the current staging deployment identity and usable database recovery baseline; test the coordinated handoff in isolation. Register only the approved dormant installer once current checks pass. | Registration must leave application enforcement absent. Existing installer/backend state requires inspection, not overwrite or an automatic retry. |
| 5 | Deploy the selected Edge guards and accepted Pages package in a controlled staging window, with the planned handling of the period before SQL activation. Check static assets/headers and denial paths before sending mail. | Components are not one atomic deployment. Stop on mismatch; use the tested recovery path rather than disabling enforcement. |
| 6 | Run the reviewed atomic activation, then independently verify policies/RPCs/private ACLs and legitimate service access. | An uncertain SQL result requires a fresh read-only catalog inspection before any retry. |
| 7 | Test controlled recipient delivery, ordinary and Admin login, wrong/replayed codes, device restore/revocation, cross-account isolation and direct API refusal; then controlled concurrency and recovery. | Keep codes, tokens, cookies and private provider bodies out of receipts. Findings remain open until their full acceptance evidence is met. |

Steps 2–7 need concrete implementation and validation before an owner execution command. This ordering does not assert that deploying an unactivated UI provides a working login flow. The staged window and its recovery behavior must be explicit in the tested handoff.

## Completed owner action: unchanged read-only database baseline

Select the Supabase **staging** project `dczlddwbtgvfdujgcitb` and run [security_fr_2_4_email_pre_activation_reviewed_types.sql](../../supabase/diagnostics/security_fr_2_4_email_pre_activation_reviewed_types.sql). Its exact SQL is supplied in chat.

This is the existing diagnostic, not a new test or migration. It starts `BEGIN TRANSACTION READ ONLY`, reads selected system catalogs, invokes no application/hook/installer functions, prints bounded metadata and ends `ROLLBACK`. It retains its original E4.15 stage label so historical test/source identities remain intact. Its printed target is a label, not independent verification of project selection.

Received result: `SELECTED_METADATA_PREREQUISITES_MATCH_NOT_ACTIVATION_APPROVAL`, all nine checks true, installer/backend absent and read-only on. Exact receipt is retained above. This refresh completes dependency step 1 for the observed time; it does not resolve the live activation/recovery implementation blocker. No further SQL or terminal command is requested now. Next work is dependency step 2: implement and test the staging activation and recovery path once execution is available.

## This checkpoint's limits

The execution tool reports no usable execution environment. Review and this document use GitHub reads/writes only; no local suite was run and no new pass count is claimed. No runtime source, SQL source, migration, secret, account, deployment or native artifact is changed. No hosted service requests, email or activation are performed by this checkpoint. E5.8 remains in preparation; release gate and findings remain unchanged.
