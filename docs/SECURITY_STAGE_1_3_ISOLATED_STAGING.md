# 1.3 — Isolated staging

Started 8 October 2026 after [1.2 checkpoint closure with carry-forward](SECURITY_STAGE_1_2_CHECKPOINT_REPORT.md), evidence S1E63–S1E65. Stage 1 remains in progress; no full backup/recovery or release acceptance is inferred. Approved operating targets remain objectives, and existing DB/Storage/configuration/offsite gaps remain carried rather than reopen 1.2.

## First owner check: capacity and an existing dedicated target

Open the Supabase Dashboard projects overview and review organizations where you are Owner/Admin. Report only:

1. Count of **active Free projects**, across those organizations.
2. Count of **paused Free projects**, separately (if any).
3. Whether a **dedicated isolated Mushavo Budget test/staging project** already exists: YES / NO / UNSURE.

Example reply: `Active Free: 2; paused: 0; Budget staging: no`. Example is not observed evidence. No project names/keys/passwords/screenshots/customer data are needed. This is a read-only inventory; it is not a request to create, pause/delete/upgrade a project, change access roles, purchase resources or reuse another application's live project as staging.

## Current documented constraint — actual account eligibility pending

Official [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), checked 8 October 2026, states two active Free projects; paused projects do not count towards that quota. It also notes that project-creation eligibility in an organization can depend on other Owner/Admin members' exhausted free-project quotas. The generic limit does not prove that this owner has a spare slot or can create a particular project. Record actual owner inventory and, if needed, the observed creation eligibility before selecting a hosted target. Do not assume different organizations automatically provide more free projects.

If there is a suitable existing isolated target or eligible free capacity, prepare concrete identification/configuration steps for that target. If hosted capacity is unavailable, record the blocker and assess a compatible owner-local staging stack after its actual prerequisites are verified; a standalone PostgreSQL backup client alone is not full Supabase Auth/Storage/Edge staging. No paid resource or existing-project pausing is selected by this check. Backup Docker refusal/selection related to the earlier export route is not presumed to settle the later full-stack staging choice.

## Required isolation before writes or test dispatch

- Explicitly identify the staging frontend and backend; verify its Supabase project reference and reject production endpoint/credentials. Production is `kttkospkblwvguuwnhjj`.
- Separate frontend/backend Auth redirect URLs, Storage buckets, Edge function configuration and secrets. Reconcile deployed/source migration parity, not only a branch name or preview URL.
- Use synthetic users/workspaces/file fixtures and controlled test inboxes. Do not import private production customer backups as test fixtures.
- Keep automatic mail/push/currency/cron dispatch disabled or test-bound until target identity and destinations are verified; do not copy production scheduler/SMTP/Vault/API secrets into an active test dispatch path.
- Verify selected staging identity/capabilities before migrations/configuration/restore writes. Protect the original dirty Windows native checkout and signing identity; no APK update requested.

## Work outcome and reporting

Current state: **owner capacity/existing-target check PENDING; no staging target chosen/created/verified.** Record a concrete blocker where present rather than certify isolation. Once a target is chosen, implement and verify staging-specific identities and synthetic app flows, then provide the scoped 1.3 outcome. Recovery drill is 1.4; monitoring/operations 1.5; detailed Stage 1 report 1.6. Keep active stage.step numbers on all messages and retain failures/unknowns for final remediation/full re-audit. Google backup work remains deferred.
