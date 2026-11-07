# 1.1 — Account security and recovery checks

Started 7 October 2026 following owner approval of Stage 0 closure and Stage 1. The initial checks **inspect current state**. Owner-performed account changes and their verification are recorded separately; no provider setting or credential is changed by the assistant. Normal sign-in checks completed with carry-forward on 7 October 2026; current work is [1.2 external protection](SECURITY_STAGE_1_2_BACKUP_INVENTORY.md). Recovery/identity gaps remain open.

## Current results — 7 October 2026

Evidence [S1E01](security-stage-1-evidence.json): the owner supplied the GitHub two-factor settings screenshot after completing the first check. Authenticator app shows **Configured**; GitHub Mobile shows **Configured — 2 devices**; preferred method displays **Passkeys**; recovery codes show **Viewed**. Record **PASS at displayed GitHub MFA configuration scope**. The screenshot does not show a fresh sign-in or prove recovery codes were saved securely and remain accessible. Passkey/security-key inventory and account/repository ownership are not established by the crop. No full recovery or F08 closure is inferred.

Evidence [S1E02](security-stage-1-evidence.json): the owner confirms **GitHub recovery codes saved**. This supersedes the storage-unconfirmed outcome at owner-report scope; no fresh sign-in, storage-access test or recovery drill is inferred. The Cloudflare screenshot explicitly shows **Two-Factor Authentication — Inactive**, with Security Key/Mobile App **Add** and Email Authentication **Enable**. Record **FAIL — Cloudflare 2FA inactive** at displayed configuration scope, carried forward under F08. No factor setting is changed by this inspection.

