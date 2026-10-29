# Business workspace seat editor — Batch W prerequisite
29 October 2026. Parent source: ab18fe67c62b1652f5050d525a8e70b383008291.
Owner requested editing the one-seat manual Business workspace to permit invitation testing.

Implemented an Edit Business seats button under Admin Users / Manual plan access for an existing Business workspace, plus a total-seat editor in its Business support details.
Total includes the Owner. Existing plan, expiry and payment records remain unchanged.
New RPC admin_set_business_seats requires the current verified application session and active Super Admin.
Locks workspace then subscription in the existing invitation/billing order. Rejects stale subscription version, invalid total (1–100), wrong confirmation name, inactive workspace/subscription, capacity below members plus live invitations, pending reviews and future scheduled capacity.
Invalidates unsubmitted quotes and records an audit event with actor, before/after and reason. Same-value saves do not duplicate the audit.
Installer preserves existing role/session guards and requires the reviewed staging catalogue; installs no seat allowance by itself.

Validation: two local behavioral tests (PGlite modeled schema/identity helpers and UI submission VM), plus JavaScript syntax checks. Full SQL installer exercised against modeled catalogue helpers; not live schema or real concurrency acceptance. Hosted deployment and seat save remain pending.
Preparation uses the owner's accepted v123 ZIP SHA256, replaces only app.js/app.html, preserves 40 other entries and verifies canonical ZIP readback. SQL is delivered separately.
No production/native changes, messages, hosted requests or actual seat edits by the assistant.

Owner workflow: install complete candidate SQL on staging, upload prepared staging ZIP, Admin Users > Manual plan access > select existing owner/workspace > Edit Business seats. Enter total, workspace name and reason. Save; confirm refreshed seat count and owner's Team capacity.
Do not re-grant the subscription just to change seats.

Current W evidence: password-change failure/retry AU03.04 deferred at owner request; AU02.06–08 invitation acceptance pending. Owner reports Business workspace and Team invitation control available following owner-managed Admin setup/manual grant. This does not close V or W.
