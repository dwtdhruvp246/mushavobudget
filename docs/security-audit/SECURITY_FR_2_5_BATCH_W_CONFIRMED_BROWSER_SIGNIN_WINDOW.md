# Confirmed browser: bounded password sign-in test

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE234.

The owner answers yes to the expected signup confirmation trust message. The attachment shows the later `Verify your sign-in` screen with `Verification is unavailable. Try again.`, a compact checked trust control and the Check again/Send email code/Sign out buttons. It does not show identity, URL or the earlier confirmation result. Confirmation success is owner-reported; password sign-in without a code is not yet accepted.

Staging was left QUARANTINED by the successful upgrade. The unchanged application predicate checks both an active rollout and an unexpired actor-limited acceptance window. A trusted-cookie restore can therefore succeed internally while the page remains unavailable because final protected access is still blocked. This explains why the current source can produce the screenshot; the exact hosted HTTP failure is not independently known.

## Run one scoped test window

In the same Supabase staging SQL Editor for `dczlddwbtgvfdujgcitb`, use [the test-window SQL](../../supabase/candidates/security_fr_2_5_browser_trust_test_window.sql). Replace only `OWNER_CONTROLLED_FRESH_SIGNUP_EMAIL` with the exact address used for this fresh signup. The previously proposed Gmail alias is the intended scope in the chat handoff; its identity is checked by SQL, not inferred from the screenshot.

The SQL requires exactly one matching Auth identity, a confirmed active account and a current-version permanent unrevoked signup-link approval. It then calls the existing `mushavo_email_install.open_acceptance_window` for only that identity and only 1800 seconds. It creates no application proof, browser approval, schema object, role or credential, and leaves every guard and the bounded predicate unchanged. Missing approval/account/catalog prerequisites roll the transaction back. Repeating the call cannot silently extend an active window.

Expected result: `STAGING_BOUNDED_ACCEPTANCE_WINDOW_OPEN`, `allowed_actor_count: 1`, `maximum_seconds: 1800`, `saved_signup_browser_approval: true`, `application_proof_created_by_this_SQL: false`, and an expiry timestamp. This is controlled staging access, not a global resume or release activation.

If SQL returns an error, return that error/result. Do not request a code, change roles/settings, delete users or replay a consumed confirmation link to make the precheck pass.

After SQL succeeds, on the same browser profile and origin as the fresh confirmation, press **Check again** once. If the app opens, sign out normally and sign in once with the same alias and password. Expected: app access without another email code. Keep browser data/cookies. If unavailable persists, return the screen and whether it is on the canonical staging origin; do not send a code for this same-browser test. The SQL approval check does not itself prove this browser currently holds the cookie, so real browser behavior remains essential.

After the test, return the SQL result and the two browser outcomes. Protected access stops when the window expires, while browser approval remains saved. To close sooner in staging SQL Editor, use the existing quarantine controller:

```sql
BEGIN;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='QUARANTINE_STAGING_EMAIL';
SELECT mushavo_email_install.quarantine();
COMMIT;
```

Do not open another browser/code test yet; controlled recipient readiness and that separate case remain pending. Batch V Admin MFA stays on hold. No frontend/Worker upload, Auth setting save, package preparation or repeat of the earlier194 cases is required.

## Local validation scope

[Eleven cases](security-fr-2-batch-w-browser-window-local-checks.json) execute the actual backend/persistent-device component and exact existing bounded predicate/controller on local PostgreSQL with synthetic Auth/profile/control fixtures. They cover quarantine before opening; unknown/unconfirmed/missing/revoked/version-invalid approvals; direct API-role denial; a single actor/1800-second limit; retained proof/predicate/catalog; another proved actor remaining denied; repeated-open refusal; expiry and the original quarantine controller. [Nine source hashes](security-fr-2-batch-w-browser-window-source-manifest.json) pin the handoff/check inputs. No hosted SQL, Auth or email action was executed by the assistant. The previous194 local cases and public16 source cases remain at their original pins; they do not by themselves accept this browser flow. Full W/FR.2/Stage3/release and all findings remain open; production/native unchanged, APK deferred.
