# FR.2.4.E3.3 — local preflight diagnostic, no credentials or provider requests

15 October 2026, FRE51. [Owner result](security-fr-2-zoho-private-setup-preflight-owner-result.json), [offline and real archive checks](security-fr-2-zoho-preflight-diagnostic-local-checks.json).

## What the owner result proves

The corrected Windows export matched all eight source hashes. Node22.17.0 ran all 27 tests and seven JavaScript syntax checks successfully. The outer command's PowerShell parser did not report a syntax error. The actual setup wrapper then returned LOCAL_PREFLIGHT_FAILED with eight hashes verified, zero provider requests, no code exchange, no new refresh token, no saved encrypted credential bundle and no live OAuth child started. The prior archive mismatch is resolved in this run. The generic result cannot identify whether Node discovery, directory/file access, current-user DPAPI or the synthetic child pipe failed. It is not evidence that Zoho rejected a grant, that the mailbox is wrong or that DPAPI specifically is unavailable. The wrapper can start a synthetic zero-request child inside preflight, so private_child_started=false does not prove no local process started at all.

## Bounded implementation change

The existing wrapper gains a PreflightOnly switch. It runs the same source/path checks, Node lookup, private directory/file reservation, synthetic DPAPI roundtrip and captured child pipe. It then ends without entering the credential prompts or OAuth block. The only input to the child is the invalid synthetic offline-preflight payload; the actual JS handler rejects this before fetching any provider. An empty uniquely named file reservation under the normal private directory is removed; the diagnostic reports creation/removal and fails if its reservation remains. The directory may be created if absent. No existing encrypted file is opened or deleted.

Fixed checkpoint labels distinguish NODE_EXECUTABLE, PRIVATE_DIRECTORY, PRIVATE_FILE_RESERVATION, DPAPI_SYNTHETIC_INPUT, DPAPI_ENCRYPT, DPAPI_DECRYPT, DPAPI_ROUNDTRIP, PRIVATE_PIPE, PRIVATE_PIPE_RECEIPT_VALIDATION and COMPLETE. Inside the pipe, fixed labels distinguish configuration/start/streams/write/wait/read/JSON. The receipt includes PowerShell version and an allowlisted exception class or OTHER_LOCAL_EXCEPTION. It never prints exception messages, stack traces, private paths, raw stdout/stderr, provider bodies or environment values. It does not disable DPAPI, weaken a hash, change execution policy, add plaintext storage or change Windows/Git settings. Existing provider protocol and sender/crypto modules remain unchanged. The explicit per-export autocrlf=false and scoped PowerShell LF attribute remain required.

The full secret-bearing flow remains available in source, but is not the next owner action. In that future flow the three hidden prompts, fixed provider endpoints, scope checks, DPAPI-only secret output and request cap remain. The owner has already corrected the sender localpart to plural notifications, selected api-console.zoho.com and created a Self Client privately; none of those facts needs reconfirmation. No new Self Client, secret rotation, grant generation or token revocation is requested.

## Validation and next owner action

Updated utility: 29PASS, eight source hashes and seven JavaScript syntax checks. The two added executable cases exercise the actual handler and captured Node CLI with the precise synthetic preflight payload, proving zero fetch attempts and null private output. The existing Windows source assertions cover the preflight-only branch and hidden prompts; they are not Windows execution evidence. Six actual temporary Git archive checks pass and the extracted verifier returns29PASS. Fixtures are cleaned. The existing transport checker now expects29 rather than27. Windows PowerShell parsing, current-user DPAPI and the actual private pipe remain owner checks, not independently accepted by Node tests.

Run the complete pinned command pasted in chat. It exports only the selected utility inputs and manifest into a new temporary directory, runs29 offline checks, parses the PowerShell source, then invokes the wrapper with -PreflightOnly. It will not ask for Client ID, secret, sender confirmation or authorization code. Return the offline verifier JSON and safe preflight receipt/exit code whether it passes or fails. Do not run the full private setup again yet; no SQL action or live Zoho request is needed to diagnose this local stop.

All prior evidence and original stage0-10 objects,123coverage rows and20full finding definitions remain preserved. E4 canonical schema/migrations, existing login UI and all applicable RLS/RPC/Edge/Storage/Admin guards remain pending. Hosted acceptance remains false, all20full findings open, production excluded and APK/native update deferred. The authenticator/factor-review commands remain paused and no operator role is promoted.

Primary mechanism references checked15October2026:
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertfrom-securestring
- https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.standardinput
- https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.waitforexit
