# Batch W Admin invitation — first current-policy owner check

Stage 3/10 | FR.2/8 | Batch W/Z. 29 October 2026.
Source parent: 760973feae2329880dd70129d852eb33c71ac767.
Current-policy prerequisite source review: [V applicability note](SECURITY_FR_2_4_BATCH_V_PASSWORD_POLICY_RECONCILIATION.md).

This is the existing Admin-created ordinary-user invitation workflow, using the owner's staging Super Admin. It does not create another platform Admin.

## Original case coverage and remaining scope

| Case | This handoff / limit |
|---|---|
| AU02.01 | New recipient verifies the invited identity, sets first password, completes setup and opens the intended ordinary Personal workspace/plan. Owner PASS, 30 October; preserve the accepted result. |
| AU02.02 | Same-browser normal Admin tab remains the Admin while the isolated invitation setup is open, before the explicit account-adoption choice. Owner PASS, 30 October; preserve the accepted result. |
| AU02.03 | Owner completed-invitation API scoped PASS, 30 October: distinct valid account denied both read and completion. |
| AU02.04 | Expired/cancelled/replaced denial remains pending. Next preparation inventories existing unavailable rows; no new mail or cancellation requested. |
| AU02.05 | Initial setup and repeated completed-invitation idempotence pass. Actual incomplete-setup/provider-failure retry remains unverified. |

## Original owner sequence — already completed; do not repeat

1. Keep admin@mushavobudget.com signed in on the stable staging origin in a normal browser tab.
2. Users > Manual user settings > Invite a new user.
3. Use a private inbox controlled by the owner that has not been registered on staging. Full name: Batch W Admin Invite. Plan: Free/Personal (if unavailable, report the options before substituting a paid plan). Monthly, subscription currency USD, start today, no expiry required for Free. Workspace currencies USD/default USD. Maximum families 0; family-member option and payment received unchecked.
4. Send secure invitation once. This is a single original test invitation, not evidence the previous rate window has reset. On rate-limit or other failure stop, retain its message and invitation row, and do not resend or create another attempt. No quota/SMTP change is requested.
5. Open the received link in a NEW NORMAL TAB in the SAME BROWSER, not Incognito, to exercise real isolated invitation storage against the signed-in Admin. Before Complete setup, verify the displayed recipient and check that the original tab still shows the Admin account.
6. In the invitation tab choose a private password of at least eight characters, keep USD, tick Open this verified account in Mushavo Budget after setup, and Complete setup. This explicit choice adopts the recipient into normal shared app storage; a later shared-tab switch is expected and is not the earlier isolation check.
7. Verify the invited ordinary account opens its Free Personal workspace. Keep all link/password/token material private.

Return: email received; requested recipient displayed; original Admin tab unchanged BEFORE completion; Complete setup succeeded; correct recipient/Free Personal workspace opened.
No new install, upload, SQL, factor setup, manual Auth-storage editing or payment entry is required.

## Rate and evidence limits

Real provider429 was observed during the earlier Business email request; exact quota/reset time is still unverified. This first live Admin request is bounded to one actual invitation. Admin's readable rate handling is reviewed source, not yet accepted hosted behavior. Business AU02.06–08 passes, AU03.04 owner-deferred retry and AU05.01 refresh-continuity carry-forward are retained without repeats.

## Current outcome — 30 October 2026

AU02.01/02 [owner browser PASS](security-fr-2-batch-w-owner-admin-new-recipient-isolation-pass.json), AU02.03 and completed-invitation AU02.05 [owner server scoped PASS](security-fr-2-batch-w-owner-completed-admin-invitation-pass.json). Next action is the [AU02.04 existing-fixture inventory](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_ADMIN_INVITATION_CHECK.md), not another invitation send. Actual setup-failure retry remains separate. Full W/V/Stage3 acceptance is not claimed.
