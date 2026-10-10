# 2.2 — Public contact-form abuse controls

Local candidate checkpoint completed 9 October 2026. Two of three contact work items complete; **2.2.3** is the remaining controlled staging acceptance item. F09 remains open. Stage 2.1 stays closed with its failed production HTTP redirect deferred to final remediation.

## Baseline — 2.2.1 / S2E13–14

Owner staging metadata checked 2026-10-09T18:41:45.158971+00:00, server 17.11, intended project **dczlddwbtgvfdujgcitb**. The five-row read-only diagnostic shows public.enquiries owned by postgres with RLS enabled, not forced. Both anon and authenticated effectively INSERT six columns (full_name, email, enquiry_type, message, country_name, country_code), despite their table-level INSERT being false. Anonymous SELECT/UPDATE/DELETE are false. Authenticated SELECT/UPDATE grants require staff RLS policies; grants alone do not prove ordinary users can see or change enquiries.

Public INSERT and staff SELECT/UPDATE policies, two enabled application triggers, twenty validated constraints and four name-matched routines were reported. Bodies/policy expressions and actual write behavior were not retrieved or exercised; SQL does not establish hosted project identity. No customer rows or dispatch requests were produced.

The source Contact form directly inserted these columns. Its browser honeypot and HTML bounds can be skipped by API callers. This source/catalog evidence justifies moving submission controls to a server gate; it does not prove every reachable RPC or the deployed production configuration.

## Candidate — 2.2.2 / S2E15

- Contact page loads a real public Turnstile widget only when configured. It requires a token, posts to submit-enquiry, retains details on failure and resets consumed/expired verification. Empty key disables the form and supplies the support email.
- Edge endpoint binds the known backend to its exact reviewed website origin. It allows POST/OPTIONS, bounds actual streamed JSON to 32 KiB, validates fields/types/lengths/countries/categories and rejects administrative or honeypot fields.
- Server Siteverify must report success, the bound hostname, action public_contact and a current challenge timestamp. Invalid, replayed, wrong-host/action or unavailable validation fails closed. No request flag disables verification. CORS is not the anti-bot control.
- Service-only submit_verified_public_enquiry(jsonb,text) uses an empty search path and one transaction advisory lock. The enquiry insert and quota increments commit or roll back together. Fixed-window caps: **3 per normalized email/hour, 10 globally/minute, 60 globally/hour**. Global caps constrain email rotation but can also temporarily restrict genuine users during abuse.
- Counters contain a server-secret HMAC of email plus window/count metadata. No raw IP or client IP header is trusted. Old windows are removed during later submissions; scheduled idle-time retention and IP-based rate controls are not proven. These limits do not prove network DoS or Edge-cost protection.
- Migration revokes PUBLIC/anon/authenticated INSERT at both table and every column, removes the public INSERT policy and asserts effective denial. It preserves staff SELECT/UPDATE and the existing normalization/admin queue triggers. Trigger/external dispatch behavior remains a separate hosted check.
- Runtime prefers injected new secret keys; legacy service-role JWT is retained only for runtime compatibility. Neither backend credential reaches web output. Production and staging secrets/widget bindings remain separate.
- Staging builder preserves the current isolated source, copies only 34 reviewed public files plus regenerated headers, injects the public sitekey and rejects production references. Private deployment code remains outside the web folder. CSP allows the exact Cloudflare challenge script/frame origin; resource policy is still report-only.

Files: site.js, contact.html; supabase/functions/submit-enquiry/{index.ts,handler.mjs}; supabase/migrations/20261009190000_public_enquiry_submission_gate.sql; scripts/prepare-stage-2-contact.{cjs,ps1}; updated header helper and _headers.

## Validation and limits

**32 selected tests PASS** on Node 24.19.0: 19 contact handler/browser-fixture/builder tests and 13 header/guard/handoff tests. Actual handler executes with mocked Siteverify/database responses. Browser checks use a Node VM DOM fixture, not Chromium. Tested normal/denied inputs, missing/invalid/replay-rejected challenges, wrong host/action/time, upstream failures, quota receipt mapping, secret-safe errors, token reset/concurrent clicks and staging-source isolation.

