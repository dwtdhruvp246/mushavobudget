# Batch I local runner correction and owner retry

23 October 2026, FRE135–FRE136. Source parent: `1dbdba3a6cf1352f00c42249dcc0e12a8ee7479b`.

The owner's original offline run passed 14/14 with 136 hashes, five syntax checks, Node v22.17.0 and PGlite 0.5.8, exit 0. The Windows parent then stopped at RETAINED_GATEWAY_PACKET_SELECTION, combined exit 1, before the hosted child started. The exact safe output is retained in `security-fr-2-email-batch-i-owner-local-stop.json`. That broad checkpoint does not identify the owner's specific failing operation, missing/corrupt files or their PowerShell version.

## Diagnosed source defects

The former `@($Packet.env.ZOHO_TEST_RECIPIENTS_JSON | ConvertFrom-Json)` relies on JSON-array pipeline enumeration. Windows PowerShell 5.1 emits the array as one pipeline object; wrapping it in `@(...)` creates a nested array. Its sole element is then refused by the subsequent string-only recipient check. This is documented by the upstream PowerShell project: https://github.com/PowerShell/PowerShell/issues/3424. The local test models that legacy emission behavior and reproduces the original refusal using synthetic inboxes. It does not execute Windows PowerShell 5.1, DPAPI or the owner's packet. This is a reproducible compatibility defect, not proof that the owner reached that line.

The parent now parses recipients as a property of an object and checks that the property is an array of one to ten distinct valid mailbox strings. The actual revised helper passes native PowerShell 7 and modeled 5.1 enumeration behavior; single-inbox arrays retain their array identity. Only the publishable key and allowed inbox list are returned from that helper. Backend keys, Zoho fields and peppers stay in the parent.

The old discovery path also called Get-ChildItem on a nonexistent default directory under ErrorActionPreference=Stop. That prevented its documented full-path fallback. The revised helper checks the directory before listing, offers the existing-file prompt for an absent or empty directory, preserves failure on unreadable/non-directory paths, sorts multiple candidates and bounds numeric selections. The packet is read, never generated, rewritten or replaced.

## Safe diagnostics and prompts

The parent uses constant checkpoint/problem codes for discovery, numbered choice, manual path, path validation, file read, DPAPI decryption, packet JSON, scope, recipient JSON, recipient validation, local unchanged readback and inbox choice. It never emits exception text, paths, encrypted/decrypted packet contents, recipient strings, hashes of private values, credentials or codes in its safe failure receipt. Numbered candidate filenames and configured inboxes remain local terminal displays. Before the hosted child starts, email_or_Auth_session_outcome_requires_inspection stays false; afterward it remains conservative.

A new optional `-InspectPacketOnly` mode completes private-pipe preflight, packet discovery/decryption/validation and unchanged readback locally, then returns safe JSON before listing inboxes or asking for credentials. The ordinary `-SendOneCode` run performs these checks before its existing credential prompts; no separate inspection run is required. `-PreflightOnly` still reads no packet.

Expected prompts in the full retry remain: a packet number only if several exist, or full existing-file path if none is discovered; an inbox number only if several exist; the same staging Management token hidden; selected account's staging app password hidden; one six-digit code hidden only after provider acceptance. The file-path wording now stresses reusing the existing packet. No new secret is requested. Use the same Windows account that created the DPAPI packet. Default directory: `%LOCALAPPDATA%\MushavoBudget\PrivateStaging`.

The full pinned chat command exports a new public-source snapshot without switching/resetting the working tree. It reuses an available isolated PGlite 0.5.8 installation where found; only if none exists does it install the existing locked public test fixture with scripts/audit/funding disabled. Offline verification adds the actual PowerShell helper tests to the retained 14 Batch I cases. The full probe still makes at most 21 direct requests, requests at most one email, performs no automatic resend, and rehearses recovery inside a transaction ending in ROLLBACK. Batch H installation is never invoked.

## Evidence and limits

`security-fr-2-email-batch-i-runner-fix-local-checks.json`: 53/53 PASS (14 retained SQL/gateway/transport cases plus 39 new parser/helper cases), 137 source identities, five JavaScript syntax checks, Node v24.19.0, PGlite 0.5.8 and PowerShell 7.4.6 on Linux. Tests execute the actual runner AST and selected helper definitions. All synthetic packet files contain public fixture text; no genuine packet or credential is read. The old 14-case receipt remains unchanged. Prior G127/H105 source identities and the Batch I hosted checker/tests remain unchanged.

The owner's exact old local cause and actual Windows DPAPI execution remain unconfirmed. No Batch I hosted login/email/SQL request was sent by the assistant. Last observed hosted installation is Batch H's QUARANTINED state at 2026-10-22T17:16:45.624Z; this correction does not claim a fresh hosted readback. Owner hosted result, full findings closure, browser/active-state/cross-account acceptance and public web/native/store launch approval remain pending. Production and APK work remain excluded. The unrelated Business owner-result modification is preserved outside this change.
