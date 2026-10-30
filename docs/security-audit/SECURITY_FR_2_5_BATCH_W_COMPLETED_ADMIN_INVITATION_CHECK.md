# Completed Admin invitation — wrong-recipient and duplicate-completion check

Stage 3/10 | FR.2/8 | Batch W/Z. 30 October 2026.
Source parent: b78584afa8956bc99bad2ab94987b075fdd4f1d8.
AU02.01/02 owner PASS: [receipt](security-fr-2-batch-w-owner-admin-new-recipient-isolation-pass.json).

Use the just-created Free Personal recipient and a different existing controlled test account.
Four local terminal prompts: recipient email, recipient password (masked), other account email, other password (masked). Reuse the accepted v125 ZIP SHA256 9bbad6f7fe83b731aef9b65d3bae5df8b832204c5e7bbd0867a9e5a9b811033b for fixed staging public configuration. No service/Management key, console paste, installation, email or SQL is required.

Entry: scripts/check-fr-2-batch-w-completed-admin-invitation.mjs.
Core: scripts/lib/completed-admin-invitation-check.mjs.
Manifest: scripts/completed-admin-invitation-manifest.json (five runtime sources).
Tests: tests/completed-admin-invitation-check.test.mjs and tests/completed-admin-invitation-config.test.mjs.

## Bounded real owner sequence

At most fifteen HTTP requests to the fixed staging Supabase origin, each timed out at 25 seconds, no retries:
- Create two password Auth sessions and validate each with Auth getUser.
- Read recipient profile to discover its exact invitation; no pasted invitation URL/ID.
- Require that invitation to already be provisioned as Free Personal with no recorded payment and a matching owned workspace before calling completion.
- Establish the other valid identity has its own accessible workspace.
- Other account: get_my_admin_user_invitation must deny with ADMIN_INVITATION_NOT_AVAILABLE; complete_admin_user_invitation must deny with ADMIN_INVITATION_IDENTITY_MISMATCH.
- Recipient: call completion twice for its already-provisioned invitation, passing the retained invitation currency choices. Both must return the original workspace, and the recipient's bounded owned-workspace set must remain identical.
- Log out only the two newly created sessions using scope=local, including after review-required failures where a session was created. Cleanup failure prevents COMPLETE.

Maximum completion RPC calls: three (one denied wrong-recipient call and two intended idempotent recipient calls). No first provisioning is requested. This is an actual server authorization/idempotence check, not SQL role impersonation or a browser-storage edit.

## Acceptance limits

AU02.03 evidence is scoped to this completed invitation with a separately valid Auth identity; a session failure is not credited as recipient denial. AU02.05 duplicate-completion identity/workspace behavior can be accepted only after the owner run. It is not a provider-failure retry, fresh incomplete setup, race test or independent finance/audit parity proof. AU02.04 expired/cancelled/replaced variants remain pending. No new public AU cases or W/V/Stage3/release closure.

Local validation: twelve synthetic tests PASS and two JavaScript syntax checks. Covers incomplete-target stop, wrong identity denials, unacceptable read/completion success, duplicate creation, session/request cleanup, safe Auth classifications, secret-free JSON, fixed staging configuration and refusal of service/secret keys. No hosted calls or emails by the assistant. Owner live run pending.

The runner uses only prompt/notice/close from the existing private-terminal helper; it never calls its authenticator setup method or a factor endpoint.
