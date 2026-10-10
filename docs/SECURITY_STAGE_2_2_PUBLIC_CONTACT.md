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

## Owner staging setup — 2.2.3 / S2E16–22

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
