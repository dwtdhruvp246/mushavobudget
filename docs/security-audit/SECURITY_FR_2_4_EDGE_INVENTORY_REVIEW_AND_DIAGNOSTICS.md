# E5.10 owner review and bounded presence diagnostics

21 October 2026, FRE104. The [owner receipt](security-fr-2-email-edge-inventory-owner-review.json), checked `2026-10-21T16:33:08.425Z` from handoff commit `8a5fc62a0fd332341fc5bbf33583f5566f62f094`, reports two HTTP 200 JSON responses: the fixed staging project metadata and initial function list. The private checker returned `SELECTED_FUNCTION_MISSING_OR_INACTIVE`, exit 1, before requesting individual function metadata. No function was invoked and no setting, deployment or application data was changed.

## Observed problem and diagnostic gap

The checker only emits that code for a selected function missing from the structurally validated list or a selected row whose status is not `ACTIVE` after its required metadata shape passes. The receipt does not identify which selected function triggered the stop. An empty selected-functions receipt does not mean all four are missing, and its null total is not evidence of zero deployed functions. A separate owner offline verifier result was not supplied and is not inferred.

Both requests were accepted. This result provides no reason to broaden token permissions. It also does not independently inspect the token's configured scope. The PowerShell exception after the safe result was the caller's deliberate stop on exit 1, not evidence of an additional provider failure.

Revision 2 corrects the diagnostic gap without weakening acceptance. After validating the list envelope, slug grammar, uniqueness and size limit, it records all four fixed selected slugs with only `present` and `status_is_ACTIVE` booleans, plus the validated total. It does this before any selected absence, non-active status or malformed metadata stops normalization. Arbitrary provider status strings, names, IDs, paths and unrelated function names are not printed. Structurally invalid lists still produce no presence summary or count.

The `function_list_observations` array labels initial and final observations separately as `BEFORE` and `AFTER`. A missing/non-active selected function still stops the checker, with no additional detail reads after that stop. Full selected metadata, its digest and observed-window agreement remain unset on failure. The seven fixed GET maximum, private token transport, source checks, target checks, no retry, no invocation, no body/secret/SQL endpoints and all deployment/runtime/recovery limitations are retained. The wrapper allowlist includes the bounded diagnostic fields and requires the revision-2 source manifest before the private prompt.

## Verification and owner action

The original 24 tests are retained. Four new actual-handler regressions cover an early missing function with all four observations preserved; mixed absent/non-active rows with private status text redacted; malformed/duplicate lists publishing no misleading summary; and a function disappearing at the final list with distinct before/after evidence. The missing/inactive path is reproduced synthetically with two successful responses, the same problem code and exit 1. This reproduces the failure class, not the unseen hosted list or its exact missing function.

[Current local result](security-fr-2-email-edge-inventory-local-checks.json), [current manifest](security-fr-2-email-edge-inventory-source-manifest.json), [request contract](security-fr-2-email-edge-inventory-contract.json), [original handoff](SECURITY_FR_2_4_EDGE_INVENTORY_HANDOFF.md). The current local result supersedes the earlier 24-case receipt for the revised tool; the earlier result remains in Git history. The new wrapper's native Windows parse and execution remain pending.

Run the complete revised pinned PowerShell block supplied in chat. Reuse the staging-scoped Project Settings Read / Edge Functions Read token if still valid, entering it only at the hidden prompt. No additional permission is requested. Return both safe JSON results and exit codes, especially `function_list_observations`. Exit 1 may persist: revision 2 explains the outstanding condition; it does not create, activate or redeploy a missing function. The owner block prints a review notice for this expected refusal rather than throwing a second terminal exception.

Review the observed per-function state before preparing any deployment action. Do not create functions, change JWT settings, run SQL, upload the ZIP or reinstall secrets in response to this diagnostic alone. Hosted acceptance remains false, findings remain open, production/native remain unchanged and APK work remains deferred.
