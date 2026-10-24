# FR.2.4.E3.3 — Node executable path correction

15 October 2026, FRE53. [Owner result](security-fr-2-zoho-node-path-owner-result.json), [local checks](security-fr-2-zoho-node-path-local-checks.json).

## Cause established at the reported scope

The owner Node22.17 verifier again passed29cases,8source hashes and7syntax checks. The Windows PowerShell5.1.26100.9711 preflight returned PRIVATE_PIPE_START_FAILED, Win32Exception native code2, launch_node_file_exists=false, launch_entry_file_exists=true and launch_working_directory_exists=true. Code2 is file not found. The wrapper's selected executable value did not name an existing file; the JS entry and its directory existed. Synthetic DPAPI roundtrip and empty reservation cleanup passed by the reviewed control-flow order. No provider request, credential prompt, grant exchange, email or saved credential bundle occurred. This identifies the invalid executable selection; the raw Source value was not printed, so its exact empty/stale/other representation is not independently known. A damaged or absent Node installation is not established: the owner's normal Node invocation successfully ran the verifier.

## Correction

The owner command captures JSON containing process.execPath and process.version from the already working Node command, retaining that output only in local variables. It checks the response shape, length, absolute executable path and file existence, then runs the pinned verifier through that exact executable and passes the same path to the wrapper as NodeExecutablePath. The path is never printed or committed. process.execPath is the runtime's absolute executable pathname; this avoids treating command display metadata as a launch filename.

The wrapper accepts this explicit path, checks that it is nonempty, absolute, an existing .exe file and free of quotes before any private file or credential action, and normalizes it with GetFullPath. Invalid input stops at NODE_EXECUTABLE_PATH_INVALID. For callers that omit it, the fallback selects exactly one native ApplicationInfo and uses its Path property, with the same checks, rather than Source. There is no shell-execution fallback, broad executable search, install, PATH/configuration change, administrator elevation or security-policy change. Existing captured pipes, Node tracing-option removal, DPAPI-only storage and provider restrictions remain intact. The receipt adds only a fixed node_executable_source label. Existing native code/existence fields remain.

The next invocation remains PreflightOnly. It tests the corrected launch using the precise synthetic payload and ends without entering the sender/Client ID/secret/code prompts. A full OAuth exchange is not resumed merely because the portable tests pass. The owner must return the actual Windows preflight receipt first. No new Zoho client, code, token, SQL or Cloudflare change is needed now.

## Validation

Utility30PASS,8source hashes and7JavaScript syntax checks;6actual Git archive checks pass, including the extracted30-case verifier and cleanup. The one added case captures the actual running Node's identity, confirms its executable is absolute and exists, copies the real private CLI/dependencies into a temporary path containing spaces, launches it through that executable with captured streams and the exact invalid preflight payload, and verifies zero provider attempts and null private output before removing the fixture. This is actual portable Node/CLI execution, not Windows .NET Process.Start() or PowerShell5.1 acceptance. Windows parser/executable selection/pipe checks remain the next owner result. Earlier owner29PASS remains accurately recorded.

Only the local operator wrapper, this meaningful runtime/space-path test, verifier/transport expected count and source manifest change. Existing application, gateway/mail/crypto and SQL implementations are unchanged. All previous evidence, stage0-10 progress objects,123coverage rows and20finding definitions remain preserved. E4 canonical migration/login/all data-entry guards remain required. Hosted acceptance remains false, all full findings remain open, production excluded and APK/native update deferred. Full credential setup and the earlier authenticator/factor commands remain paused.

Official references checked15October2026:
- https://nodejs.org/docs/latest-v22.x/api/process.html#processexecpath
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/get-command?view=powershell-5.1
- https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-
