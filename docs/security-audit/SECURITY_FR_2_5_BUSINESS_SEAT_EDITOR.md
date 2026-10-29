# Business workspace seat editor — Batch W prerequisite

## Current implementation — simplified selected-workspace editor
29 October 2026. Source parent: cf210bc1af8b4b0c3222791bae9fbcbd96f46d49.

Owner requested a normal workspace edit flow without retyping its name or a mandatory support reason.
Admin selects the registered owner and existing Business workspace under Manual plan access, then opens Edit Business seats. The workspace's fresh snapshot displays its current allowance and member/invitation usage. The editor asks only for total seats and Save seats.
The selected workspace UUID, exact snapshot name, subscription version and generated audit description are supplied by the application. Existing server-side Super Admin, verified session, capacity, pending-payment and concurrency guards remain in force.
No SQL change or rerun is needed. The installed admin_set_business_seats RPC is reused. Suspension and ownership workflows are unchanged.
This change is limited to the seat editor; the existing manual subscription controls remain available for plan/date changes.

Validation: six local behavioral tests passed (four UI and two package tests), plus JavaScript syntax checks. Covers current-value loading, workspace name escaping, one-field form, selected snapshot binding, automatic audit note, role/session/busy denials, conflict guidance, forty unchanged public files and canonical ZIP readback. These are local tests; updated hosted saving is still pending.
Preparation accepts the owner's v124 ZIP SHA256 99b4c23e6e2b44cb7c98c2945e15915daa0963efe278323aed1119e3a2311240. Replaces only app.js/app.html (v125); no SQL file is emitted and no hosted requests are made.

Owner next step: run the complete pinned preparation block, upload the resulting staging ZIP, select the existing Business workspace, set total seats to 10 and Save seats. Confirm refreshed Current seats = 10 and Team capacity before resuming AU02.06–08. W and V remain open.

## Prior installation and observations (superseded interaction instructions)

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

## Owner simplified-editor preparation and deployment — 29 October 2026

Owner preparation PASS (exit 0) from pinned commit cb83b543822bca412a7e9ac509f393251267f12b. Five source hashes verified; 42 public files with app.js/app.html replaced and forty unchanged. ZIP SHA256 9bbad6f7fe83b731aef9b65d3bae5df8b832204c5e7bbd0867a9e5a9b811033b. Owner output path C:\\Users\\HP\\Desktop\\Mushavo-W-SimpleSeats-1260828c31754035a743bd71cd55ee19\\output\\mushavo-business-seats-simple-staging.zip.

Owner supplied deployment https://59a54942.mushavo-budget-staging.pages.dev/. This is owner-reported deployment availability; no independent asset hash or successful hosted seat save is inferred. No SQL installation is required for this frontend revision. Next: on the stable staging origin, reload, select the existing owner/workspace, open Edit Business seats, enter 10 and Save seats; verify Current seats = 10 and owner's Team capacity. AU02.06–08 still pending. No new code change or repeat SQL/upload requested.
