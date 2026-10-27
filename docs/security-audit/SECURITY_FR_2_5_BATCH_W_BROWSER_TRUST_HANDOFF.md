# Persistent browser trust staging handoff

Stage 3/10 | FR.2/8 | Batch W/Z. Source and offline checks are complete; hosted installation and acceptance are pending. Batch V Admin MFA remains on hold. Production/native and APK work are excluded.

The previous correction removed the code component from the confirmation page, but retained the separate sign-in/device rule. This update changes that rule on the server as well as in the browser.

The browser/profile that validates a fresh signup confirmation link is automatically enrolled, then returns to email/password sign-in. Another browser verifies one email code and is trusted by default. Server approvals have no application expiry. Revocation, password/security changes, suspension, browser credential loss and the shared-browser opt-out still require verification. A browser cookie is capped at 400 days and renewed on a successful trusted restore; browser storage cannot be guaranteed forever.

The two previously confirmed test identities have consumed their links. They cannot retroactively obtain proof of the browser that opened those links. Once the upgrade is installed, an existing account may need one code to enroll that browser. Do not reset either account or reuse a consumed link to test fresh signup auto-trust.

## Scope and evidence

- [Owner policy](security-fr-2-batch-w-browser-trust-owner-policy.json).
- [Local result](security-fr-2-batch-w-browser-trust-local-checks.json): 194/194 targeted tests, zero failures/skips; nine syntax checks; 48 source hashes; reproducible esbuild 0.28.2 Worker. The limiter bundle is unchanged.
- Thirteen local PostgreSQL component cases cover signup enrollment, unknown browsers, long-lived approval, one-use codes, revocation, direct-call denial and resets before/after initial enrollment. Ten guarded-upgrade cases cover rollback, catalog drift, bounded predicate integrity and quarantine. Application RPC/policy counts in the upgrade fixture are explicitly modeled; no live catalog acceptance is inferred.
- [Current manifest](security-fr-2-batch-w-browser-trust-source-manifest.json) supersedes execution of older preparers against current sources. Historical manifests/receipts remain pinned and are not rewritten. The older copy/confirmation CLI tests now check that those CLIs reject newer source instead of emitting a stale package; the new seven-entry package tests cover the current preservation contract.

## Preparation and installation order

Use the published source commit supplied with this handoff. The preparation entry is `scripts/prepare-fr-2-batch-w-browser-trust.mjs`. It requires only existing Node and the exact retained owner ZIP; no npm install, new credentials, MFA operation or checkout replacement.

Input: `C:\Users\HP\Desktop\Mushavo-W-Confirmation-1880e6889451444cb13c99bbf5974957\mushavo-confirmation-signin-staging.zip`, SHA256 `ccc7ce4c5425fb88570fec7d931eba00a9dc71d50ded1968ad764e314949a6eb`.

The output is a new directory with:

1. `mushavo-trusted-browser-staging.zip`, a canonical 44-entry public ZIP. Exactly seven entries change: `auth-flows.js`, `auth.html`, `auth-security.js`, `email-verification.js`, `session-entry.js`, `styles.css`, `_worker.js`. Thirty-seven entries, including config, service worker, headers, routes, previous short messages in app.js and public push configuration, are preserved byte for byte. The input ZIP is unchanged.
2. `install-trusted-browser-staging.sql`, a private sidecar; never upload SQL in the public ZIP.
3. `browser-trust-package.json`, the local package receipt, including every public entry hash for independent Windows/.NET readback.

After preparation and Windows/.NET readback pass:

1. In Supabase SQL Editor, independently select staging project `dczlddwbtgvfdujgcitb`. Paste the generated SQL. Its first transaction checks the installed catalog, quarantines access with the existing controller and closes any bounded acceptance row. Its separate upgrade transaction applies the browser policy atomically, preserving the exact bounded session predicate, installer functions, all 148 existing RPC guards and 82 restrictive policies. It refreshes the legitimate catalog identity and reloads the RPC schema. A failed upgrade leaves the already committed maintenance boundary quarantined.
2. The final SQL result must be `PERSISTENT_BROWSER_TRUST_INSTALLED_QUARANTINED`, with `catalog_identity_matched: true`, `guarded_RPCs: 148`, `restrictive_policies: 82`, `application_access_opened: false`. If it errors, return the error/result; do not repeat account/link actions or publish mismatched files.
3. After SQL succeeds, upload only the new `mushavo-trusted-browser-staging.zip` to the existing **mushavo-budget-staging** Pages project using the same staging direct-upload channel as the accepted package. Keep its bindings/secrets/settings. This includes the coordinated Worker update; a frontend-only upload does not implement the policy.
4. Return the preparation receipt, final SQL result and deployment URL/provider success. Staging remains quarantined. Do not start normal sign-in/confirmation testing yet: the existing bounded acceptance controller must open a short window for the intended controlled identities before protected app access can pass. No global resume is included here.

The next bounded browser acceptance should check a fresh signup/link on browser A, password sign-in on A without a code, password sign-in on browser B with one code, then later sign-in on B without another code. Existing-account enrollment can be checked separately with one code. Clear-data/revocation/reset cases must still require verification. Fresh confirmation needs a new owner-controlled inbox; do not invent an alias or recreate existing accounts.

If an installation/upload is uncertain, preserve the output and return its receipt. Keep staging quarantined using its existing controller while inspecting the result. Do not roll back by restoring password-only application access, reversing security-version counters, reviving revoked approvals or rerunning an old preparer against current sources.

No new hosted source status, email dispatch, SQL install, frontend deployment, bounded acceptance window, finding closure or release approval is claimed by this handoff.
