# 1.3.5 — Synthetic staging acceptance checks

Staging only: dczlddwbtgvfdujgcitb and https://mushavo-budget-staging.pages.dev. Production kttkospkblwvguuwnhjj is excluded. Two disposable synthetic users are sufficient for this checkpoint; no production credentials/rows are requested.

## Entry evidence

Owner reported native 51-migration setup success, local frontend preparation, staging Pages URL, and deployed config metadata: staging_url_matches / publishable_key_format / push_key_empty / production_reference_absent all true. Owner then explicitly confirmed staging Site URL and four redirect entries saved, Confirm email on, custom SMTP off, Google disabled, no Edge functions or production secrets added. Record owner evidence; key format alone is not key ownership proof. Four booleans cover the fetched config file, not every runtime network request. No independent root hosted connection occurred.

## Five finite check groups

| Check | Evidence required | Initial state |
|---|---|---|
| A Test accounts/sign-in | Two manually created confirmed staging users can sign in through the deployed app | Pending |
| B Synthetic persistence | First account creates a uniquely marked USD 20 payment and sees it after reload | Pending |
| C Cross-account UI | Second account has its own personal workspace and cannot see first account's marker | Pending |
| D Data API access boundary | Seed-present allowed owner read and denied outsider/anonymous read/write checks, actual API results | Pending; UI visibility alone insufficient |
| E Scoped integration/isolation | Staging-only runtime origin, no production account/data imported, disabled dispatch boundaries and limitation report | Pending |

Create users manually in staging Dashboard Authentication > Users > Add user > Create new user, with private test passwords and Auto Confirm User checked. Suggested reserved fictional addresses: audit.owner@example.com and audit.outsider@example.com. Explicit confirmation of these manually created synthetic users does not change the global Confirm email toggle. Do not send invitations or exercise signup/recovery email flows in this checkpoint.

Use the deployed staging app to sign in as the first account and create a personal payment named AUDIT-S135-OWNER-ONLY with amount 20 USD. Prefer the existing Payment done option (one-off) to avoid scheduled reminders. Reload and verify persistence. Sign out and sign in as the second account; verify a separate personal workspace and absence of the marker. Record each operation's actual outcome, including errors, rather than presume successful provisioning. Never grant app_admin/business owner/family access merely to make this personal-scope test pass.

Follow-up D must use authenticated owner and outsider API sessions against staging plus anonymous requests. A missing seed, unreachable API or empty owner result is not a deny PASS. Tokens, passwords and raw user records remain local; return only categorical summaries/redacted errors. Preparation of that follow-up depends on the actual first user/seed creation outcome.

Mail/push/currency-provider dispatch and Edge invitation workflows remain disabled/unverified and outside this checkpoint. Family/business/custom-role matrices are not proved by a two-personal-account smoke test. Storage bucket creation is not Storage object role acceptance. No full restore proof, production schema parity or full audit acceptance follows. Carry these limitations to the 1.3 checkpoint and later audit stages, without automatically expanding this finite setup step.

## Owner UI outcome and direct API preparation

Owner first returned empty outcome labels, which were not counted as evidence, then explicitly replied "all five passed". Record A/B/C at owner-report scope: both sign-ins, first user's seeded payment retained after reload, second user's separate Personal workspace and hidden first-user payment. These are not direct database deny results.

The direct verifier targets payment_items and its matching payment_records, not the unrelated platform payments table. It loads deployed public config, restricts its Supabase URL to staging, accepts only a publishable key and no push key, signs in two synthetic users and verifies each Auth identity. Owner must have exactly one personal USD 20 AUDIT-S135-OWNER-ONLY item and one corresponding paid record, with an owner-owned personal workspace. Missing/ambiguous/mismatched seeds fail closed. No raw records, identifiers, emails, passwords or tokens appear in the result.

One same-name owner PATCH is a positive control; outsider and anonymous same-name PATCH requests must affect no row or produce PostgreSQL privilege denial, alongside denied item and paid-record reads. Such a PATCH can run update triggers/timestamps on the synthetic owner row, but does not intentionally change its name, amount or currency. No insert/delete operation or workflow RPC is tested. Generic server errors, invalid JWTs and missing seeds are not deny PASS. Final owner read checks selected values retained; test records remain in staging. Locally issued test sessions are signed out at the end, and the PowerShell wrapper clears password environment variables. UI sessions are independent.

Disposable mock verification PASS: normal seeded positive/negative sequence; missing seed, exposed read, allowed outsider write and HTTP 500 all REVIEW; wrong project/secret key and invalid JWT denial rejection; session logout and sensitive-output omission. This checks verifier behavior, not live RLS or real hosted server results. Live owner execution remains pending.
