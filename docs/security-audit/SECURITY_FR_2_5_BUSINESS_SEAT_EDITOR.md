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

## Owner installation and first save attempt — 29 October 2026

Owner preparation PASS, exit 0, pinned commit fe904ace128a6a709379b029e50620c4fdaa8cbe. ZIP SHA256 99b4c23e6e2b44cb7c98c2945e15915daa0963efe278323aed1119e3a2311240; 42 public files, app.js/app.html replaced, 40 unchanged. Owner reports SQL result “Success. No rows returned” and deployment https://78da89b0.mushavo-budget-staging.pages.dev/.

Screenshot image(20261029-171149).png shows the v124 seat editor, total 10, confirmation text “testing1”, and three admin_set_business_seats HTTP400 requests. Visible returned message: WORKSPACE_NAME_CONFIRMATION_REQUIRED. The dialog title/actual workspace name is outside the screenshot. These facts establish a hosted validation rejection; they do not establish a successful seat save or prove the entered name matches the stored name. Source comparison requires the trimmed input to equal the workspace name exactly, including case.

Next owner action: copy the exact workspace name from the top of the same dialog into the confirmation field, use an 8+ character reason, and submit once. Confirm refreshed Current seats = 10 and Business Team capacity. If the exact-name attempt still rejects, obtain the displayed title and returned error before changing code. No SQL rerun or new upload requested for this validation rejection. W invitation cases remain pending.