Edge TypeScript entry bundles successfully with esbuild. Migration parses as 17 SQL statements and 3 PL/pgSQL blocks using pglast 8.5 / libpg_query PostgreSQL 18.6. Parsing is not PostgreSQL 17 execution, actual effective-role enforcement, concurrency, transaction rollback, provider deploy or real widget proof. Windows PowerShell execution is owner-pending. No root local test contacted a hosted database, SMTP, push or challenge provider.

## Owner staging setup — 2.2.3 / S2E16–24

Use **mushavo-budget-staging.pages.dev** and Supabase **dczlddwbtgvfdujgcitb**. Production **kttkospkblwvguuwnhjj** is not this handoff's execution target.

1. Create one real Cloudflare Turnstile **Managed** widget named Mushavo Budget STAGING Contact. Hostname: mushavo-budget-staging.pages.dev. Pre-clearance off. Save its sitekey and secret privately; the sitekey is public, the secret is backend-only.
2. Run the inline pinned Git PowerShell handoff for scripts/prepare-stage-2-contact.ps1. It prompts locally for the public sitekey and creates a new Desktop candidate. **web** is the Cloudflare staging upload folder; its parent is the single-function deployment folder. It does not checkout/reset, upload, deploy, execute SQL or change the original frontend.
3. Configure the two private staging Edge secrets: MUSHAVO_CONTACT_TURNSTILE_SECRET (widget secret) and MUSHAVO_CONTACT_QUOTA_SECRET (privately generated 32 random bytes encoded as 64 hex characters). Preserve the quota secret across ordinary redeployments. Changing it changes email quota identities. No secret is sent in chat.
4. Deploy **submit-enquiry only**, with explicit staging project-ref and --use-api, then coordinate database gate and new web deployment. The exact commands/clipboard SQL are supplied in chat after preparation. No Docker or whole-project db push/migration batch is needed.
5. Perform one controlled batch: real widget/valid enquiry and staff queue; missing/forged/replayed token; malformed/oversized fields; anonymous and ordinary signed-in direct insert/RPC denial; repeated same-email limit; retained details/retry UI and staff access. SQL quota/concurrency/atomicity cases use staging only. Record unavailable scenarios instead of expanding this step indefinitely.

Gate SQL is delivered by pinned git show to Set-Clipboard and manually pasted into the owner-verified staging SQL Editor. Deploying revocations with the old frontend makes its direct submission fail, so endpoint/config preparation precedes coordinated cutover. The exact commands are staged around that cutover.

The draft production Contact has an intentionally empty sitekey; production readiness requires its own widget, secrets and coordinated promotion. This PR is not an approval to merge or deploy production.

Turnstile is an additional processor dependency for Stage 4/F20 privacy/provider review. No complete privacy assessment, contact delivery guarantee or full F09 acceptance is claimed by this local checkpoint.

## Sources used for provider behavior

- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/reference/content-security-policy/
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/reference/cli/supabase-functions-deploy
- https://www.postgresql.org/docs/17/sql-createpolicy.html

Detailed Stage 2 reporting remains due at 2.4. Failed/unverified items remain in the final remediation and full re-audit.

## Owner preparation receipt — S2E17

The owner ran the pinned fbb70fe96d0ff5444cbfdb89888e4e0e49d17ca0 preparation. Reported result STAGING_CONTACT_CANDIDATE_PREPARED, 35 public files, staging reference dczlddwbtgvfdujgcitb, successful production-reference scan, absent production push key and unchanged source files. The preparation output labels its builder 2.2.2; the current owner work is 2.2.3.

Web output: C:\Users\HP\Desktop\MushavoBudget-Staging-Contact-40496c9017e14aac85fc4be78b10bb24\web.
Single-function deployment folder: C:\Users\HP\Desktop\MushavoBudget-Staging-Contact-40496c9017e14aac85fc4be78b10bb24.

