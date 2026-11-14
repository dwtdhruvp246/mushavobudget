# AU02.04 — SQL phase results received; terminal stopped before denials

Stage 3/10 | FR.2/8 | Batch W/Z. 30 October 2026.
Source parent: 67d4661e83707d52ab0778cee27ba33a3b7c349d.

## Exact owner outcome

[Owner receipt](security-fr-2-batch-w-owner-unavailable-invitation-sql-ready-api-stop.json) preserves four successful SQL result objects and the terminal JSON. SQL reports expired, cancelled and replaced-state preparation plus TEMPORARY_INVITATION_FIXTURE_ABSENT. These are accepted as the owner's SQL outcomes, not hosted recipient-denial acceptance.

The original eight-source runtime at 23a4b707421313c5aea2cfab9ab2b4583afb0a59 requested only SQL STEP 1 and CLEANUP. It reports fourteen HTTP requests, zero completion RPCs, empty variants, two created sessions, zero verified logouts and exit1. Its combined fixture precondition failed, then HTTP fixture cleanup and session cleanup were not verified. The owner did not supply the separate local repair terminal JSON.

The returned SQL results include steps 2/3 that the terminal never requested. Their exact timing relative to the first DONE is unknown. Do not assume that they ran ahead, that token expiry caused the HTTP failures, that the database row was wrong, or that either account's current browser session needs revocation. The original helper omitted safe HTTP/response-shape/logout details, so the actual failed condition cannot be recovered from that JSON. Do not mark AU02.04 passed or count a failed session as an invitation denial.

## One next owner action

Run the entire [read-only post-stop SQL](../../supabase/diagnostics/security_fr_2_5_unavailable_invitation_post_stop.sql) once in a NEW blank query in staging project dczlddwbtgvfdujgcitb. Return only safe_result. Do not restart PowerShell or create/advance/delete another fixture for this diagnostic.

The query uses READ ONLY, ten-second statement timeout and ROLLBACK. It reads the two already-selected controlled accounts, exact random-UUID fixture name markers and fixture audit markers, plus their Auth session row counts. It returns account-found booleans, counts and newest node/undici session age seconds only. It selects no address, ID, raw user agent, token or credential into the result.

Remaining fixture/audit counts independently check present marker state. Session counts and the exact node/undici agent category do not uniquely identify the failed run's two session IDs. They do not prove that a surviving session can refresh, that a JWT is unexpired or which HTTP response caused the failure. Missing/other client labels are not classified as node. No user or Auth-session deletion, global signout, password/reset/role/settings/API permission change is requested.

## Follow-through and limits

If marker counts are zero, preserve the confirmed absence and do not re-run fixture cleanup merely because the historical terminal flag remains true. If counts are positive, review the existing run's exact binding and cleanup only that marked fixture with the prepared guarded cleanup. Never delete by a broad email/prefix sweep.

Keep original session cleanup as unverified unless subsequent evidence establishes current state for those exact sessions. Do not revoke unrelated Admin/browser sessions to force a PASS. Before another hosted fixture run, improve the helper's safe HTTP preflight/cleanup classification and the manual handoff so only the currently requested phase is run; investigate access-token renewal only within the test helper, without changing the product's Auth policy. These preparations stay within original AU02.04 and do not add a public case.

Official source review: Supabase User sessions (https://supabase.com/docs/guides/auth/sessions) distinguishes access-token expiry from the underlying session and documents auth.sessions/session_id. Signing out (https://supabase.com/docs/guides/auth/signout) documents local scope. These facts do not establish this owner's actual HTTP failure cause.

One temporary local PGlite smoke executed the read-only diagnostic against synthetic Auth/table rows and checked fixture count, agent category count and absence of private values. No new persistent test suite or product/runtime change. Previous local21 checks are retained without another owner suite run. Assistant hosted Auth/SQL/email: zero. Browser connection timed out; no page was read or query executed through it. No W/V/FR.2/Stage3/release acceptance.
