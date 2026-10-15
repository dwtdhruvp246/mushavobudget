# Current checkpoint — invalid Node launch path identified; corrected runtime path preflight ready

15 October2026,FRE53. [Owner result](security-fr-2-zoho-node-path-owner-result.json): Windows error2, selected Node file absent, entry file/directory present,29PASS and zero provider requests. [Node path correction](SECURITY_FR_2_4_ZOHO_NODE_EXECUTABLE_CORRECTION.md) captures the working runtime's process.execPath privately, validates it and passes it explicitly; fallback uses one ApplicationInfo.Path rather than Source.30portable utility cases and6real archive checks pass. Next Windows run remains -PreflightOnly, with no credentials/code/email/SQL. Full setup and E4 integration remain pending; no full finding closure, production excluded and APK deferred.

---

# Current checkpoint — Windows encryption path passed; Node process-start error needs its native code

15 October2026,FRE52. [Owner result](security-fr-2-zoho-pipe-start-owner-result.json):29PASS,8hashes,PowerShell5.1; PRIVATE_PIPE_START_FAILED with Win32Exception, zero provider requests and empty probe removed. DPAPI synthetic roundtrip passed by control-flow inference; combined pipe flag is false. [Native-code diagnostic](SECURITY_FR_2_4_ZOHO_PIPE_START_DIAGNOSTIC.md) adds only an integer OS error and three existence booleans; no raw paths/messages. Launcher unchanged, exact native cause still unknown. Next owner run remains -PreflightOnly without credentials/code/email/SQL.29offline checks and6real archive checks pass. Production excluded, APK deferred, hosted acceptance false and no finding closure.

---

# Current checkpoint — Windows27PASS; local preflight stage diagnostic ready

15 October2026,FRE51. [Owner result](security-fr-2-zoho-private-setup-preflight-owner-result.json) matches8hashes,7syntax checks and27PASS, then LOCAL_PREFLIGHT_FAILED before credential prompts/provider requests. [Preflight-only handoff](SECURITY_FR_2_4_ZOHO_LOCAL_PREFLIGHT_DIAGNOSTIC.md) adds fixed stage labels without printing private exception text. Updated utility29PASS and6real archive checks pass. Next owner command uses -PreflightOnly: no credentials, code generation, provider request, email or SQL. Exact Windows failing stage remains unknown; no unsupported cause or hosted acceptance claimed. Production excluded, APK deferred and no full finding closure.

---

# Current checkpoint — owner hash stop recorded; scoped archive correction ready

15 October 2026, FRE50. [Archive correction](SECURITY_FR_2_4_ZOHO_ARCHIVE_CORRECTION.md), [owner result](security-fr-2-zoho-private-setup-first-owner-result.json), [real Git fixture checks](security-fr-2-zoho-archive-local-checks.json). Owner verifier stopped after two hashes, before credentials or provider calls. The missing PowerShell LF attribute reproduces the mismatch with core.autocrlf=true. One scoped LF attribute and a per-command archive override preserve bytes; six archive checks and the extracted 27-case verifier pass. Eight reviewed inputs/manifest are unchanged; hashes remain strict. Owner Windows/private result is pending; no email, hosted acceptance or finding closure, production excluded and APK deferred.

---

# FR.2.4.E3.3 — private Zoho token exchange and sender metadata handoff

15 October 2026, FRE49. [Owner client result](security-fr-2-zoho-client-owner-result.json), [contract](security-fr-2-zoho-private-setup-contract.json), [source manifest](security-fr-2-zoho-private-setup-source-manifest.json), [local checks](security-fr-2-zoho-private-setup-local-checks.json).

## Owner facts received

The owner reports that the notification Zoho account is selected, Self Client has been created and credentials are kept private. The sender localpart was explicitly corrected from singular to plural notifications. The API console host is api-console.zoho.com. The full link supplied in chat contained a Client ID, not a Client Secret; only the hostname and presence of an identifier are recorded here, with no identifier or full link copied. The previous singular sender assumption is superseded. Client registration is an owner-reported provider resource change, not token/API/send acceptance. Cloudflare binding-option visibility and mailbox access remain owner reported.

## What the prepared command does

The command pasted in chat exports these eight selected source files plus their manifest from an exact Git commit into a new temporary folder. It installs no dependency, does not change the normal working tree and runs the 27-case offline verifier. Before any credentials are requested, the outer owner command parses the PowerShell source with the local parser. The wrapper verifies all eight SHA256 values, checks Windows DPAPI encryption/decryption and creates a Node child with invalid synthetic input to establish the actual private process pipe with zero provider requests. Any failure stops before code generation.

