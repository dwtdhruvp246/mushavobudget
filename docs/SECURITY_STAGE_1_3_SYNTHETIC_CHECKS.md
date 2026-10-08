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
