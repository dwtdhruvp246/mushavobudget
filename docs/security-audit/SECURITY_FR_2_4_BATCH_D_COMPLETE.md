# Batch D complete: four staging Edge functions deployed

22 October 2026, FRE124. The [owner's successful resume](security-fr-2-email-edge-batch-d-resume-owner-pass.json), checked at `2026-10-22T09:23:42.482Z`, reports 32 hosted requests, three deployment POSTs accepted with HTTP 201, certain write outcomes, completion and exit 0. The previous `invite-admin-user` deployment was verified and retained without redeployment. Offline verification passed the same 20 cases on owner Node 22.17.0 with 46 source hashes and three syntax checks; this is a Windows reproduction, not 20 additional distinct cases. New Windows parent execution is now owner-observed.

| Selected staging function | Version | Exact source files compared | Missing-credentials response |
| --- | --- | --- | --- |
| invite-admin-user | 1 | 2 | HTTP 401 |
| invite-business-member | 1 | 2 | HTTP 401 |
| send-test-push | 1 | 4 | HTTP 401 |
| sync-exchange-rates | 1 | 3 | HTTP 401 |

All selected metadata and provider bundle hashes matched independent readback; source bytes matched exactly; detail snapshots were stable around source reads. Expected JWT settings matched true/true/false/false respectively. The sole unrelated contact function's selected metadata and exact pinned artifacts were preserved through the final checks. The four observed ID hashes, versions and bundle hashes are retained in the owner receipt and the canonical progress file for subsequent identity checks. This snapshot is not a provider write lock.

The earlier HTTP 403 and the partial one-function run remain preserved as separate evidence. No exact cause of the original 403 or exact differing error-JSON field is inferred from the successful resume. The historical receipts and source manifests remain unchanged. The original deployment and one-installed resume commands have completed their purpose; they must not be reused to update these now-present routes.

This completes the **selected staging Edge deployment, source-readback and unauthenticated HTTP-denial checkpoint**. The HTTP observations do not prove signed JWT acceptance, authenticated user authorization, service access, secret equality, full environment/runtime impact or provider bundle/dependency equivalence. No email, push or FX was dispatched; no SQL, Auth, secret-write or scheduler endpoint was used in this batch. No application rows were read. The assistant did not access owner credentials or perform the hosted requests.

## Remaining rollout dependency, checked against source

The next implementation step is **FR.2.4.E5.18 canonical database registration integration**. The [staging activation/recovery candidate](SECURITY_FR_2_4_STAGING_ACTIVATION_RECOVERY_CANDIDATE.md) already passed 70/70 on owner Windows, but its contract still records `candidate_canonical_integration_complete:false`. The normal 55 ordered migrations continue to register only the original offline installer. Applying that registration and then the candidate would conflict with the expected namespace state. The next change must provide one reviewed registration path, preserve the earlier source/evidence, and verify installation/quarantine/recovery through that actual path. No hosted SQL handoff is justified by the completed Edge batch alone.

After that integration, the coordinated rollout must establish a fresh independently selected privileged staging database connection and reviewed catalog baseline, current Pages deployment/bindings and the prepared frontend ZIP, scheduler/external caller state, compiled gateway/Edge-to-control behavior, quarantined database installation and recovery. Actual PostgreSQL concurrency, authenticated sessions, browser flows, email delivery, controlled push and FX tests remain outstanding. The original candidate's project GUC is still an operator acknowledgement rather than independent connection attestation.

The prepared frontend push-key ZIP is still a local candidate: `867296b5e71747a15d46c7ed8937484558ea9fcac97cd96c66ddf5dc00c8b9da`. Its publication and live serving/key verification are not claimed by this receipt. Existing configuration installations are retained, not repeated. No new owner input or command is required to record this completed checkpoint; the next executable handoff must explain its scope and prompts in advance.

No full finding is closed. Live activation and full hosted acceptance remain unapproved. Production/native unchanged, APK deferred, and Google Play/Apple App Store release acceptance remains pending. This milestone is not a measured overall launch-completion percentage.
