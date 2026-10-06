# Business invitation email and Notifications setup

Prepared 6 October 2026. Web/PWA candidate: **4.9.40**, on `security/stage-0-baseline`; APK update remains deferred. The owner reports all **8 notification SQL diagnostic rows PASS**, then reports custom SMTP disabled and hosted template editing blocked. Hosted template/redirect/website activation and revised UI checks remain pending.

The owner passed the registered Viewer invitation test but reported two gaps: the email says “Your sign-in link”, and the request is missing from the main Notifications page. The screenshot contains the default Supabase Magic Link template. Existing-account invitations use Magic Link; first-account invitations use Invite User. Their wording is configured in Supabase rather than in website JavaScript.

## Prepared behavior

- A server trigger creates one recipient notification as soon as a Business invitation is reserved, even if email delivery fails. It includes inviter, Business name and role. Existing unexpired pending Business requests are backfilled.
- Notifications display Business context and Accept/Decline before membership exists. Acceptance calls the existing protected `respond_business_invitation` RPC, then opens the workspace returned by the server. Decline stays in Notifications.
- Resend and role changes update the same notification. Accepted, rejected, cancelled and expired invitations have no actionable link. Direct client writes cannot forge or change Business invitation notification metadata; Mark read remains available.
- Recipient notifications and invitation events refresh the main notification list and badge without requiring a page reload. Reconnection and app resume retain the existing refresh behavior.
- Conditional email templates say **Invitation to join a Business workspace | Mushavo Budget** with a **Review Business invitation** button for the Business callback. Ordinary Magic Link and Admin Invite User emails retain their respective sign-in/setup wording and confirmation link. Email navigation signs the user in; joining still requires Accept.

No invitation delivery Edge Function change is needed. No email provider credentials are requested. These source changes do not save hosted email templates or apply SQL by themselves.

## SMTP prerequisite for the email wording

The owner reports **Enable custom SMTP** is off and the template editor cannot be changed. Keep the template-saving step pending until a real sending service is ready. Supabase's [3 June 2026 change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) restricts template customization for new Free projects using its default email service. Earlier Free projects and paid plans are exempt; this project's creation date and plan have not been independently verified. The reported dashboard lock is consistent with the restriction, not evidence that SQL or the prepared templates failed.

