# Unfinished invitation resend and workspace guard

Supabase creates a pending Auth identity when the first invitation is emailed.
After the invitee opens that link, the identity is email verified even if they
leave setup without choosing a password. Supabase cannot send its **Invite
user** email to that confirmed identity again. The existing resend flow sends a
one-time authentication link to the **new** setup URL; that email uses the
**Magic Link** template. The newest invitation replaces the old database row.
Each emailed Auth link is for one use. Opening it and selecting **Back to sign
in** signs out the temporary invite session. To complete setup after that,
an administrator must send a fresh invitation and the recipient must open
that fresh email link. Reopening the older email does not restore the session.

## Deploy the workspace guard

Apply `supabase/migrations/20260923200000_hold_invited_workspace_until_setup.sql`
in Supabase SQL Editor. If the earlier guard migration
`20260923190000_guard_pending_admin_invitation_workspace.sql` has not been
applied, run it first. The new guard protects both normal Free provisioning
paths, including replacement delivery, cancellation, and expiry. It does not
remove existing data.

## Deferred: label replacement emails as setup links

This is optional and is **not required** for the workspace guard or for
completing an invitation. The current Supabase Free setup cannot edit the
Magic Link template, so leave the email wording as it is for now. A resend
still goes through Supabase's one-time sign-in link, but its redirect leads to
the newest invitation's signup page. The invitee must select **Complete
setup** before a workspace is created. Revisit the wording when editable Auth
email templates or a custom email provider are available.

Future template configuration:

In Supabase Dashboard → Authentication → Email Templates → **Magic Link**, use
the neutral subject `Your Mushavo Budget secure link`. Replace the HTML body
with this template (or preserve your existing sign-in branding in the `else`
branch):

```html
{{ if eq .Data.signup_source "admin_invitation" }}
<h2>Finish setting up your Mushavo Budget account</h2>
<p>Open the newest setup link to choose your password and currencies.</p>
<p><a href="{{ .ConfirmationURL }}">Complete account setup</a></p>
{{ else }}
<h2>Sign in to Mushavo Budget</h2>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
{{ end }}
```

The address and Auth link are still issued by Supabase. The message now
describes the setup action accurately; the link continues to the latest
`signup.html?mode=admin-invite&invitation=...` URL. Do not replace
`{{ .ConfirmationURL }}` with a direct signup link, as the one-time email
verification must happen before the setup page can read the invitation.

## Check an existing test invitation

Set the email in `supabase/pending-invitation-workspace-diagnostic.sql` and run
it in SQL Editor. For a clean, unfinished invitation the invitation status is
`sent` and `existing_workspace_id` is null. If the query returns a workspace
for an unfinished invitation, use the email and Auth UUID from that result in
`supabase/repair-empty-pending-invite-workspace.sql`. That optional transaction
deletes only a single active personal workspace with an initial Free plan and
no other referenced data. It raises an exception and rolls back if it finds
anything requiring review. After a successful repair, resend the invitation
from Admin → Users and check again that no workspace exists until **Complete
setup** is selected.
