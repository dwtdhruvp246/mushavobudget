> FRE164: owner Windows29/29 and independent .NET44-entry ZIP readback passed;43 entries preserved, only sw.js changed. Local checkpoint complete, no upload. Do not rerun P. See [completion](SECURITY_FR_2_4_BATCH_P_COMPLETE.md) and [Q handoff](SECURITY_FR_2_4_BATCH_Q_HANDOFF.md). Preparation instructions below are historical.

# Batch P — Pages-redirect-safe offline worker candidate and retained ZIP

Stage FR.2.4.E5.29. Main Stage3 Authorization and Admin MFA remains in progress. No production/native update or APK rebuild.

## Latest owner evidence

Batch O at published df8bdc48490ceaf4879fe4056a0e5aa57e553997 passed199 source hashes,49 syntax and16 local checks on Node22.17.0/Windows/Chrome155. Hosted again passed7 public checks (secure QUIC/current error-free certificate,16 source assets, fresh profile, executed worker, cache cleanup and14 exact cached entries) then stopped. Its final offline document class was BROWSER_ERROR, navigation error present,3 simulated worker fetch failures, no service-worker Document response observed,41 intercepted hosted attempts, combined exit1. Local fixture/browser/profile and hosted browser/profile cleanup passed. These are not total browser traffic counts. No email/private input or mode change occurred. The hosted cached-response redirect flag was not captured in that receipt.

## Reproduced defect and candidate

The original local fixture served .html directly. Adding the documented Pages-style .html -> extensionless301 redirects for the two offline documents reproduces the same7 passes followed by ERR_FAILED/BROWSER_ERROR. Cache inspection shows the public document Response.redirected true. This is a concrete local reproduction matching the hosted symptoms, rather than a direct readback of the old hosted cache flag.

Cloudflare documents extensionless redirects: https://developers.cloudflare.com/pages/configuration/serving-pages/ . The Fetch Standard rejects a service-worker response with multiple redirect URLs when a request's redirect mode is not follow: https://fetch.spec.whatwg.org/#http-fetch . The redirected cached body can match every expected byte and still be unsuitable as the navigation response.

The candidate deployment/candidates/email-offline-pages-v89.sw.js copies the current worker and changes only cache version v88 -> v89 and offline cached-document response handling. It returns the same public cached body as a fresh Response (no redirect URL history), preserves security headers, sets no-store, removes stale content-encoding/length/transfer headers, and uses the existing safe inline fallback if the cached entry is missing, unsuccessful or non-HTML. Online navigation, API/private cache exclusions and push behavior are unchanged. The accepted root sw.js stays unchanged; no currently served worker is claimed fixed yet.

Both actual-engine candidate fixtures pass10/10: direct serving and Pages-style redirects. The redirect case retains redirected:true in its cache, while the actual offline navigation now receives200 from the worker and shows the safe page. No app-navigation request reaches either fixture server. The existing worker redirect failure is asserted as1 expected reproduction case; its7 preliminary passes are not newly added to the aggregate. Eight unit/package tests +1 reproduced failure +20 candidate browser checks =29/29,203 source hashes,53 syntax. Retained O direct-serving regression43/43 also passes after harness instrumentation.

## Owner batch and artifact boundaries

The complete PowerShell is supplied in chat at the published pin. It runs the29 local checks, reads the exact already prepared Batch B frontend ZIP (SHA256867296b5e71747a15d46c7ed8937484558ea9fcac97cd96c66ddf5dc00c8b9da), and creates a new44-entry public ZIP replacing only sw.js. All other43 entries are byte-identical, including staging config/public push key, Cloudflare gateway _worker.js, _headers and routes. The retained ZIP is checked before/after and not rewritten. No DPAPI packet, provider/service secret, password, token or code is needed. No npm/browser installation or credential/key generation occurs.

The assistant has not accessed or prepared the owner's actual retained ZIP. The repacker is tested with a synthetic44-entry public archive, preserves43 entries, verifies canonical ZIP roundtrip, and refuses the wrong retained artifact before writes. The owner command additionally opens old/new archives with Windows .NET, compares all43 preserved entry hashes, checks the replacement against the pinned candidate hash, and verifies old/new outer hashes. ZIP creation uses a new empty directory and exclusive writes; any uncertain output is inspected before retry, never overwritten blindly.

Prompts: normally none. If no existing Edge/Chrome EXE is found, one prompt asks for its full path from shortcut Properties → Target. If the retained ZIP is not found at the prior Batch B location or conventional batch-b folders under TEMP, one prompt asks for its full existing mushavo-email-push-review.zip path. It is the public artifact previously uploaded in Batch G, normally C:/Users/HP/AppData/Local/Temp/mushavo-batch-b-27ecd840ce3a42fb9a5c9bd008f3d9e4/batch-b-frontend/mushavo-email-push-review.zip. No private configuration values should be entered; do not recreate them if the ZIP is missing.

The new ZIP is a local review candidate only. do_not_upload_yet remains true until the Windows safe receipt and independent readback are reviewed. The next staging deployment must use the exact reviewed ZIP, preserve all existing Pages/limiter settings and private controls, and then independently verify public source and offline behavior. No hosted retry of the unchanged deployed worker is requested now.

Staging database access is not opened or read by this local batch; last hosted database state observation remains Batch M QUARANTINED. Hosted public offline acceptance, authenticated/browser/installed-PWA/OS lifecycle, role/Admin MFA, concurrency/caller graph and release approval remain pending. No findings closed. Production/native unchanged; APK deferred. December2026 remains a target month subject to acceptance, not an approved launch date.
