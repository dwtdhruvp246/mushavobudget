# Business invitation email and Notifications setup

Updated 7 October 2026. **4.9.40 is merged into main** through [PR #90](https://github.com/dwtdhruvp246/mushavobudget/pull/90), commit `464f52c39ff56cc57bf8dfd2b0e35bd3d51a4436`. The owner reports all eight notification SQL checks PASS, the revised notification UI working and sending working after correcting the SMTP host. E27/E28 in the audit record retain the evidence and its limits. APK updating remains deferred.

The earlier missing Accept/Decline and broken Open report came while sampled public code was still 4.9.39. After merge, the 6 October public recheck identified 4.9.40 and matching response/navigation source; the owner then said “now working”. All six merged-commit checks, including Workers Builds and GitHub deployment/release verification, are successful when re-read 7 October. The independent 7 October public source recheck is unavailable; this is not evidence of a new outage.

Hosted template save/rendering and the current redirect allowlist are **not confirmed** by the general working statements. The full email architecture is a later Stage 6 proposal; no new Send Email Hook, application mailer or queue is activated by this guide.

## Current behavior and scope

- A server trigger creates one recipient notification when a Business invitation is reserved, including inviter, Business name and role, even if email delivery fails. Existing unexpired pending requests are backfilled.
- Pending notifications display Accept/Decline. The existing protected `respond_business_invitation` RPC decides membership; acceptance opens the server-returned workspace and decline stays in Notifications.
- Resend and role changes update the same notification. Accepted, rejected, cancelled and expired requests have no actionable link. Client writes cannot forge Business invitation metadata; Mark read remains available.
- Notification/invitation events refresh the list and badge. Source and fixtures cover this; the owner's general working report does not establish every live websocket/reconnect case.
- Existing-account invitations use Supabase Magic Link; first-account invitations use Invite User. Prepared conditional subject/body files identify a Business workspace invitation while preserving ordinary sign-in/Admin setup wording and `{{ .ConfirmationURL }}`. Repository templates do not save themselves into Supabase.

## SMTP outcome

The owner first reported custom SMTP disabled/template editing blocked, then a Business email request timing out. The supplied Auth log showed `/otp` HTTP 504, `request_timeout`, `context deadline exceeded`. A repeated Create returned `INVITATION_ALREADY_PENDING`. The owner subsequently corrected the host and reported sending working. Do not repeat the SQL migration or create a duplicate invitation to repair an SMTP failure; use **Resend** on an existing pending request.

Zoho CPaaS displayed a verified transactional domain/DKIM/return path. Its `cpaas.zoho.com` API host is distinct from the SMTP server `smtp.zeptomail.com` shown in the owner's agent settings. The existing working relay should not be changed by this documentation update. Credentials belong directly in provider/Supabase settings, never in chat or the repository. See [Zoho SMTP](https://www.zoho.com/cpaas/help/smtp-home.html) and [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Record normal sending as owner-PASS. Saved SMTP values, hosted templates, provider capacity/restrictions and delivery across signup, recovery, Admin and Business flows still need their own evidence. The earlier June 2026 template-editor restriction explains the reported disabled-relay blocker; project plan/date were not independently verified. No provider settings are changed by this guide.

## Remaining hosted template and redirect checks

These are the existing prepared template option. Confirm their current state before making a change; do not enable the proposed future email hook during Stage 0.

Use the owner's agreed fetch → copy → manual paste method. It changes neither the original Windows checkout nor Supabase automatically:

```powershell
Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
```

1. Review **Authentication → URL Configuration**. Keep the production Site URL `https://mushavobudget.com` and existing signup callback. Check whether the intended Business callback entry is already saved:

   ```text
   https://mushavobudget.com/business.html?invitation=*#business/team
   ```

   The prepared templates derive the Business prefix from Site URL, without a trailing slash. Do not broaden the allowlist to unrelated domains. A saved-setting screenshot and a correct fresh email destination are separate evidence.

2. If the current email wording is still generic and the owner chooses to activate the prepared option, use **Authentication → Emails → Magic Link** for its subject/body and **Invite User** for its subject/body. Preserve any existing ordinary/Admin custom content inside the `{{ else }}` branch. Leave Confirm Signup/Reset Password templates in place; keep the supplied confirmation URL.

   ```powershell
   git show "FETCH_HEAD:supabase/templates/magic-link.subject.txt" | Out-String | Set-Clipboard
   git show "FETCH_HEAD:supabase/templates/magic-link.html" | Out-String | Set-Clipboard
   git show "FETCH_HEAD:supabase/templates/invite-user.subject.txt" | Out-String | Set-Clipboard
   git show "FETCH_HEAD:supabase/templates/invite-user.html" | Out-String | Set-Clipboard
   ```

   Run one line, paste into its matching field, then continue. These commands only replace the clipboard. If editing remains blocked, report that state; do not replace the working relay with placeholders.

3. With owned test inboxes, check a fresh Business email identifies the purpose, opens the correct account/request and still requires Accept to join. Check an ordinary signup confirmation and Admin-created setup invitation retain their normal purpose. Record results or redacted subject/body screenshots; exclude full links/tokens. Full email-type routing and a shared application mailer remain Stage 6 work.

## SQL handoff for an environment not yet migrated

The production owner already reports all eight SQL checks PASS. **No repeated SQL run is requested now.** For a newly prepared isolated environment, use the same main fetch above, then copy and manually run each file separately in its intended Supabase SQL Editor:

```powershell
git show "FETCH_HEAD:supabase/migrations/20261006180000_business_invitation_notifications.sql" | Out-String | Set-Clipboard
```

The migration normally reports `Success. No rows returned`. Then copy the diagnostic separately:

```powershell
git show "FETCH_HEAD:supabase/diagnostics/business_invitation_notifications_diagnostic.sql" | Out-String | Set-Clipboard
```

Expect eight PASS rows at metadata/invariant scope. Do not treat this as a live action/authorization matrix.

## Remaining controlled behavior checks

Normal revised notification UI is owner-PASS. Record individual cases only when actually tested, using owned synthetic accounts: correct Business/role, Accept without premature membership, Decline, cancellation, one notification after resend, removed controls after resolution, replay denial, unrelated-user denial and live refresh/reconnect. Keep these wider authorization/event cases in Stages 3/8/9 after staging is isolated. Do not infer the entire matrix from “now working”.

If a stale frontend is reported again, inspect the served release/control markers and the actual client/PWA cache before changing SQL. The deferred APK can still contain older bundled assets and requires its own later rebuild. Do not reset the original Windows project or signing identity.

## Validation and limits

The candidate's full automated suite passed **406/406**; 18 targeted invitation/refresh checks passed after the initial old-source report. Actual migration/RPC/policy source passed disposable PostgreSQL checks for backfill/idempotency, RLS/metadata protection, failed email, resend, no premature membership, acceptance/replay, decline, cancellation and expiry. Surrounding permission/billing helpers were substitutes in the focused fixture; the separate full custom-role verifier passed. Locked asset/dependency consumer checks passed without APK compilation/device tests. These historical checks are retained; this documentation-only reconciliation does not rerun or expand them.

Official hosted instructions: [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls). Continue with [the Stage 0 closure checklist](SECURITY_STAGE_0_CLOSURE_CHECKLIST.md).