Public sitekey presence is a preparation pass, not proof of the real hostname/key pair. No Edge deploy, database gate, web upload or hosted challenge/permission/quota behavior is reported yet.

Next handoff S2E18: owner opens staging Edge Functions > Secrets, saves the widget secret as MUSHAVO_CONTACT_TURNSTILE_SECRET and a privately generated 32-byte hex value as MUSHAVO_CONTACT_QUOTA_SECRET, then deploys only submit-enquiry with the explicit staging project-ref and --use-api. The PowerShell generator copies the quota secret to the owner's clipboard without printing it. No secret is sent to root or embedded in source/web files. Supabase CLI account login may be needed; this is separate from the database-password login used earlier.

This handoff requests no Docker, function prune, database gate execution or web upload. The already-prepared gate/acceptance handoff follows the actual staging deployment result. Contact remains one bounded work item from completion; unverified cases stay explicit for final remediation.


## Owner function deployment and next gate — S2E19–20

On 10 October 2026 the owner CLI reports submit-enquiry deployed successfully to staging dczlddwbtgvfdujgcitb. Both index.ts and handler.mjs were uploaded using --use-api and --no-verify-jwt. This is a deployment pass; it does not prove the two custom secrets, live Turnstile validation or database write behavior. The CLI's available-version notice did not fail deployment and no upgrade is required for this handoff.

The next handoff copies the unchanged gate migration from pinned commit fbb70fe96d0ff5444cbfdb89888e4e0e49d17ca0 through git show and Set-Clipboard. The owner verifies the staging Dashboard project reference, pastes the entire script into a new SQL Editor query and runs it once. It creates the service-only quota gate and revokes both table/column INSERT bypasses, with effective-permission assertions before transaction commit. Staff read/update is retained. Root does not execute hosted SQL or request whole-project db push.

Expected SQL Editor completion is Success. No rows returned. Any error stops the frontend cutover until reviewed; this CREATE migration is not a command to rerun after success. The owner must also confirm that both custom secret names are saved, without sending values. After gate success, the prepared web directory is uploaded only to mushavo-budget-staging Pages, followed by the existing single controlled acceptance batch. Database gate, frontend deployment, real widget, quotas and staff/denial behavior remain unverified. F09 remains open; contact still has one bounded work item remaining.


## Owner gate result, secrets and web upload — S2E21–22

The owner reports Success. No rows returned for the supplied staging migration and confirms both custom secret names saved on 10 October 2026. Record the database gate and its in-script permission assertions as an owner-reported pass in this scope. This does not independently establish project identity, correct secret values/key pairing, allowed/denied API actions, actual quota/concurrency/rollback or staff queue behavior. Root received no secret values and performed no hosted SQL write. Previous pending statements above describe their earlier receipts.

Next, use the Cloudflare account containing the existing Pages project mushavo-budget-staging. In Workers & Pages open that exact project and Create a new deployment. Select Production within this staging project to update its stable mushavo-budget-staging.pages.dev hostname; a hashed preview origin is not the endpoint's configured website origin. Upload only C:\\Users\\HP\\Desktop\\MushavoBudget-Staging-Contact-40496c9017e14aac85fc4be78b10bb24\\web. The parent directory contains private deployment code and is not the website upload. Wait for Save and Deploy success, then report the result. No new project, actual production-site deployment, native rebuild or secret reset is requested.

After the owner upload receipt, perform the already planned single controlled staging acceptance batch. Do not repeatedly regenerate/redeploy or grow this bounded item for unavailable cases. F09 remains open and 2.2.3 remains the single contact work item left; detailed Stage 2 reporting remains due at 2.4.


## Owner web deployment and one acceptance batch — S2E23–24

The owner confirms the staging frontend was deployed. Root's GET attempts for contact.html, site.js and config.js returned HTTP 403; the web retrieval tool could not access these assets. These retrieval failures do not establish their cause or prove the deployed website has failed. Live candidate parity and browser behavior remain unverified until the owner batch.

