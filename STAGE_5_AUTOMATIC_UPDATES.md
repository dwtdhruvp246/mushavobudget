# Stage 5 — Automatic updates and session recovery (4.6.4)

Web-only release. No SQL, Edge Function, secret, or Cron deployment required.

The update helper no longer displays a reload/discard banner. It refreshes once
after a replacement service worker controls the page, only while online, visible,
and free of unsaved forms or tracked submissions. Activation by another tab uses
the same safety checks. Timers never force a refresh before worker activation.
All authenticated submit handlers hold an update lock for their full async work.
Completed saves, form reset/cancel, and completed operations release pending updates.

The launcher and authenticated application now try refreshing an expired access
token before requesting sign-in. Temporary network errors and generic JWT errors
do not delete stored credentials. Confirmed missing/revoked refresh credentials
still require login. Explicit sign-out and server access restrictions are preserved.

First adoption: an already-open older version still runs its older update helper.
Reopen or reload it once to load 4.6.4. Future releases use automatic refresh.

Device acceptance checks (Android, desktop; admin and user accounts):
1. Confirm 4.6.4 after opening the installed app; verify the existing login remains.
2. On the next web update, an idle visible online page should refresh once without
   a prompt. The URL/route remains and the authenticated workspace loads.
3. Keep a payment form edited while an update arrives. It must not refresh until
   saved or canceled. A submission, including proof upload, must finish first.
4. Repeat with another open tab activating the update and with multiple submissions.
5. Temporary loss of network during session recovery must offer retry without
   deleting the saved sign-in. Explicit logout must still require login.

Automated suite: 137 passing checks, including token renewal, unavailable refresh,
revoked credentials, bounded recovery, deferred updates, concurrent operations,
cross-tab activation, canceled forms, and single-refresh behavior.