Configure a verified transactional email sender before saving custom SMTP. Obtain the actual host, port, username, password and authorized From address from that provider; enter credentials directly in Supabase, never in chat, screenshots or the repository. Retain Confirm email. Saving the relay changes delivery for Auth emails, so recheck ordinary signup confirmation, recovery, Admin invitations and Business invitations after setup. See [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Default-service test delivery does not establish production recipient coverage or capacity.

The earlier provider choice was Zoho Mail Lite with `notifications@` for automated app emails, but purchase, domain verification and SMTP readiness are unconfirmed. [Zoho Mail's current usage policy](https://www.zoho.com/mail/help/usage-policy.html) excludes automated and transactional sending through the mailbox service and directs that use to ZeptoMail. Use a transactional relay such as the previously discussed Resend or Zoho's transactional service; confirm which service is actually available before prescribing account-specific settings. No provider purchase or switch is performed by this guide.

The in-app notification work can be checked separately after the reviewed 4.9.40 website is activated, using a registered recipient already signed in. SMTP is required for this blocked email-customization step, not for the database trigger or the new Notifications controls. Keep email wording/rendering/delivery open until the hosted templates are saved and tested.

## Activate in the controlled audit environment

Use the owner's agreed fetch → copy → paste method. This does not require changing branches, merging or modifying the original Windows checkout.

```powershell
Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
git fetch origin security/stage-0-baseline
```

1. Copy the migration, paste into the intended Supabase project's SQL Editor and run. Expect `Success. No rows returned`.

   ```powershell
   git show "FETCH_HEAD:supabase/migrations/20261006180000_business_invitation_notifications.sql" | Out-String | Set-Clipboard
   ```

2. Copy the diagnostic, paste into SQL Editor and run separately. All 8 rows should PASS; the owner has reported that result. These metadata/invariant checks do not prove real delivery or websocket behavior.

   ```powershell
   git show "FETCH_HEAD:supabase/diagnostics/business_invitation_notifications_diagnostic.sql" | Out-String | Set-Clipboard
   ```

3. In **Authentication → URL Configuration → Redirect URLs**, retain the existing signup entry and add:

   ```text
   https://mushavobudget.com/business.html?invitation=*#business/team
   ```

   The current production Site URL is `https://mushavobudget.com` without a trailing slash. The template matches the Business callback prefix derived from that Site URL. Do not broaden the redirect list to unrelated domains. This prepares the existing callback; the owner must recheck the actual email destination after saving.
4. **Blocked while the owner's editor requires custom SMTP.** Complete the SMTP prerequisite above before this step; do not save empty or placeholder relay settings. Then in **Authentication → Emails → Magic Link**, save `supabase/templates/magic-link.subject.txt` as Subject and `supabase/templates/magic-link.html` as Body. Repeat under **Invite User** using `invite-user.subject.txt` and `invite-user.html`. Leave Confirm Signup and Reset Password templates in place. If the current non-Business template has custom content, preserve it inside the `{{ else }}` branch before saving. Use the supplied `{{ .ConfirmationURL }}` link.

   ```powershell
   git show "FETCH_HEAD:supabase/templates/magic-link.subject.txt" | Out-String | Set-Clipboard
   git show "FETCH_HEAD:supabase/templates/magic-link.html" | Out-String | Set-Clipboard
   git show "FETCH_HEAD:supabase/templates/invite-user.subject.txt" | Out-String | Set-Clipboard
   git show "FETCH_HEAD:supabase/templates/invite-user.html" | Out-String | Set-Clipboard
   ```

   Run one line, paste into the matching field, then continue. These commands overwrite only the clipboard. They do not update Supabase automatically.
5. Publish/activate the reviewed **4.9.40** website through the existing release process before testing its new controls. This can be reviewed independently of the SMTP/template step. Updating the audit branch is not production promotion; review the draft PR separately.

Hosted project instructions: [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls). Go `if`, `and`, `len`, `ge`, `eq`, `slice` and `print` are used; no unsupported custom template function is needed. The Business prefix check uses short-circuit `and` to avoid slicing a shorter/empty redirect. Real hosted template rendering and delivery remain owner checks.

## Owner recheck

1. Keep the registered recipient signed in with its Notifications page open. From the Business owner account, invite that recipient as Viewer. The request and badge should appear without reloading; check Business name and role.
2. Check the fresh email subject/body and **Review Business invitation** button. Open it in a private window, verify the correct identity/request, and decline or accept deliberately.
3. For an in-app acceptance check, use another owned registered non-member or re-invite a declined recipient. Accept from Notifications; verify the correct Business workspace and Viewer role. An existing member cannot be invited again.
4. Check Decline, owner cancellation, and resend on controlled requests. A resend should not create a second notification. After acceptance/cancellation/expiry there should be no Accept/Decline controls.
5. Recheck one ordinary signup confirmation and one Admin-created setup invitation to ensure their respective flows still work. Do not send full confirmation links or tokens as evidence.

## Validation and limits

The full automated suite passes **406/406**, including ten notification tests and a realtime refresh test. Actual migration and current RPC/policy source pass disposable PostgreSQL checks for backfill/idempotency, recipient RLS, metadata protection, failed email delivery, resend, no premature membership, acceptance/replay, decline, cancellation and expiry. Surrounding team-permission/billing services in this focused fixture are substitutes; the separate existing complete custom-role migration verifier also passes. Locked native asset build and dependency consumer checks pass, with no APK compilation/device test. The owner reports all eight hosted SQL diagnostic rows PASS. Custom SMTP is owner-reported disabled and template editing blocked; no hosted template save, relay readiness or revised email delivery is confirmed. Redirect/website deployment and revised Notifications UX still need owner confirmation.
