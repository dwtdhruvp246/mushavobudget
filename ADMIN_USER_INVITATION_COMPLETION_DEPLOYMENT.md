# Admin invitation completion deployment

Stage 5 lets the invited Auth account create a password, confirm its currencies,
and atomically provision the administrator-selected workspace, plan, invoice, and
optional payment record.

For a payment already received, the entered amount and currency must match the
selected plan's full quoted price. The current invitation flow does not support
partial or discounted subscription payments. The selected plan's included
member seats are available immediately after setup (four for the default Family
plan, subject to plan configuration).

## 1. Apply the migration

In Supabase SQL Editor, run the complete contents of:

`supabase/migrations/20260923100000_complete_admin_user_invitations.sql`

Expected result: `Success. No rows returned`.

## 2. Verify database permissions

Run:

`supabase/admin-user-invitation-completion-diagnostic.sql`

Expected result:

| check_name | passed |
| --- | --- |
| admin_user_invitation_completion_ready | true |

## 3. Test one new invitation

1. Open Admin → Users → Manual user settings.
2. Invite a new email address that has never registered.
3. Open the newest invitation email in a private browser window.
4. Confirm that the name and email are prefilled and read-only.
5. Create the password, confirm currencies, and select a default currency.
6. Select **Complete setup** once.
7. Confirm the app opens while signed in and shows the assigned workspace and plan.
8. In Admin, confirm the invitation status is `provisioned` and any declared payment appears in finance activity.

Do not reuse an older invitation email. Supabase invite links can expire, and a
completed invitation is deliberately single-use. The completion RPC is idempotent
for the same already-provisioned invitation so a client retry cannot duplicate data.