In the private terminal, confirm the corrected sender address, then paste the Client ID and Client Secret at hidden prompts. Only when the terminal is waiting for the code, open Self Client > Generate Code. Set scopes exactly to:

```
ZohoMail.accounts.READ,ZohoMail.messages.CREATE
```

Use the description “Mushavo staging sender setup”, select a displayed code validity, generate, then immediately paste the fresh code at the hidden terminal prompt. A code generated much earlier can expire; no authorization code belongs in chat. The scopes permit account metadata lookup and message creation, rather than broad ALL, inbox message read/delete or organization administration. No message creation request is made by this setup.

The actual JS handler exchanges the code at the fixed .com OAuth endpoint, validates a refresh-token grant with a second token request and reads selected account metadata using GET /api/accounts. At most three provider requests run, with no retry, no redirects, eight-second deadlines, 64KiB token and 1MiB metadata response caps. Neither a sender nor an endpoint is selected from upstream URLs. Only one matching confirmed primary account with a numeric string account ID, enabled state and unblocked outgoing state is accepted. The plural and singular addresses do not match. This is a metadata eligibility check, not proof of API message-create permission, plan quotas or inbox delivery. Missing returned scope metadata is represented as unverified, not silently treated as confirmed.

Client secrets, refresh tokens and private account details travel through hidden prompts and captured stdin/stdout pipes; never run the internal IPC entry directly to a console. They are not command arguments, environment variables, URLs or public logs. The wrapper clears unsafe Node tracing/preload options for its child. Plaintext must exist briefly in process memory for HTTPS/encryption; memory zeroization and a compromised Windows user are not claimed as solved. A unique file under LOCALAPPDATA/MushavoBudget/PrivateStaging contains only current-user DPAPI ciphertext. It is outside Git and the public candidate. The wrapper checks encryption/decryption and reads the written ciphertext back before reporting saved. Earlier files are never overwritten. No runtime access token or authorization code is persisted in that bundle.

If a refresh token is issued but a subsequent scope, region or account check fails, its private configuration is still encrypted where possible, with account_verified false. Return the safe receipt and do not repeatedly generate codes; the next step can inspect/recheck the encrypted bundle without silently creating further grants. If the child is interrupted or a local disk/encryption failure occurs after an attempted exchange, the receipt conservatively states that a provider grant may exist. No token is revoked automatically. Keep any encrypted output file private; it is not a portable recovery backup.

The wrapper prints only BEGIN SAFE ZOHO RESULT / END SAFE ZOHO RESULT and an exit code, plus its nonsecret local encrypted-file location. Return the safe JSON and exit code, not private files, credentials, provider output, screenshots or full console links. No email, Supabase SQL/Auth/role change, Cloudflare secret/binding/upload or production/native change is included. Hosted acceptance remains false even if this setup passes. E4 canonical schema/migrations, existing login UI and every applicable RLS/RPC/Edge/Storage/Admin guard remain required before activating the feature. No operator privilege is promoted and the old authenticator/factor-review commands remain paused.

## Validation and limits

Actual JS helper and internal CLI tests: 27 PASS, zero failures, exit 0 on assistant Node24.19.0, eight source hashes and seven JS syntax checks. Cases cover fixed HTTP boundaries and three-request limit, code and refresh paths, hidden data in receipts, unsupported region, exact scope checks when present, preservation of an issued grant after later failure, singular/plural distinction, duplicate/disabled/unconfirmed/blocked sender accounts, stream caps, redirects, provider errors, CLI invocation refusal and disabled default network. PowerShell source assertions cover hidden prompts, captured pipes and encrypted file writes. Windows PowerShell execution and DPAPI are explicitly not verified by these Node tests; the owner's actual preflight/result is pending. No real OAuth, Zoho, Cloudflare or Auth request was made by the assistant. Earlier E2 46PASS, E3.1 63PASS and E3.2 31PASS remain preserved, and no existing runtime source was changed.

Current-user DPAPI is the intended Windows mechanism. StandardInputEncoding is not assumed to exist on Windows PowerShell's older .NET Framework; the wrapper writes UTF8 bytes directly to the child's stdin stream. No execution-policy setting is changed. No dependency install or full application regression is needed for this isolated new operator utility at this checkpoint. All 20 original full findings remain open, release gate OPEN_PENDING_REQUIRED_EVIDENCE, full re-audit PLANNED_NOT_PERFORMED, production excluded and APK deferred.

Official sources checked 15 October 2026:
- https://www.zoho.com/developer/oauth/self-client/authorization-code-flow.html
- https://www.zoho.com/mail/help/api/get-all-users-accounts.html
- https://www.zoho.com/mail/help/api/post-send-an-email.html
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertfrom-securestring
- https://github.com/dotnet/runtime/issues/22051
