# Resume Family proof live acceptance

The staging policy fix is installed as migration `20261107085131_family_payment_proof_path_binding`. Do not reapply it. The current staging catalog is `4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7`, and the corrected policy fingerprint under `search_path=pg_catalog` is `5ef836d2e7dca19c3e65ad9aec5749c2`.

The genuine account-suspension and Business request/bill/payment packs are completed at their recorded scopes (FRE315/FRE316). Keep their workflows archived and do not repeat them. Main Stage 3 and the wider launch remain open.

1. Verify branch `security/stage-3-authorization`, staging project `dczlddwbtgvfdujgcitb`, current catalog and absence of the exact synthetic Family. The last confirmed state has zero Family/workspace fixture rows, setup/CI sessions, physical files and queued messages.
2. Execute the frozen `supabase/diagnostics/security_fr_2_6_family_proof_fixture_create.sql` only after Supabase's fresh execution confirmation is approved. Both previous prompts expired before execution. Broad task access has already been granted; this is a provider confirmation for the exact write. No fresh credentials are needed.
3. Parse the returned `safe_result.family_id`. The setup uses only A/B, creates one empty synthetic Family and a one-hour fixture entitlement, and removes its own modeled preflight session before committing. It is not acceptance of Family signup, invitation or purchase provisioning.
4. Create a fresh enabled `scripts/ci/staging-run.json` with scope `family-proof-path-binding`, exact staging project, fixture name `audit-family-proof-policy-20261107`, that returned Family ID, and these exact cases: `X_FAMILY_PROOF_OWNER_MEMBER`, `X_FAMILY_PROOF_PATH_DENIALS`, `X_FAMILY_PROOF_REMOVAL`, `X_FAMILY_PROOF_CLEANUP`. Pin its source parent, use a fresh run ID and retain attempt-1-only execution. Publish with compare-and-swap; do not reactivate an older run plan.
5. The prepared workflow uses existing A/B/Admin GitHub secrets and no browser. It tests ordinary uploads, forged/anonymous/removed access and exact Storage cleanup, then Owner deletion of the empty synthetic Family. The safe receipt records only generated cleanup paths. All newly created sessions must locally log out.
6. Inspect the real safe JSON and independently verify no exact synthetic Family/workspace, setup/CI session, file or queued item remains. Retain the two original manual Family conversions and their SHA-256 `d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3`.
7. If Storage cleanup fails, retain the Family and use the Storage API with the exact recorded synthetic paths. Never delete Storage metadata with SQL. The frozen compensating Family cleanup SQL refuses any Family with files, payment records/items or an Admin grant. Do not label compensation as HTTP acceptance.
8. Record the actual result and archive the enabled run plan. A prepared runner or local PostgreSQL pass is not a hosted HTTP pass.

The separate third ordinary Business identity, expired-entitlement HTTP case, independent queue-overlap connection and owner-deferred SMTP/recovery remain open. Do not label all stages complete.
