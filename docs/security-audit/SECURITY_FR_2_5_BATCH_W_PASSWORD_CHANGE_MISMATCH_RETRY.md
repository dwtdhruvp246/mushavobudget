# Password mismatch identified — one corrected AU03.04 attempt

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner reported no apparent effect after Save password, then confirmed the button remained clickable and the top message read **Passwords do not match**. [Exact receipt](security-fr-2-batch-w-owner-password-change-mismatch.json). The reviewed createPasswordChanger validates the two new passwords before calling Auth updateUser. This mismatch path blocks the save; it is not a hosted password-update failure or success. Live network/password state was not independently traced.

The connected browser could not be inspected because its originating context was unavailable. No private field values, tokens, credentials or code were read. Owner observations supplied the relevant state. No runtime change, test rerun, ZIP, SQL, setting or mail action is required to correct the mismatched input.

## Continue on the existing password page

1. Keep the same intended controlled staging account. Clear only **New password** and **Repeat new password**, then enter the exact same private new password in both. Use at least eight characters, a password different from the current one, and matching capitalization/spaces. Keep the current-password field separate and do not send either value in chat.
2. Leave the optional verification-code field blank, click **Save password** once, then read the status above the form. Expect **Password changed. You can return to your app.** If another validation/provider/session message appears, report that message without repeatedly submitting or requesting a code.
3. After success, return to the app, sign out, reload to the sign-in form and sign in with the new password. Return only the save and sign-in outcome.

This remains existing AU03.04. Successful hosted save/retry and any AU03.05 required secure-change/reauthentication variant are pending, not inferred from mismatch rejection. No new acceptance case is added. The mismatch prominence item **UX_AUTH_PASSWORD_MISMATCH_VISIBILITY** remains **DEFERRED_BY_OWNER** under the owner's prior instruction to record it for later; this observation is added as supporting evidence without silently implementing or closing that work.

Accepted faster loading on f8c4b8d6 and prior direct dashboard sign-in remain. Earlier 119 local passes retain source e62f74494f4c828cdb4a748b2f175d6dfa431d67; this documentation adds no test pass. Initial signup confirmation, password recovery and all-user password-only sign-in remain unchanged. V stays on hold with policy reconciliation before future factor work; stronger-MFA findings remain open. Preserve the original 31 AU definitions and prior evidence. Full W/FR.2/Stage 3/re-audit/release remain open; production/native unchanged, APK deferred. Keep the stage prefix on every update.
