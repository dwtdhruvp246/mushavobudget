# AU01.04 — ordinary signup confirmation and return to sign-in

Stage 3/10 | FR.2/8 | Batch W/Z. Prepared 1 November 2026.
Source parent: d30f9e34100b533ec431dd528e6e31c463272f23. Evidence update: FRE294.

## Fixed scope and reused evidence

This is original AU01 case 4: correct ordinary-signup confirmation destination and intended identity. Earlier AU01.01–03 signup, pending-guidance and unconfirmed-sign-in observations are retained in [their owner receipt](security-fr-2-batch-w-owner-ordinary-signup.json). Do not repeat the browser seven/eight-character boundary or pre-confirmation wrong-password/sign-in checks.

The earlier ordinary confirmation link was consumed before the confirmation-return correction. [The recorded package/deployment receipt](security-fr-2-batch-w-owner-confirmation-package-and-deployment.json) therefore leaves current confirmation/return acceptance pending. A fresh ordinary signup supplies this missing observation. The just-completed Admin invitation is a separate flow; all eight AU02 groups keep their scoped passes and are not repeated.

Reviewed current signup.html, auth-flows.js and auth.html at the source parent. Signup calls Auth signUp with the same-origin confirm callback and uses isolated sessionStorage. The confirmation controller verifies the link/session identity, sanitizes link material, shows Email confirmed and Go to sign in, and locally signs out that isolated confirmation session before navigating to app.html?auth=manual. Source review is not hosted acceptance.

## One bounded owner browser sequence

Expected owner work: about 5–10 active minutes if delivery is prompt. Email delivery delay is not estimated; no hour-long wait or repeated dispatch is requested.

1. Delete only the completion-request blocking condition added for AU02.05 if it is still listed in that tab's DevTools.
2. Open one new Chrome Incognito window (Ctrl+Shift+N). Go to https://mushavo-budget-staging.pages.dev/signup.html.
3. Enter Full name **Batch W Confirmation**, an **unused inbox you control** privately, a private password/confirmation of at least 8 characters, and **USD selected/default USD**. Country may be left blank. Do not enter a plan or invitation URL. If no unused controlled inbox is available, report that prerequisite; do not reset/reuse a confirmed account or guess an alias.
4. Click **Sign up once**. Observe the pending-confirmation guidance and whether the email arrives. If a delivery/rate/error occurs, stop and return only its safe message; do not resend, sign up again or change settings.
5. Open the received confirmation link **once in the same Incognito window**. You may copy it from your inbox into that window's address bar. Keep the link private.
6. Observe **Email confirmed**, the correct verified recipient and a clean same-origin route such as auth.html?flow=confirm (the auth alias is also acceptable). The address bar must no longer contain access_token, refresh_token, token_hash or code link material. Report only clean yes/no, never the complete link.
7. Click **Go to sign in**. Confirm the sign-in form is displayed before entering credentials. Sign in once with that recipient's email and the password just chosen; expect the correct Free Personal workspace. An extra email-code step is not part of the owner's password-only policy; if it appears, report it and stop without requesting a code.
8. Retain this controlled account for following applicable checks. No data entry, paid plan, membership change or deletion is requested.

Return only:
- Pending-confirmation guidance appeared: yes/no
- Confirmation email received: yes/no
- Email confirmed and correct recipient displayed: yes/no
- Confirmation URL clean: yes/no
- Go to sign in showed the sign-in form before password entry: yes/no
- Password sign-in opened the correct Free Personal workspace: yes/no
- Any error: short safe message, or none

## Boundaries and remaining work

Maximum one ordinary signup submission, one email dispatch request, one confirmation-link opening and one manual password sign-in. Browser HTTP traffic is unmeasured. No Admin invitation/resend/recovery request, SQL, settings edit, frontend upload, token/Console paste or native work. No new public AU case. If the fresh flow fails, investigate the actual result rather than guessing at provider quotas or requesting another identity.

AU01.05 generic existing-email/resend/failure/rate scope remains separate and will be prepared using the resulting account/state where applicable. No deliberate quota hammering. Other W password/recovery/session and exact older Node-session cleanup carries remain open. Full W/V/FR.2/Stage3/release acceptance is not claimed; production/native unchanged, APK deferred.
