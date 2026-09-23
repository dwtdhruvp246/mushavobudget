# Admin user invitation foundation — Stages 3 and 4

This release adds the protected data and email-delivery foundation for manually
inviting a user from the admin Users page. An authorized administrator can
choose the plan, billing period, subscription dates, optional workspace
currencies, family access, and an optional payment already received.

The invitation creates a Supabase Auth user so Supabase can send its secure
invite link. Workspace, plan, invoice, and optional payment provisioning is
deferred until the invitee finishes the separately deployed Stage 5
password/currency setup flow.

## Prerequisites

Before sending a real invitation:

1. Configure production Custom SMTP in Supabase Auth. Supabase's built-in email
   provider is intended only for testing and has a very low delivery limit.
2. Add the production signup URL to the Supabase Auth redirect allow list.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only in Edge Function secrets. Never place
   it in `config.js` or another browser asset.

## Deployment order

After this branch is reviewed and merged, run from PowerShell:

```powershell
cd "C:\Users\HP\Desktop\Mushavo Budget"
git switch main
git pull --ff-only origin main
Get-Content -Raw ".\supabase\migrations\20260922113000_admin_user_invitations.sql" | Set-Clipboard
```

Paste the migration into Supabase SQL Editor and run it once. Expected:
`Success. No rows returned`.

Next deploy the protected Edge Function:

```powershell
npx.cmd supabase functions deploy invite-admin-user --project-ref kttkospkblwvguuwnhjj --use-api
```

`APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` must be available to the function. `APP_ORIGIN`
must exactly match the deployed website origin.

Finally, copy `supabase/admin-user-invitation-diagnostic.sql` into SQL Editor
and run it. Expected:

```text
admin_user_invitation_foundation_ready | true
```

## Verification for this stage

- Admin staff and super admins can see the secure invitation form.
- Other admin roles cannot see the form and receive a server-side 403 if they
  call the function directly.
- Invalid plans, dates, currencies, payment details, duplicate users, and
  duplicate active invitations are rejected by the database.
- The service-role key and declared payment data never enter Auth metadata or
  browser configuration.
- Successful delivery appears as `sent`; failed delivery is audited without
  exposing payment details in function logs.
- A newly invited Auth user has no workspace or subscription yet.

After this foundation is healthy, deploy
`20260923100000_complete_admin_user_invitations.sql` by following
`ADMIN_USER_INVITATION_COMPLETION_DEPLOYMENT.md` before sending production
invitations.