The remaining batch is finite. In the staging Contact page, check required fields, then send three fictional enquiries using the same email contact-audit-20261010@example.com, Country Zimbabwe, Type Support and messages AUDIT-S223-FORM-20261010 enquiry 1. Synthetic staging audit test. (then 2, 3 and 4). Three consecutive same-hour sends should show Enquiry submitted; the fourth should report the limit and retain entered fields. The SQL review expects three matching new website enquiries, one email and the expected Zimbabwe classification. No email delivery is inferred.

The pinned inline PowerShell handoff runs scripts/run-staging-contact-acceptance.ps1. Its Node checker reads the deployed staging config/candidate/headers, rejects non-staging config or changed contact assets before backend tests, checks allowed preflight and rejected origin/fields/body/token, then tries direct INSERT/RPC and quota reads as anon and optionally the existing audit.owner@example.com staging test user. Only exact 42501 privilege denials with HTTP 401/403 pass; a generic 401 or invalid JWT cannot pass. If the owner lacks the test app password, press Enter and record signed-in checks UNVERIFIED. The password stays owner-local, is cleared from process environment afterward and does not appear in output. Only that newly created API test session is logged out; the browser session is not deliberately logged out.

Direct bypass probes use audit.bypass@example.com and separate AUDIT-S223-API markers. If a protection unexpectedly fails, up to four synthetic enquiry attempts may insert rows; the checker reports FAIL and retains them for review. It never uses a service key, calls production, edits customer records or deletes test rows. Public asset GETs may follow same-website extension redirects; all backend requests bind to the fixed staging URL and reject redirects.

Five meaningful local checker tests pass, including actual handler rejection execution against mocked provider/role responses, detecting successful unauthorized inserts, rejecting JWT 401 false positives, preventing backend requests for production config/changed assets and recording absent signed-in credentials as unverified. Extracted owner-invoker JavaScript compiles/runs with a wrong-project fixture. The read-only SQL parses as five statements; Windows PowerShell and hosted PostgreSQL execution are not root-verified. Existing runtime files and previous 32 candidate checks are unchanged.

The API checker runs before browser writes. If it reports REVIEW, the runner stops and the owner sends that summary. On a scoped pass (including an explicitly skipped signed-in check), the runner pauses; the owner completes the form checklist in the browser, then returns to PowerShell and presses Enter. Only then does it copy supabase/diagnostics/security_stage_2_contact_acceptance.sql to the clipboard, avoiding clipboard replacement while copying form values. The owner pastes it into a new, owner-verified staging SQL Editor query and runs the entire script once. It returns one three-row result set with counts only and performs no writes. Send that result, the API JSON summary and the form checklist. Real token replay/wrong-host provider cases, concurrent/global quotas/rollback and staff app queue/update/dispatch stay explicitly unverified when unavailable. This is the existing one acceptance item, not a new series of open-ended setup checks. F09 remains open until the results are reviewed; detailed Stage 2 reporting remains due at 2.4.


## Acceptance guard failure and file comparison — S2E25–26

The owner API batch completed at 2026-10-10T09:20:41.457Z with STAGING_CONTACT_API_REVIEW, exit code 1 and DEPLOYED_CONTACT_CANDIDATE_MISMATCH. Staging config passed; both reviewed JavaScript and HTML parity checks failed. The guard runs before endpoint/role probes and sign-in, so no backend submission or test sign-in phase was reached. The runner stopped before the manual form phase. This receipt does not prove a permission, quota or challenge failure. Wrong/older upload, encoding, hosting transformations and cache differences remain possibilities; no cause is established.

Use scripts/diagnose-staging-contact-files.cjs for one owner-local read-only comparison before any further deployment. It reads site.js and contact.html from the known prepared web folder and performs four GETs against the fixed staging hostname (ordinary and cache-busting copies), with 15-second request limits and a 512 KiB asset cap. Redirects are rejected. The output contains metadata only: local/live availability, exact reviewed parity, equality to the prepared copy, public sitekey-format count, replacement/BOM counts and Cloudflare rewrite-marker flags. Keys and file contents are not printed. ASCII-only comparison helps identify Unicode-only differences but is never accepted as candidate parity or security proof. The diagnostic does not read config, request passwords, call a backend/Auth endpoint, write files, deploy or execute SQL.

