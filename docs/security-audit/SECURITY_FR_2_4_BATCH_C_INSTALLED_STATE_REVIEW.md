# Batch C installed-state review: GET-only follow-up

22 October 2026, FRE120. The owner result checked at `2026-10-22T04:54:12.334Z` confirms one configuration POST, HTTP 201, six names listed through independent readback, other names unchanged and `write_outcome_uncertain: false`. CurrencyAPI status was accepted and available quota observed. Installation is confirmed at that scope. The separate offline verification output was not supplied, so no owner 20-test total is asserted.

The overall exit 1 occurred on request 12, after the post-install staging project and function-list GETs returned 200. The existing check can stop there for malformed metadata, an unexpected function, selected route presence or historical fingerprint drift. Its inner problem code was not included in the installer receipt. No post-install contact detail/body request occurred. The exact cause is unconfirmed; secret installation causing a metadata revision is only a possibility, not an established explanation.

**Do not rerun the installer.** It requires the six names to be absent, whereas the owner has now confirmed them present. The next handoff is a separate read-only review with no POST, DELETE, SQL, Auth, deployment, private packet, ZIP, CurrencyAPI or function-invocation path.

| Seven fixed GETs | Checks |
| --- | --- |
| Staging project | Provider-routed project reference, healthy status and fixed database host. |
| Current function list | Exactly one active reviewed contact function, selected four routes absent and valid metadata projection. Compute its current fingerprint and compare the historical one for information. |
| Contact detail and body | Require matching list/detail metadata, JWT/import-map settings and safe entrypoint; decode using the unchanged tested multipart decoder. Require each of the two files to match an exact reviewed LF or pinned CRLF artifact. |
| Contact detail and function list again | Require all selected current metadata and detail properties to remain unchanged during this review. |
| Configuration name metadata | Require all six installed names listed. All non-name fields are opaque and are not printed, compared or saved. |

This separate current-state review does not change or suppress the original baseline or installer guard. A historical fingerprint mismatch is reported explicitly; it cannot bypass source byte, JWT/import-map, selected-route or within-review stability checks. A successful review establishes current exact artifact parity and installed names. It does not establish the cause of a metadata change or independently prove the old function ID/version equals the new one; these fields remain false. Any future snapshot adoption must identify the new observed fingerprint and its scoped review basis.

The normal run asks only for the **same scoped Supabase Management token used for Batch C**, at a hidden prompt. Existing token permissions suffice for these GETs; no new write permission is requested. No email or saved application keys are re-entered. The runner announces read-only review start/completion and prints a bounded safe JSON receipt. Return that JSON and exit code, together with the offline verifier result.

Local checks pass **12/12** with 14 pinned source files and three JavaScript syntax checks. They exercise changed/unchanged historical metadata with exact source, modified-source rejection, JWT/import/path refusal, within-review changes, installed-name checks, exact CRLF artifacts, response bounds/errors and GET-only transport. Native Windows execution remains owner-pending. No real provider request or owner private artifact was accessed by the assistant.

Existing frontend/function deployment, canonical database integration, quarantined activation, genuine authorization/email/recovery tests and release acceptance remain pending. Readiness, live activation, hosted acceptance and finding closure remain unapproved; production/native unchanged and APK deferred.
