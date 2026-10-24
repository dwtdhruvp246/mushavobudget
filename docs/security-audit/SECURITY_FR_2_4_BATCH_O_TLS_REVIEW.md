> Latest FRE158/FRE159: Windows diagnostic8/8 +hosted DOM1/1 PASS, secure QUIC and valid/error-free certificate observed, cleanup verified. TLS-only label matcher corrected with strict TLS/QUIC certificate checks; local37/37 PASS. Focused13-local +10-hosted public followup pending; prior Windows24 passes retained. See [QUIC correction](SECURITY_FR_2_4_BATCH_O_QUIC_CORRECTION.md).

# Batch O hosted TLS assertion review — 2026-10-23

The owner ran published commit `7905c724d6d640672a61c56413ec258fee7b7685` on Node22.17.0/Windows/Chrome155.0.8059.79. Source195/syntax45 and all24 local checks passed. Explicit target setup now passes on this Windows execution; the original first-attempt cause remains unidentified.

The hosted public DOM/secure-context assertion passed. The separate TLS metadata assertion failed (1 PASS,1 FAIL,5 intercepted hosted attempts, combined exit1). No source-hash or service-worker acceptance was reached on hosted staging. Browser/profile cleanup passed for local and hosted instances, fixture cleanup passed, and no private input, real email, backend operation or mode change occurred. Five is an intercepted count, not an independent total of browser requests.

## Evidence gap

The old TLS condition required a Document response URL exactly ending `/offline`, securityState exactly secure and protocol matching TLS1.2/1.3. It stored only the combined boolean. The receipt cannot distinguish missing/delayed metadata, a different fixed public alias, a protocol label mismatch or an actual insecure state. Secure context alone does not resolve that gap. Neither valid TLS acceptance nor a bad certificate is established by the receipt.

Primary protocol reference: https://chromedevtools.github.io/devtools-protocol/tot/Security/ documents separate security-state/certificate fields and example protocol labels TLS1.2 and QUIC. This shows why literal protocol inspection is needed; it does not establish that QUIC was observed in this run.

## Short diagnostic

The published `--tls-diagnostic` mode verifies197 source hashes and47 syntax checks, runs7 metadata-normalization tests and1 actual local browser fixture collection check, then opens only the hosted public offline document in a new disposable profile. It records fixed enums/booleans for the two reviewed aliases, Document security state/protocol, visible security-state certificate presence/error/validity and certificate-error-event presence. It pauses briefly for metadata events. No certificate bytes, subjects, issuers, URLs, target IDs or raw errors are printed. Missing values stay MISSING/null; QUIC stays QUIC; unknown strings become OTHER. This collection does not loosen or mark the original TLS acceptance assertion passed.

It stops before public asset fetching, hosted worker registration, cache seeding or offline navigation. The page's ordinary scripts remain disabled. Public document assets may load under the unchanged intercepted GET allowlist. TLS verification stays enabled; no installed certificates/browser settings/deployments are changed. No account, password, packet, token, code or email is involved. Browser/profile cleanup remains mandatory.

Exit0 in this mode means diagnostic collection completed, not hosted TLS acceptance. Expected fresh owner checks:8 local diagnostic checks plus1 hosted public DOM assertion. Prior Windows24 passes remain recorded and are not rerun or counted as fresh diagnostic passes. Full local regression after instrumentation passed31/31, plus the separately executed metadata fixture collection passed; corrected Windows diagnostic remains pending.

Run the complete PowerShell supplied in chat at the new published pin. Prompts remain none when Edge/Chrome is found, otherwise one existing EXE path from the shortcut Properties → Target. The next decision follows the returned safe metadata; do not rerun the full batch, relax TLS or change staging to compensate for a metadata mismatch. Stage3, full hosted acceptance and release approval remain pending. Last hosted database state observation remains Batch M QUARANTINED; this public probe does not read it back.