Five local diagnostic tests pass: exact candidate comparison and GET-only behavior; Unicode corruption without accepting weaker parity; transformed/cache-variant HTML; missing files/network error redaction; empty widget and oversized/off-origin asset rejection. The existing five API checker tests also pass after adding the separate diagnostic. Windows/Cloudflare owner execution is pending. Neither acceptance hashes nor application files are changed. Record the returned metadata before choosing a correction; do not ask for secret resets, repeat the database migration or blindly redeploy. This is diagnosis of the failed guard within the existing 2.2.3 item, with one contact work item remaining. F09 stays open and the Stage 2 report is still due at 2.4.


## Prepared-file encoding diagnosis and bounded repair — S2E27–28

The owner read-only diagnostic reports that both local prepared files fail exact reviewed parity while their ASCII skeletons match. Local site.js is 18,241 UTF-8 bytes; ordinary and cache-busted live copies match it exactly. The endpoint marker exists and no replacement characters, BOM or Cloudflare rewrite marker were reported. Local contact.html is 6,612 bytes with one real-format public key; its hosted reads failed without a returned status. This establishes that the mismatch already exists in the upload folder. The live JavaScript is the same copy, so blindly uploading that folder again would not correct it.

The original preparation routed UTF-8 Git stdout through PowerShell text decoding/Out-String before writing UTF-8. This is the likely encoding cause. Root reproduced the reported 18,241-byte JavaScript size by decoding original UTF-8 as CP437/CP850 and converting line endings to Windows CRLF. That reproduces the diagnostic pattern, but does not prove the owner's exact code page or file bytes. The ASCII comparison is still never an acceptance substitute.

scripts/prepare-stage-2-contact.ps1 now reads pinned Git blobs through Node execFileSync as Buffers and writes them byte-for-byte. It validates reviewed canonical JavaScript/HTML fingerprints before public preparation and again afterward. Repair mode uses MUSHAVO_STAGE2_CONTACT_REPAIR_FROM for the existing prepared web directory and privately reuses its one real-format public Turnstile key. The same staging config and other allowlisted public bytes are preserved; only reviewed contact overlays and regenerated headers are used in a new candidate folder. The old folder and checkout remain unchanged. This correction is public-asset preparation, with no requested hosted database migration or Edge deployment.

Both owner file-read helpers now request /contact, the documented Cloudflare Pages extension-less HTML route. The earlier diagnostic deliberately rejected redirects, which could explain ASSET_READ_FAILED for /contact.html; no actual redirect receipt was returned by that diagnostic, so its precise failure cause remains unknown. Exact candidate hashes and staging guards remain unchanged.

All 45 focused tests pass: the existing 32 runtime/header checks, 10 API/file diagnostic checks and 3 new preparation checks. The new tests execute the exact PowerShell-embedded Node extractor against a real temporary Git repository, starting with deliberately damaged Unicode. They confirm byte-preserving pinned extraction, exact repaired fingerprints, existing-key/config reuse and source preservation; modified pinned content and a missing existing public key stop before public output creation. The PowerShell loader itself is ASCII-safe. Windows PowerShell execution and the repaired hosted upload remain owner-pending.

Owner handoff: in the existing checkout, fetch the audit branch, load the pinned ASCII preparation script with git show, set the pinned commit and MUSHAVO_STAGE2_CONTACT_REPAIR_FROM to the existing Contact web folder, and run via ScriptBlock. On STAGING_CONTACT_ENCODING_REPAIR_PREPARED with both reviewed_contact_*_match values true, upload only the newly printed web folder to the existing mushavo-budget-staging Pages project using Production within that staging project. Send the preparation JSON and deployment receipt, then resume the same acceptance batch. If preparation fails, stop and send the error. This remains the existing one 2.2.3 work item; F09 stays open and Stage 2 reporting is due at 2.4.
