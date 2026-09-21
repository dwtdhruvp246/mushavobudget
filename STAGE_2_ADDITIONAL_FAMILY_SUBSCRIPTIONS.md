# Stage 2 — additional Family subscriptions

Release 4.6.6 replaces the family-limit dead end with a purchase button. It switches to the buyer's Personal workspace and opens a Family plan checkout. The existing family is not renewed or replaced. Monthly/annual pricing, selected member count and payment proof use the existing review flow.

The database migration is required. Without it, the old database still rejects purchases at the family limit.

## Deployment

After merging, run in PowerShell from `C:\Users\HP\Desktop\Mushavo Budget`:

```powershell
git switch main
git pull --ff-only origin main
Get-Content -Raw ".\supabase\migrations\20260921090000_additional_family_subscriptions.sql" | Set-Clipboard
```

Paste into the Mushavo Budget Supabase SQL Editor and run once. Expected: Success. No rows returned. The migration is transactional and replaces only the purchase/review functions, preserving grants. No Edge Function deployment is needed.

Then copy `supabase/additional-family-subscriptions-check.sql` into SQL Editor. Both results should be true.

## Behavior and verification

- A user at the current family allowance can submit one additional paid Family request. Another pending request is blocked.
- Submission does not increase the allowance or create a workspace.
- Rejection does not increase the allowance or create a workspace.
- Finance approval creates one separate family, applies the purchased plan/member count, and raises the allowance only as far as needed for that family. Repeated review does not create duplicates.
- Existing direct family creation remains limited by the admin allowance. The existing maximum of 100 families is retained.
- Test a user with one family and allowance one: submit, inspect the pending review, approve, then confirm two separate workspaces and unchanged subscription dates for the first family.
- Check the purchase button on both phone and PC.

Automated tests cover client routing, pending requests, load failures and migration safeguards. The SQL migration and end-to-end approval must also be checked against the deployed database; local source checks do not replace that verification.
