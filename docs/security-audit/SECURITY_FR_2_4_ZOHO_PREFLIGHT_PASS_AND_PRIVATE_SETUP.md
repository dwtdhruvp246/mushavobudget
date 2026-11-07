# FR.2.4.E3.3 — corrected Windows preflight passed; private provider setup next

15 October 2026, FRE54. [Owner receipt](security-fr-2-zoho-corrected-preflight-owner-result.json). Executable source pin69c963a628f883646917061cb73813d80532280e remains unchanged.

## Result

Owner Node22.17.0 returned30PASS,8source hashes and7JavaScript syntax checks. Actual Windows PowerShell5.1.26100.9711 parsed and ran the wrapper with the captured running Node executable. The corrected preflight returned COMPLETE, all three path-existence booleans true, node_executable_source CALLER_RUNNING_NODE_EXEC_PATH, Windows_DPAPI_and_private_pipe_preflight_passed true, no exception/native error and exit0. The empty unique probe was removed. This resolves the observed local executable-selection failure for this owner invocation. The passing private pipe used synthetic invalid input and made zero provider requests. The receipt's private_child_started=false refers to the full OAuth child, which is still unrun; the synthetic local child did execute successfully.

This is actual owner Windows local preflight evidence, not an OAuth/account API result, actual secret encryption-file acceptance, email delivery or hosted application acceptance. No new code, grant, refresh token, account lookup, email, hosted setting, SQL, role, Cloudflare resource or production/native change is reported by this run. The helper source and all previous checks remain preserved; no further routine30-case rerun is required for the same source pin.

## Next complete owner terminal handoff

Use the complete block pasted in chat. It captures the running Node executable privately, exports the same eight reviewed utility inputs plus manifest from the exact source pin into a new temporary folder, parses the PowerShell wrapper, then invokes it with NodeExecutablePath and without PreflightOnly. The wrapper rechecks all eight hashes and repeats its short local safety preflight before requesting credentials. No Node dependency install, normal working-tree replacement or execution-policy change is requested. The passed30-case offline suite need not be repeated solely to resume this same candidate.

The wrapper asks to confirm the intended plural notification sender address, then reads Client ID and Client Secret through hidden terminal prompts. Use the existing newly created Self Client under the matching notification Zoho account at api-console.zoho.com. Generate a fresh short-lived authorization code only when the terminal is ready for it. The scopes must be exactly:

```
ZohoMail.accounts.READ,ZohoMail.messages.CREATE
```

Use description Mushavo staging sender setup. Paste the code only into the hidden terminal prompt. Do not create another Self Client, rotate existing credentials, share a full console URL, or put any credential/code/token into chat. The setup uses at most three fixed provider requests: OAuth code exchange, OAuth refresh proof and GET account metadata. It does not call a messages/send endpoint. It saves a unique DPAPI current-user ciphertext bundle outside Git/public output and verifies its roundtrip/readback; no secret file is requested as an upload. The printed local encrypted-file location should be retained privately. This is not a portable recovery backup.

Return only BEGIN SAFE ZOHO RESULT / END SAFE ZOHO RESULT JSON and the private setup exit code. If setup reports review/failure, stop there and return that receipt; do not generate repeated codes. A grant may already exist if the exchange was attempted, and the helper preserves an issued refresh configuration for encrypted review where possible even if a later scope/account check fails. A missing reported scope remains unverified. Metadata success is not proof of send permission, plan quota or inbox delivery. The full setup has not succeeded until its owner result is received; no passing result is predicted or prefilled.

No SQL, live email, Cloudflare secret/binding/deployment, application feature activation or operator promotion belongs to this step. E4 canonical schema/migrations, existing login/remember UI and all RLS/RPC/Edge/Storage/Admin guards remain required. The authenticator/factor-review commands stay paused. Original stage0-10 objects,123coverage rows,20full finding definitions and all prior evidence remain preserved. Full hosted/native/store acceptance is false, all full findings remain open, production excluded and APK/native update deferred.

Official provider setup references checked earlier15October2026:
- https://www.zoho.com/developer/oauth/self-client/authorization-code-flow.html
- https://www.zoho.com/mail/help/api/get-all-users-accounts.html
- https://www.zoho.com/mail/help/api/post-send-an-email.html
