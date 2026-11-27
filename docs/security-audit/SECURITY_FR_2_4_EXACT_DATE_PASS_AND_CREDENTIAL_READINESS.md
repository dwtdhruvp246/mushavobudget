# FR.2.4.E5.3 exact dates passed; E5.4 credential readiness

19 October 2026, FRE90. The [owner exact-date receipt](security-fr-2-email-pages-exact-date-owner-pass.json) completed at 2026-10-19T18:13:26.062Z, exit 0, using updater commit 32097df0c5450d8961670dcbc01016518377c6f1. Seven source hashes and the accepted local 44-file ZIP identity verified. Four fresh metadata GETs, the exact date-only PATCH and independent project GET all returned HTTP 200.

Both staging Pages channels now match 2026-07-01, with fail_open:false, latest-date:false, three matching staging markers and limiter binding MATCH. Other observed channel settings and selected project/source/build/deployment fields matched private pre-update snapshots. The owner run establishes scoped configuration acceptance, not complete gateway or hosted authorization acceptance. No upload/redeploy, Zoho-file access, mail, Auth or SQL request occurred in the updater. Concurrent edits were not excluded and no atomic conditional update is claimed. The exact JSON is retained; no PowerShell version is invented. Prior 55 local cases remain evidence at their original pin, not a newly rerun suite.

## Read-only key-label check next

[Contract](security-fr-2-email-credential-readiness-contract.json). Open Supabase project **dczlddwbtgvfdujgcitb**, then Settings > API Keys. Return only whether the reference matches and whether Publishable key, Secret key and the legacy anon/service_role section are listed. Hidden values need not be revealed. No value copying, key creation/rotation/revocation, Supabase settings change, Cloudflare secret installation, SQL or upload is requested.

The reviewed gateway source currently sends its service credential in both apikey and Authorization:Bearer headers. Official Supabase guidance places modern opaque sb_publishable_/sb_secret_ keys in apikey; they are not JWTs. Legacy service_role uses a different JWT format. A regex accepting both formats does not prove transport compatibility. The actual key types available in this project determine the next private setup path, so availability must be established before entering credentials. No modern-key migration or legacy-key regeneration is inferred. If a transport change is needed, test it and prepare a separately reviewed upload candidate; do not silently modify the retained ZIP.

This dashboard check provides owner-observed readiness, not independent staging-key ownership or endpoint authorization proof. Decoded JWT ref/role claims alone do not establish provenance.

## Remaining configuration

The last public-settings readback reported these 13 variables ABSENT in both channels: `EMAIL_GATE_PEPPERS_JSON`, `EMAIL_GATE_KEY_VERSION`, `EMAIL_GATE_RATE_PEPPER`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZOHO_MAIL_ORIGIN`, `ZOHO_ACCOUNTS_ORIGIN`, `ZOHO_ACCOUNT_ID`, `ZOHO_FROM_ADDRESS`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_TEST_RECIPIENTS_JSON`. The date helper required that same fresh shape before writing and compared settings afterward. Credential installation is not implied by its pass.

Later private preparation must generate independent cryptographically random code/rate peppers, validate the keyring version and staging backend keys, reuse the retained encrypted Zoho sender configuration in its proven US region, and select only owner-controlled staging recipients. Credential values belong in encrypted server configuration. No pepper generation, credential collection, provider call or private-file access occurs in this checkpoint. Keep the existing Zoho DPAPI file private and unchanged.

## Preservation

Receipt/documentation changes only; all application/SQL/migration/Worker/inspection/update source and the accepted ZIP remain unchanged. All 89 earlier events, 123 coverage rows, 20 finding definitions, unrelated stage objects and historical pins are preserved. No new application tests are required or rerun for this handoff. Full findings remain open; release gate OPEN_PENDING_REQUIRED_EVIDENCE; final re-audit PLANNED_NOT_PERFORMED. Production/native untouched, APK deferred. SQL email enforcement and platform-role assignment remain separate pending acceptance work.

## Primary sources checked 19 October 2026

- https://supabase.com/docs/guides/getting-started/api-keys — key types, Settings > API Keys location, backend-only secret handling and known header limitations.
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys — migration is separate from copying a new key into an older integration.

The existing header pattern is observed in repository source, not asserted by these external documents.
