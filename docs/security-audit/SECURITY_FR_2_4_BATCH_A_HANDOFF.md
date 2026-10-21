# Batch A: combined local Edge configuration preparation

21 October 2026, FRE116. E5.13 is complete at its selected source and metadata scope: the owner revision 5 receipt passed six read-only requests. The next checkpoint is **FR.2.4.E5.14, Batch A**. Its implementation passes 24 offline tests and three JavaScript syntax checks with 25 pinned source files. Native Windows runner execution and the owner's private candidate remain pending.

The owner requested fewer handoffs, combined steps wherever possible, and explicit start and completion messages for each batch. The launch objective includes public web, Google Play and Apple App Store. This preparation does not increase the previously reported rough 19% checkpoint metric or establish whole-product completion.

| Work combined in one owner run | Result |
| --- | --- |
| Retained accepted Pages ZIP | Check whole ZIP identity, 44 entries, pinned Worker and fixed staging configuration without extracting or executing it. |
| Edge source package | Reproduce a fresh 12-file public package in the isolated source snapshot, or inspect that exact output if already present; require the previously accepted identity. |
| Private input review | Ask availability for both inputs together; if both exist, use hidden prompts to validate the VAPID pair, contact subject syntax, CurrencyAPI input syntax and relation to the ZIP's frontend push key. |
| Local candidate retention | Only after validation, generate an independent staging caller secret and save all six candidate variables to a new Windows CurrentUser DPAPI file, then decrypt that new file privately for exact readback. |

No npm installation or Management token is required. No provider endpoint, application function, email, push or FX request is used. Existing private packets are not opened. No settings, schedules, ZIP contents or runtime source are changed. The newly generated caller secret is a local candidate, not an active credential rotation.

The runner prints `BATCH A STARTED`, one bounded `BEGIN SAFE BATCH A RESULT` JSON receipt, and an explicit completion or missing-input message. Return the offline verifier JSON and batch JSON with both exit codes. Never return credential values or the encrypted packet contents.

| Batch exit | Meaning and next action |
| --- | --- |
| 0 | Validated local candidate saved and read back. Hosted configuration installation, deployment and activation are pending. |
| 2 | Checks finished, inputs missing or requiring review. All identified input issues appear together; no private candidate saved. Resolve these from the receipt before another attempt. |
| 1 | A local source, artifact or runner precondition failed. Return the safe receipt; do not repeat unchanged. |

Default retained ZIP: `C:\Users\HP\AppData\Local\Temp\mushavo-email-modern-review-365a33690028462489520db3e85c4b90\mushavo-email-modern-review.zip`. A different explicit path can be supplied using the runner's `AcceptedZIP` parameter, but its required content identity stays fixed. No filesystem search is performed.

Accepted ZIP SHA256: `cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24`. Worker SHA256: `a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651`. Edge package identity: `e1fb82c6001ee4bb8f3d6999f078a028637cf90d912e275fb14ac84774f192a3`.

If the accepted ZIP has no frontend VAPID key, the candidate may be saved with `frontend_candidate_update_required: true`. A later frontend candidate update remains required; the runner does not alter the ZIP or prove which key is currently live. A different existing frontend key blocks candidate retention. It does not generate a new VAPID pair or borrow production credentials.

CurrencyAPI validation is restricted to local input syntax, not provider validity, account entitlement or quota. VAPID subject checks are local syntax restrictions, not contact ownership verification. Pair validation does not independently establish that the key is dedicated to staging; that availability declaration comes from the owner. The P-256 calculation uses Node's native crypto API ([Node documentation](https://nodejs.org/docs/latest-v22.x/api/crypto.html)); the contact/key forms follow [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292.html), with additional local input restrictions.

Plaintext exists transiently in the parent and child processes and their private pipe. BSTR and byte buffers are cleared where controlled; managed strings and process memory are not claimed to be forensically erased. Disk retention uses DPAPI only and a unique new file. Windows parsing, ZIP wrapper execution and DPAPI behavior for this new parent require the owner run; local tests exercised the actual JavaScript module and private CLI with synthetic inputs, under the existing offline network blocker.

Later work remains: provider credential acceptance, external caller/scheduler review, configuration installation, coordinated database/Edge/Pages rollout with recovery, genuine hosted authorization/email tests, remaining final remediation batches and store release acceptance. Readiness, live activation, hosted acceptance and finding closure remain false. Production/native unchanged; APK deferred.
