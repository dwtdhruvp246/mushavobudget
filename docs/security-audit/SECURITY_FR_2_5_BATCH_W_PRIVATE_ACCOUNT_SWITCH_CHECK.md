# Batch W: real account switch, in-flight Business response and stale session

5 November2026. Existing AU05.06 plus the stale-session variant of AU05.07.
The frozen 31-case count does not change. Previous accepted checks and the
owner-deferred AU03.04 retry are not repeated.

Use the already-verified ordinary account with an existing active Business staff
membership, the distinct ordinary Personal account, and only new runner sessions.
The source pins cover the accepted Business script/session entry/HTML; HTML's
known staging DNS substitution is checked against the canonical GitHub blob.

The finite browser sequence is:

1. Open the actual Business workspace as the existing staff member. Open a
   concurrent Personal app tab in the same isolated test context. Clear only
   that context's remembered destination so Personal opens explicitly.
2. Trigger the real Business refresh control. Forward exactly one existing
   `business_transaction_feed` request as the original actor and hold its actual
   HTTP200 response. Do not change the payload or fabricate financial rows.
3. Use the pinned stock SDK to validate/adopt the distinct existing runner
   session in the shared test context. This exercises real Auth broadcast and
   actual app/Business listeners; no password request or synthetic Auth event.
4. Before releasing the held response, require old Business content to be
   hidden, branding/activity/overview/dialogs cleared, the new account's
   Personal dashboard opened and the Business no-access view displayed.
5. Release the original response, require it not to restore the protected view,
   and reload the Personal tab to verify the replacement account persists.
6. Locally revoke only the old runner session, then use its still-unexpired JWT
   for the existing `app_session_status` contract and one own-profile read.
   Require session_valid=false/admin_authorized=false/role=null and no protected
   profile row. This observes server denial during residual JWT lifetime rather
   than assuming immediate cryptographic expiry or revoking unrelated sessions.

Only reviewed read RPCs, normal app reads/activity recording, refresh and local
logout are permitted. Finance/team/role/profile changes, mail and global logout
are refused. No owner password, frontend upload, schema or setting change.

The workflow keeps bounded requests, an eight-minute timeout and no automatic
retries. Test contexts close and all new sessions must receive scoped logout
acknowledgement before COMPLETE. No payload, name, identity UUID, token, password,
storage state, browser log, screenshot, video, HAR or trace is exported.

Eighteen local guard checks pass, including two new checks of the Business
read-only extension and stale-token false-positive controls. These do not prove
hosted acceptance. Record the actual workflow receipt before crediting AU05.06
or AU05.07's stale-session variant. Auth/provider rate UI/quota, recovery cases,
legacy-password/configuration reconciliation and older unbound Node cleanup
remain independent; no whole W/FR/Stage3/release acceptance is claimed.
