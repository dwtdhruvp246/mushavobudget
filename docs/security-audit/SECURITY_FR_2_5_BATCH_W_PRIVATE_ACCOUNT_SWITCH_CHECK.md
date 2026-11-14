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


## Hosted result

FRE299: [run42000458416](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/42000458416) exit0, AU05.06 and AU05.07's stale-session variant scoped PASS. [Receipt](security-fr-2-batch-w-account-switch-stale-session-pass.json). One genuine old-actor HTTP200 response was held and released unchanged; actual cross-tab adoption cleared Business branding/activity/dialogs before release, protected content stayed hidden afterward, and the replacement Personal session persisted through reload. The revoked old runner session's still-unexpired JWT received session_valid=false and an empty own-profile result.3/3 new-session logout acknowledgements; exact run-tag rows0.18 direct API calls,156 browser backend requests including3 normal activity RPCs,2 stale-session snapshots and3 pinned public reads are separately counted; public assets/WebSocket traffic is not claimed as measured. No mail or account/finance/role/settings/schema/deployment mutation.
