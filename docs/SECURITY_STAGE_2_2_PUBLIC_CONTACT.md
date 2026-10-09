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

## Owner staging setup — 2.2.3 / S2E16

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
