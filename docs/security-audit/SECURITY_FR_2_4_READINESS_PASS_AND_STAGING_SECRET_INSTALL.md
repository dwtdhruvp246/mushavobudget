# FR.2.4.E5.6 passed; E5.7 staging encrypted bindings

20 October 2026, FRE96. Parent `5c9689dbf7be9342a3c0f5fcb18a47eb9e31bd49`.

[Owner readiness receipt](security-fr-2-email-private-readiness-owner-pass.json), checked2026-10-20T05:42:30.965Z, confirms7 requests and exit0. Four Cloudflare requests returned200. The invalid API key control returned401, and both the saved Publishable and modern Secret key returned200 at the fixed staging Auth-settings endpoint. Both staging channels retained reviewed dates, fail closed, latest-date off, three exact markers and selected SQLite limiter binding; the other13 gateway variables were absent. The DPAPI packet and modern ZIP stayed unchanged.

This is scoped provider key acceptance at public Auth settings, not proof of database service-role privileges, user JWT authorization or mail delivery. The upload contains only the private readiness receipt; its preceding offline verifier count/native junction result was not separately supplied and is not inferred here. The prior offline failure is retained in history. No configuration write, sign-in, application routine, email or deployment occurred.

## Concrete next action

The new private installer adds13 missing `secret_text` bindings to each of the production and preview channels **of `mushavo-budget-staging` only**. These are not the customer production project. The accepted ZIP SHA256 remains `cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24` and stays unuploaded.

The owner command requires the explicit `-InstallStagingSecrets` switch. Source hashes, private pipe, exact archive and DPAPI packet are checked before hidden Cloudflare Account ID/API-token prompts. Use a token with the read access already exercised plus staging Pages edit access (the previous successful compatibility-date token met that requirement then). Supabase/Zoho values and peppers are reused from the packet; no new key values or recipient addresses are requested.

The handler freshly repeats the actual7-GET readiness flow, including both key checks and the invalid-key control, before any write. It also requires a static manual Pages deployment, no Git source/Wrangler management and exactly the3 reviewed public environment markers in both channels. Existing target secrets or any unrelated environment variable stop installation instead of being overwritten.

One PATCH submits only `deployment_configs.production.env_vars` and `deployment_configs.preview.env_vars`:13 new `secret_text` rows plus the3 existing `plain_text` markers at their exact unchanged values per channel. Including the markers preserves them under either map-merge or map-replacement behavior. No deletes, dates, bindings, build/source/deployment fields or other settings are submitted.

A fresh independent project GET must show all13 target rows as `secret_text` in each channel and exactly16 required variables. All other observed channel settings and selected source/build/deployment metadata must match the privately captured pre-write snapshot. Values, hashes of values, account IDs, namespace IDs and raw responses are not returned. Cloudflare's [project PATCH API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/edit/) documents encrypted `secret_text` variables; deleting a variable uses a null value, which this payload never submits.

## Failure and acceptance limits

Maximum9 requests:7 readiness GETs, one PATCH and one independent GET. No PATCH retry or automatic rollback is performed. Readback is attempted even after a failed/uncertain PATCH; an uncertain HTTP outcome, partial result, plaintext target row or unrelated metadata drift returns exit1 with `remote_state_may_require_review:true`. Return that safe receipt before retrying. The runner also conservatively requires remote review if the private child fails after installation execution starts.

GET readback establishes binding-name/type metadata only; it cannot prove equality of protected secret values or live Worker use. Concurrent external configuration changes are not excluded. Actual runtime binding, service database authorization, provider mail delivery and user/Admin acceptance remain later checks.

The encrypted file and ZIP are compared unchanged after execution. No plaintext secret file is created; credential data travels only through private process memory, the UTF8 parent-child pipe and the HTTPS request. Ordinary managed strings are not promised to be securely erased. The local files are not uploaded by this step.

## Validation and handoff

[Offline checks](security-fr-2-email-secrets-local-checks.json):72/72 pass (28 installer cases plus44 existing readiness/inspector cases),32 source SHA256s and24 syntax checks. Tests run the actual installer/readiness handlers with synthetic provider ports. They cover exact payload scope, explicit acknowledgement, seven fresh checks, independent readback, preserving markers/settings/deployment, refusal of existing variables, partial writes, denied/ambiguous responses, timeout-after-commit, no retry/rollback, response bounds, secret redaction, CLI preflight and private wrapper source assertions. No real hosted request or owner credential was accessed by the assistant. Actual owner Windows private execution and hosted binding installation are pending.

Export the pinned commit with LF line endings, run `scripts/verify-fr-2-email-pages-secrets.mjs` (built-in Node; no npm), parse `scripts/run-fr-2-email-pages-secrets.ps1`, then invoke with the accepted candidate directory, encrypted packet path and explicit install switch. Return only safe offline/installation JSON and exit codes.

This installs staging configuration only. It does not upload the ZIP, change SQL/Auth/roles/hooks, send mail, dispatch jobs or activate the email gate. All full findings stay open; release gate `OPEN_PENDING_REQUIRED_EVIDENCE`, re-audit `PLANNED_NOT_PERFORMED`. Production/native unchanged; APK update deferred.
