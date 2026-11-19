# Batch V current-policy applicability for Batch W Admin invitations

29 October 2026. Reviewed source parent: 760973feae2329880dd70129d852eb33c71ac767.

The explicit 28 October decision in [the owner policy receipt](security-fr-2-batch-w-password-signin-owner-policy.json) applies password sign-in to every role, including Admin. Signup confirmation, live/current Auth session, active-account checks, role/ownership/membership/RLS/RPC authorization remain. The earlier V16-case contract stays an historical definition; this note does not turn stronger MFA/AAL2 cases into PASS results or close V, a finding, Stage 3 or release.

## Existing V requirements under the selected policy

| Original ID | Current applicability / evidence limit |
|---|---|
| V01 | Current source/catalog/effective-grant parity remains applicable. Historical scoped evidence retained; not a fresh complete hosted parity claim after later changes. |
| V02 | Retained owner/control identity evidence remains relevant. Old PRIMARY/RECOVERY setup is not a new credential prompt for W. |
| V03 | No factor write is planned for W. Old uncertain factor history remains unresolved; no new enrollment/removal/reset requested. |
| V04 | Genuine PRIMARY TOTP/AAL2 is not the selected password-only invitation prerequisite. Original stronger criterion remains unmet/on hold, not passed. |
| V05 | Genuine RECOVERY TOTP/AAL2 is not the selected invitation prerequisite. Independent recovery is not proven by current Admin access. |
| V06 | Current session enforcement and narrow server roles remain required. No new MFA assurance enforcement is requested for the selected routine sign-in policy. |
| V07 | Permitted Admin UI/API operations must work under the selected valid-session/role policy. W's scoped invitation test can provide limited current evidence; no AAL2 claim. |
| V08 | Password-only access itself is now authorized by owner policy. Invalid/missing/revoked/stale sessions and unauthorized roles must still be denied. Old mandatory custom email-proof/AAL2 boundary is not silently reintroduced. |
| V09 | Ordinary confirmed users cannot obtain platform Admin access. Remains open at original role-denial scope. |
| V10 | Super/Admin staff/finance/support role boundaries remain applicable and not fully accepted from the working Super Admin account alone. |
| V11 | Revocation and stale privileged-client denial remain applicable and open. |
| V12 | No factor lifecycle operation is part of current W invitation testing. Historical factor acceptance remains on hold/unmet. |
| V13 | Independent recovery/control assurance remains open; W's ordinary recovery or Admin seat save does not satisfy it. No TOTP workflow is restarted here. |
| V14 | Preserve legitimate finance/backend access and historical fixtures. No automatic repeat of accepted financial checks. |
| V15 | Cleanup/containment/source-readback obligations remain at their actual scope. No account/factor/fixture deletion is authorized by this note. |
| V16 | This source reconciliation permits preparing scoped W invitation checks under the later policy. It is not complete V acceptance or a waiver of remaining role/session/recovery obligations. |

## Source boundary allowing scoped W invitation preparation

- app.js allows invite-admin-user only for super_admin/admin_staff and refreshes the current session before dispatch.
- invite-admin-user validates the bearer with Auth, calls requireEmailVerifiedSession (now backed by the accepted current application-session policy), checks the server-assigned active actor role through the reservation path, then reserves/delivers the invitation. No TOTP/AAL2 enrollment procedure is present in this reviewed invitation entry.
- signup.html isolates invitation Auth in sessionStorage with a distinct key, leaving normal app login alone while verifying/showing setup.
- Opening the completed account is an explicit checkbox choice; app-client session adoption occurs after verified completion. After that explicit choice, ordinary shared tabs may legitimately follow the recipient.
- The Admin delivery function already maps provider 429 to INVITATION_EMAIL_RATE_LIMITED; the UI has a readable message. This is source evidence only, not a claim that the live rate limit has reset.

The owner's working Super Admin seat editor is retained runtime evidence for that one authorized operation. It does not prove all role boundaries. The old blanket phone/MFA dependency is superseded only for scoped W invitation preparation by the later owner policy. All five original AU02.01–05 still need their applicable hosted results.

No runtime, SQL, factor, role, settings, production or native changes. No messages/email sent by the assistant.
