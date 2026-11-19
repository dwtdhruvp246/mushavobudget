# Batch W — confirmation succeeds, then return to sign in

**Stage 3/10 | FR.2/8 | Batch W/Z — source/local checks COMPLETE; real owner ZIP preparation and staging upload pending. V MFA ON HOLD.**

## Owner intent and accepted scope

The owner supplied two screenshots showing **Email confirmed**, the intended verified account and a second email-code/remember-device screen. One screenshot shows a code-delivery error. The owner wants the signup confirmation link to finish email confirmation, after which users go to sign in. In the explicit scope choice, the owner selected **Keep sign-in security (Recommended)**: the separate existing seven-day/new-device sign-in rule remains. [Decision/owner observations](security-fr-2-batch-w-confirmation-return-owner-decision.json).

The previous callback offered Continue to app, which invoked the application verification gate before adopting the link session. The corrected signup-confirmation callback does not offer adoption: it validates the Auth link, shows the verified email, and offers Go to sign in. It does not construct the email-code view or call its gateway. Go to sign in signs out only the isolated callback session and navigates to app.html?auth=manual. A failed isolated logout stays visible and can retry. Missing/expired/invalid material cannot show success. A legacy confirmation Continue event also returns to sign in without requesting application verification.

## Product/source changes

- auth-flows.js: confirmation-only branch and return-to-sign-in behavior; recovery, Business, password/device-management flows keep their existing proof requirements.
- auth.html: bump the page-module query from version3 to4 to load the corrected code.

The successful screen reads **Email confirmed**, **Your email has been confirmed. You can now sign in.**, the verified account and a primary **Go to sign in** button. Existing pending-signup/unconfirmed messages, eight-character minimum, config, Worker/DB guards and sign-in policy remain unchanged. The image edit is a preview only; the actual UI is implemented in source, not as a screenshot asset.

## Local validation

[Receipt](security-fr-2-batch-w-confirmation-local-checks.json): **55/55 PASS**, comprising40 existing controller/Auth tests,12 actual page-module tests and3 archive/CLI checks;6 syntax checks and19 source hashes verified. Node24.22.1, existing offline network preload, zero real Auth/mail/hosted requests. An earlier52-case run had one expired-link fixture timing failure; its injection now occurs before bootstrap and all55 final cases pass. Do not add the old52/44/74/public18 receipts to this count.

Archive tests use synthetic canonical44-entry data and actual CLI refusal; the real retained owner ZIP is not available here. Real Windows preparation and new deployment/served-UI acceptance remain pending. Historical manifests and receipt pins remain unchanged.

## Exact local ZIP preparation

Use the immutable publication commit and complete PowerShell command provided in chat. Fetch security/stage-3-authorization and export the exact commit to a new temporary directory with LF bytes. Preserve the original native checkout. The only possible prompt is a moved path to this existing input:

```text
C:\Users\HP\Desktop\Mushavo-W-Messages-abaee52a18604dcd9ea9357118670b44\mushavo-confirmation-copy-staging.zip
```

Required input SHA256:a6c5a3a3111b0a78af375a0ccf86f1bc7387e78b4a4b57adbada1efe04d8879d.

scripts/prepare-fr-2-batch-w-confirmation.mjs verifies19 sources, the exact retained hash and canonical44-entry archive, both old/new Auth-file hashes and preservation of42 other entries. It creates **mushavo-confirmation-signin-staging.zip** in a fresh empty Desktop output directory, verifies the rebuilt archive, and rechecks the original input before/after. No new dependency, key, password, code, private packet, mail, Auth/settings/mode/role/factor or provider operation is part of preparation.

If preparation exits1, return its safe result before upload. After exit0, upload the new ZIP once in Cloudflare Workers & Pages → existing mushavo-budget-staging → Create deployment. Choose Production within that staging project if asked. Inspect an uncertain outcome before any retry; no Supabase setting save is needed.

## Current confirmed account and next evidence

The current dedicated account already reached **Email confirmed** in the owner's screenshots. Its original link has been consumed; do not reuse it for a successful-confirmation check or resend to a confirmed account. The owner can leave the old code screen via Back to sign in. Normal new-device sign-in may still require its separate code under the retained policy; do not describe removal of the duplicate confirmation step as removal of that rule or opening of app access.

Return the preparation safe JSON/combined exit code and the new deployment URL. Subsequent exact-source/browser acceptance of the new confirmation path needs a fresh valid link for an explicitly selected unused controlled identity. Collect that prerequisite when needed; do not guess an alias, repeat signup for this confirmed account or change the test password. Earlier AU01.01–03 scoped positives and partial AU03.03 remain at their original sources; AU01.04 corrected destination/return behavior remains pending. No new acceptance requirement or batch letter is added.

Full W/FR.2/Stage3/release remain open. V MFA stays on hold; production/native unchanged and APK deferred. No server proof, role, AAL claim, release gate or source manifest is weakened to hide the code screen.
