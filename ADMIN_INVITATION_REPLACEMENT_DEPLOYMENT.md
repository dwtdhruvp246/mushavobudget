# Replacing unfinished admin invitations

This change lets an administrator send a fresh link to an invited person who
has not completed account setup. The earlier invitation becomes cancelled and
its workspace, plan, and payment choices cannot be provisioned. The Auth user
is kept, including if the person already opened the first email.

An invitee can also choose ordinary signup. After verifying their email, they
choose a password and currencies; the pending admin invitation is cancelled
and their own Free personal workspace is created. A fully provisioned account
still uses **Registered user access**.

## Deploy

1. Merge and deploy the website code, then pull the latest `main` on your PC.
2. In Supabase SQL Editor, run the complete contents of
   `supabase/migrations/20260923143000_replace_pending_admin_invitations.sql`.
   Expected: `Success. No rows returned`.
   Then run `supabase/admin-invitation-replacement-diagnostic.sql`.
   Expected: `admin_invitation_replacement_ready | true`.
3. From your project folder in PowerShell, redeploy the protected function:

   ```powershell
   npx.cmd supabase functions deploy invite-admin-user --project-ref kttkospkblwvguuwnhjj --use-api
   ```

4. In Supabase **Authentication → URL Configuration**, set Site URL to
   `https://mushavobudget.com` and allow the signup destination
   `https://mushavobudget.com/signup.html*`. This covers the invitation ID
   query parameter and the self-signup email callback. Changing the email
   sender or Custom SMTP does not configure redirects.
5. Test with an account already invited but not provisioned. Send an updated
   invitation and open only the newest email in a private browser window.
   Confirm the new plan appears and the older link cannot provision anything.
6. For a second unfinished invitation, visit regular `signup.html` and enter
   the same email. Open the new verification email, finish personal signup, and
   confirm the admin invitation says `cancelled` and the account has a Free
   personal workspace. A paid plan and payment from the cancelled invitation
   must not be created.

Supabase's built-in email provider limits how often messages can be sent.
During testing, wait for its cooldown if another invite or recovery email is
temporarily rate limited. Production email delivery still requires Custom SMTP.

Do not paste email links or authentication tokens into chat, issue trackers,
or screenshots. A previously exposed test session should be revoked; the
associated access token remains valid until its expiry.
