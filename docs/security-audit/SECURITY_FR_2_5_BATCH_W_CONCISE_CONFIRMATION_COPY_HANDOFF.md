# Batch W — ordinary signup result and concise confirmation messages

**Stage 3/10 | FR.2/8 | Batch W/Z — source/local checks COMPLETE; owner ZIP preparation and staging upload pending; V MFA ON HOLD.**

## Accepted owner observations

On 27 October 2026 the owner reports that seven characters were rejected in the signup form, exactly eight were accepted, a confirmation email was received and unconfirmed sign-in was denied. Two screenshots show the pending and unconfirmed messages. The confirmation link remains unopened. [Safe receipt](security-fr-2-batch-w-owner-ordinary-signup.json) omits the mailbox address, passwords and link. Manual actions have exit_code:null; browser request and actual dispatch totals were not measured.

AU01.01–03 receive owner-reported scoped positive evidence at the prior served version. AU03.03 remains partial: seven-character rejection was a browser-form observation, not a direct Auth-server boundary request. Actual link destination, expiry/replay, separate application email-code proof/access, recovery, recent-login, resend/rate and wider session cases remain pending. No Admin invitation case is unblocked; V waits for the owner's phone-ready message.

## Two product changes

| Trigger | Revised message |
| --- | --- |
| Pending ordinary signup | Check your inbox to confirm your email, then sign in. |
| Auth email_not_confirmed error | Confirm your email before signing in. |

Only one string literal in app.js and one in auth-security.js change. Pending-signup wording stays generic and does not assert that an account was created or a message dispatched. Existing pending handling, sign-in denial, eight-character minimum, callbacks, session isolation, rate handling and visible Resend confirmation button are retained. No password, factor, role, setting, deployment or acceptance-window change is performed by the source update.

## Validation

[Local result](security-fr-2-batch-w-copy-local-checks.json): **44/44 PASS**, comprising40 existing Auth/controller regressions and4 public-ZIP preservation/invalid-input checks, with4 syntax checks and15 source identities verified on Node24.22.1. Existing offline network preload is active. The archive tests use a synthetic44-entry canonical ZIP and exercise the actual CLI refusing an unrecognized retained archive without output writes. The real owner ZIP is unavailable to the assistant, so successful real ZIP preparation and Windows execution are not claimed.

Historical source manifests, receipts, Windows74 and public18 retain their original pins and scopes. Do not rerun the old public reader against newly changed bytes; its expected Auth source hash is historical. This copy update adds no AU requirement or lettered batch and closes no original finding.

## Exact owner preparation

Use the immutable publication commit supplied in the accompanying complete PowerShell chat command. Fetch the existing security/stage-3-authorization branch, verify that commit is its ancestor, and export it with LF bytes to a fresh temporary source directory. Do not merge/reset the original native checkout.

Run scripts/prepare-fr-2-batch-w-copy.mjs with the absolute retained ZIP path and a new empty output directory. The script verifies15 source hashes, the retained archive's exact SHA256 and canonical44-entry structure, patches exactly2 reviewed strings, checks both resulting source hashes and preserves42 entries byte-for-byte. It verifies the rebuilt archive and rechecks the original input before/after writing a new file with exclusive-create semantics.

Retained input:

```text
C:\Users\HP\Desktop\Mushavo-W-Password-8-7dffbe2c15624168a4c4158266a9460f\mushavo-password-eight-staging.zip
```

Required input SHA256:3255992abbc6058afa2e74f804cc19b3d9337d2380db52d52b82d0363454218b. Only if that default path is absent, one nonsecret prompt asks for its moved path. No installation, token, password, code, private credential packet or mail operation is needed. The builder prints a safe JSON receipt and creates **mushavo-confirmation-copy-staging.zip** in the fresh Desktop output folder. Original ZIP/configuration/Worker/service-worker/headers/routes remain intact.

If preparation exits1, return its safe result before any upload. Do not substitute another ZIP, guess keys or retry a provider operation.

## Staging upload and next check

After preparation exits0, use the existing Cloudflare dashboard session: Workers & Pages → mushavo-budget-staging → Create deployment → select the newly created ZIP. Choose Production within the existing mushavo-budget-staging project when asked, so the canonical staging domain updates. Deploy once. If the outcome is uncertain, inspect current provider state before another upload.

Return the preparation safe JSON/combined exit code and the new deployment URL/success status. No Supabase setting Save, sign-up repeat, password change, confirmation resend or acceptance-window change is requested. Keep the dedicated account unconfirmed and its original email link unopened until the next bounded confirmation handoff. Later readback will compare the2 new source hashes; actual confirmation/recovery tests continue after that. Existing access may require normal provider browser login/MFA if expired; credentials stay in the provider browser.

Full W, FR.2, Stage3 and release remain open. V MFA stays ON HOLD. Production/native unchanged; APK deferred. No code or deployment action is a release approval.