Evidence [S1E03](security-stage-1-evidence.json): the owner clarifies **Google sign-in to Cloudflare**, with enrollment blocked by the Cloudflare password prompt. The prior local 2FA **Inactive** observation remains; Google-account MFA/recovery is unverified. Cloudflare’s [official social-login guidance](https://developers.cloudflare.com/fundamentals/user-profiles/login/) documents that social-login profiles initially lack a Cloudflare password and some operations, including MFA enrollment, require setting one via **Forgot Password** for the existing profile email. This is a supported prerequisite, not proof enrollment succeeded or that Google protection is absent.

Evidence [S1E04](security-stage-1-evidence.json): the owner says Cloudflare **email authentication enabled** and **recovery codes obtained**. Record **OWNER-PASS at reported factor-configuration scope**, superseding the prior current Inactive/password-blocked state without deleting history. Secure persistent code storage, active-setting screenshot, fresh factor challenge and actual recovery remain unverified. No specific password-setting sequence is inferred. The owner chose a supported email factor; do not record an authenticator app or security key as configured.

Evidence [S1E05](security-stage-1-evidence.json): the owner confirms **Supabase email sign-in** and **authenticator-app MFA completed**. Record **OWNER-PASS at dashboard-account configuration scope**; no exact email/password versus OTP mechanism, independent backup factor, fresh post-enrollment MFA sign-in or recovery drill is inferred. This does not enable app-user/Admin MFA or organization-wide enforcement. Supabase’s current account-MFA guidance provides no recovery codes and recommends separate backup TOTP access; the owner’s backup availability is pending.

Evidence [S1E06](security-stage-1-evidence.json): the owner replies **Supabase — no** to backup availability and confirms **Zoho Mail MFA enabled**. Record Supabase backup access as owner-reported unavailable and carry forward independent backup authentication under F08; do not interpret this as proof Supabase cannot support a backup TOTP factor. Zoho Mail MFA is **OWNER-PASS at enabled-setting scope**. Its factor type, backup route and whether the same account administers CPaaS/sending remain unconfirmed. All four providers have scoped configured/enabled evidence; no fresh sign-in/recovery results are yet supplied.

Evidence [S1E07](security-stage-1-evidence.json): following the fresh-sign-in instructions, the owner reports Cloudflare **email verification PASS**, GitHub **passkey PASS**, Supabase **authenticator-app PASS** and Zoho **authenticator-app PASS**. Record **OWNER-TESTED PASS for the four reported normal methods**; Zoho’s factor type is now supplied. Private-window execution and assurance enforcement are not independently observed; no alternate-path denial, recovery drill or overall security/F08 clearance is inferred. Normal sign-in checks are complete with carry-forward, and [1.2](SECURITY_STAGE_1_2_BACKUP_INVENTORY.md) starts next.

| Provider | MFA inspection | Private recovery availability | Remaining evidence |
|---|---|---|---|
| GitHub | Configuration PASS; passkey sign-in OWNER-TESTED PASS | Owner confirms codes saved | Actual recovery and alternate-path/ownership proof remain separate |
| Cloudflare | Email-factor configuration and sign-in OWNER-PASS | Codes obtained; persistent storage not explicitly confirmed | Actual recovery, saved-code confirmation and Google/alternate-path protection pending |
| Supabase | Authenticator MFA/configuration and email-based sign-in OWNER-PASS | Owner reports no backup authentication available — GAP | Independent private backup authentication and actual recovery proof carried forward |
| Zoho Mail | Authenticator MFA and normal sign-in OWNER-PASS | Unconfirmed | Backup access, actual recovery and CPaaS administering identity remain unverified |

## Handoff to 1.2

The owner reports all requested normal sign-in outcomes PASS. Keep the historical instructions/results above and the recovery/identity gaps in the central register; no further factor enrollment or recovery-code use is requested to close this check. Current action is the [read-only Windows version inventory for 1.2](SECURITY_STAGE_1_2_BACKUP_INVENTORY.md). Support mailbox/incident-contact ownership remains a foundations operational follow-up, not a completed test.

## Cloudflare Google-sign-in password prerequisite

The owner encountered this during their own enrollment attempt. If resolving it now, keep the working session available and open Cloudflare’s **Forgot password** flow in another tab. Use the email already shown in the existing Cloudflare profile, follow the owner-held reset email and set a separate Cloudflare password. Verify email/password access to the existing account, then return to **My Profile → Authentication → Mobile App Authentication → Add**, complete the factor prompt and save recovery codes privately. Supply only active/inactive status and saved-code confirmation; no password, reset link, QR or recovery code is shared here. Cloudflare’s Google sign-in is recorded separately. S1E04 subsequently reports email-factor enablement; this earlier password guidance is retained as historical instruction, not a new request to repeat setup.

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

The previous owner statement “i think only for github” remains historical tentative evidence. S1E01 confirms the displayed GitHub MFA configuration; S1E02 adds owner-confirmed GitHub recovery-code storage and observed Cloudflare inactive 2FA. S1E04 reports Cloudflare email MFA enabled and S1E05 reports Supabase email sign-in/authenticator MFA. S1E06 records Zoho Mail MFA enabled and Supabase backup authentication unavailable at owner-report scope. S1E07 supplies Zoho’s authenticator method and all four normal sign-in PASS results. Sender identity, remaining recovery/ownership arrangements and actual recovery proof remain pending. Fresh sign-in/recovery evidence and any approved later hardening are separate steps. A disabled or unknown setting is recorded in the carry-forward register; it does not automatically become PASS or silently trigger factor replacement.

After the actual sign-in paths/status are established, verify independent recovery without sharing its contents and assess support/incident contact. Supabase's dashboard-account MFA guidance describes backup TOTP factors rather than downloadable recovery codes, so do not insist every provider must use the same recovery method. App Admin MFA remains the separate Stage 3 requirement.

## Primary instructions checked 7 October 2026

- [GitHub 2FA settings](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication)
- [Cloudflare profile 2FA](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/) and [social-login/password prerequisite](https://developers.cloudflare.com/fundamentals/user-profiles/login/)
- [Supabase dashboard-account MFA](https://supabase.com/docs/guides/platform/multi-factor-authentication) and [production sign-in guidance](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Zoho account MFA](https://help.zoho.com/portal/en/kb/accounts/faqs-troubleshooting/faqs/multi-factor-authentication/articles/how-do-i-enable-mfa-for-my-account)
