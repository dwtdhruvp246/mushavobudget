# FR.3.3 account deletion checkpoint

**Stage 4/10 · FR.3/8 · FR.3.3 · Updated 16 November 2026**

| Scope | State | Evidence |
| --- | --- | --- |
| Authenticated deletion request, status and cancellation | Staging API passed | [Acceptance run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43755043392) on `00ef2bebd4091a0ca97866a868499fa4f3345858` |
| Account Settings browser and release | Published and verified on main staging | [Preview browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43828414596) and [main staging browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43828768624) used the hosted files. Main staging deployment is `eda0290a-50ac-479d-9b26-9e446ad5c18c`. |
| Business owner review | Hosted pass | The owner of retained Business test workspaces received `ownership_review`. No workspace ownership or membership was changed. |
| Family/Business transfer or closure, shared-data disposition | Pending owner decision | The API holds owner, member and staff requests. Historical membership is also considered when routing requests. |
| Account erasure, execution retry, Storage and provider cleanup | Pending | The installed workflow has no destructive executor. The policy and provider prerequisites below still apply. |

## Verified on staging

The migration is installed on Supabase project `dczlddwbtgvfdujgcitb`. The private request table has forced RLS and ordinary API roles have no direct access. Only the authenticated API role can call the three public functions. Request submission requires a server-verified password sign-in from the last ten minutes. A token refresh alone does not reset that window.

GitHub Actions verified anonymous denial, recent password submission, two concurrent submissions returning one identifier, the owner review hold, isolation from a second test account, repeatable cancellation, and denial after sign-out. Independent database readback found **zero active test requests, one cancelled test record and zero remaining test sessions**. The CI flow used the two established staging accounts and recorded no credentials or individual identities.

The candidate Chromium run verified that dismissing the confirmation submits no request, confirming shows an ownership review hold, the second account sees no request, reloading preserves the hold, and cancellation clears it in both the screen and the database. The two browser test sessions were logged out. Database readback across both runs found **zero active test requests, two cancelled test records and zero remaining test sessions**.

The 43-file staging archive contains 40 pinned web assets and three preserved Pages control files. Only `auth.html` and `auth-flows.js` differ from the verified FR.3.2 baseline. Archive SHA-256 is `c3e7e082c406fdd28941e16ef4733926e0fd4c1b633d1192b18290b632859983`. The user selected the archive in Cloudflare, which deployed preview `47f4d139-3cd1-43dc-99e4-ec0b060a7c68`. After the preview passed readback and browser checks, the same manifest and controls were published to the main staging URL. The earlier FR.3.2 staging deployment `78498daf-0020-47a3-96fc-7a96c72e7954` is the recorded rollback target.

Both hosted browser runs verified the exact Account Settings document, script and staging configuration by SHA-256. They also checked the existing Pages Worker and verified the complete request, reload and cancellation flow with two staging accounts. Independent database readback across all four staged request runs found **zero active requests, four cancelled test records and zero remaining test sessions**.

Local regression checks passed **52 of 52**, including the previous 46-case simulation and six tests of the actual request migration. The migration tests covered role grants, persistence and idempotency, cross-account isolation, stale password verification, ownership and membership precedence, and cancellation. The frontend passed JavaScript syntax checking.

## Requirements for actual erasure

1. Review the [proposed workspace and retention rules](SECURITY_FR_3_1_ACCOUNT_DELETION_DECISIONS_20261115.md), then adopt the [retention decisions](security-stage-4-retention-decisions.json) for identity, personal records, shared finance, invitations and support, telemetry and devices, Storage, processors and backups, and the completion record. Record the data disposition, any required retention period, access and responsible operator for each category.
2. Decide when a Family or Business owner can close a workspace and when ownership must pass to an eligible member. Confirm the disposition of shared finance, attachments and historical attribution when an owner or member leaves. The existing Business transfer feature can be evaluated for this workflow once that decision is recorded.
3. Use the approved decisions to implement and verify durable erasure execution with restart and retry, authoritative file cleanup, Auth session and account cleanup, and residual provider access. Test those effects with disposable identities and known synthetic files. Verify that completion and retained records are reported accurately before offering erasure to users.

This checkpoint covers request intake, status, cancellation and the published staging Account Settings workflow. **FR.3.3 remains open.** No account was erased. Production was outside the execution scope.
