# Batch B complete — staging configuration installation next

22 October 2026, FRE119. [Owner result](security-fr-2-email-edge-batch-b-owner-pass.json) supplies offline 12/12 on Node 22.17.0 and a Windows completion receipt, both exit codes 0. It confirms the new public push key, 43 other files byte-identical, independent .NET readback and unchanged encrypted packet. New ZIP SHA256 is `867296b5e71747a15d46c7ed8937484558ea9fcac97cd96c66ddf5dc00c8b9da`. No hosted requests or deployment occurred. [Batch C](SECURITY_FR_2_4_BATCH_C_HANDOFF.md) prepares the six-value staging configuration installation. Earlier handoff follows.

---

# Batch B: frontend key alignment and rollout candidate preparation

22 October 2026, FRE118. **Batch A is complete at its local preparation scope.** The owner receipt reports 25 source hashes, generated and validated staging VAPID keys, six configured values, and Windows CurrentUser DPAPI save with exact readback, exit 0. Its separate offline verifier JSON was not supplied; no owner test total is inferred. CurrencyAPI provider validity remains unverified.

The accepted frontend ZIP has an empty push key. Batch B resolves the local frontend candidate mismatch while preserving the accepted Worker and all other assets. It performs no provider request, deployment, installation or activation. No new credentials, email address or password are requested.

| Work combined | Verification |
| --- | --- |
| Reuse Batch A configuration | Read and decrypt only the selected `edge-configuration-batchA-<guid>.dpapi` file. Validate its exact purpose, staging target, six variables, key pairing and unapproved hosted flags. Compare encrypted bytes unchanged afterward. |
| Prepare frontend ZIP | Require the accepted 44-file ZIP and Worker identities. Write the candidate's public VAPID key into a new `config.js`; retain the staging URL and publishable key. Require every other file byte-identical. |
| Independent Windows readback | Read the old and new archives through .NET, require 44 entries, compare 43 other file hashes, and verify the new frontend key matches the private candidate. Neither archive is executed or extracted. |
| Record rollout prerequisites | Write a public checklist with candidate identities, configuration names and remaining hosted checks. Retain all nine original immutable Edge readiness assertions as false; local pairing does not prove provider readiness. |

The parent first verifies 91 source files and the private pipe. It looks only in `%LOCALAPPDATA%\MushavoBudget\PrivateStaging` for the exact Batch A filename pattern. If exactly one file exists, it selects it automatically. It does not choose the newest file if several exist. If none or multiple exist, the only prompt asks for the **full path printed after successful Batch A**. It displays the expected folder and matching paths, without decrypting them. The optional `PacketPath` parameter can supply the same explicit choice.

The default accepted ZIP is `C:\Users\HP\AppData\Local\Temp\mushavo-email-modern-review-365a33690028462489520db3e85c4b90\mushavo-email-modern-review.zip`. An explicit `AcceptedZIP` parameter can change its location, but its required SHA256 stays `cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24`. Worker identity stays `a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651`; the unchanged Edge package identity stays `e1fb82c6001ee4bb8f3d6999f078a028637cf90d912e275fb14ac84774f192a3`.

Outputs are new files under the isolated snapshot's `batch-b-frontend` directory: `mushavo-email-push-review.zip` and `rollout-checklist.json`. Existing output is refused. The original ZIP, Batch A packet and repository runtime source are preserved. Public output includes only the VAPID public key from the private environment; the push private key, CurrencyAPI key and caller secret are explicitly checked absent. Contact addresses and private values are excluded from the receipt and checklist. Plaintext exists transiently in the owner processes/private pipe; forensic erasure of managed strings is not claimed.

Local verification passes **12/12** cases with three JavaScript syntax checks. Actual module tests use real synthetic key pairs and canonical 44-entry ZIPs. Real-owner ZIP/private packet access is not performed locally. The verifier's expected ZIP/Worker overrides exist only as module test options; the CLI has no override input. Windows parsing, DPAPI access and independent archive readback for this new runner remain owner-pending.

The runner prints `BATCH B STARTED`, the new ZIP path on success, `BEGIN SAFE BATCH B RESULT` JSON, and `BATCH B COMPLETE` or a local-review stop. Exit 0 completes this local preparation; exit 1 requires returning the safe result before retrying. Return both offline and owner-safe JSON outputs with exit codes. Keep the prepared ZIP for the coordinated staging deployment; this run provides no upload instruction.

Remaining hosted work is explicit in the checklist: fresh target/catalog/function/configuration baselines; CurrencyAPI credential acceptance; scheduler/external callers; Pages/limiter metadata and bindings; canonical database integration; coordinated deployment and quarantined activation; genuine hosted authorization, email and recovery tests. The checklist is not fresh target evidence. Findings, readiness, live activation and hosted acceptance remain open/unapproved; production/native unchanged and APK deferred.
