# 1.1 — Account security and recovery checks

Started 7 October 2026 following owner approval of Stage 0 closure and Stage 1. These first checks **inspect current state**. No factor, password, API key, SMTP value, session or recovery configuration is changed by these instructions. Step 1.1 remains in progress pending observed/owner results.

## Check the actual provider accounts

Inspect the accounts that administer the repository, serving layer, Supabase project and transactional sender. Use the account's current login method; do not assume a separate password path exists when login is through another provider.

| Provider | Page to inspect | Outcome to record |
|---|---|---|
| GitHub | Profile picture → Settings → Password and authentication → Two-factor authentication | Enabled/disabled/unsure; factor type label only; private recovery method available yes/no/unsure |
| Cloudflare | Profile/My Profile → Authentication → Two-factor authentication | Enabled/disabled/unsure; factor type label only; private recovery method available yes/no/unsure |
| Supabase | Personal account settings → account MFA area; also identify whether dashboard login uses GitHub or email/password | Login method; account MFA enabled/disabled/unsure; private alternate/recovery method available yes/no/unsure. This is the dashboard account, not app-user Auth settings. |
| Zoho | Zoho Accounts → Multi-Factor Authentication | Enabled/disabled/unsure; factor label only; private recovery method available yes/no/unsure; confirm this is the account administering the mail/CPaaS agent |

If a page is unavailable or labels differ, state that or send a crop showing labels/status. Do not start enrollment merely to obtain a screenshot. If the account uses GitHub/another login provider, record the actual sign-in path so its protection is assessed correctly.

## Reply format

```text
GitHub: MFA [enabled/disabled/unsure]; recovery available [yes/no/unsure]
Cloudflare: MFA [enabled/disabled/unsure]; recovery available [yes/no/unsure]
Supabase: login [GitHub/email-password/other]; account MFA [enabled/disabled/unsure]; alternate/recovery available [yes/no/unsure]
Zoho: MFA [enabled/disabled/unsure]; recovery available [yes/no/unsure]
```

Status answers are sufficient for this inspection. Screenshots may show settings labels only: exclude QR codes, TOTP/setup secrets, one-time codes, backup codes, recovery email/phone details, tokens and passwords. Private recovery material is never sent here. Recovery availability is a separate check from successful normal sign-in.

## Result handling

The previous owner statement “i think only for github” is tentative evidence; it is not replaced until more specific results arrive. Fresh sign-in/recovery evidence and any approved later hardening are separate steps. A disabled or unknown setting is recorded in the carry-forward register; it does not automatically become PASS or silently trigger factor replacement.

After the actual sign-in paths/status are established, verify independent recovery without sharing its contents and assess support/incident contact. Supabase's dashboard-account MFA guidance describes backup TOTP factors rather than downloadable recovery codes, so do not insist every provider must use the same recovery method. App Admin MFA remains the separate Stage 3 requirement.

## Primary instructions checked 7 October 2026

- [GitHub 2FA settings](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication)
- [Cloudflare profile 2FA](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/)
- [Supabase dashboard-account MFA](https://supabase.com/docs/guides/platform/multi-factor-authentication) and [production sign-in guidance](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Zoho account MFA](https://help.zoho.com/portal/en/kb/accounts/faqs-troubleshooting/faqs/multi-factor-authentication/articles/how-do-i-enable-mfa-for-my-account)
