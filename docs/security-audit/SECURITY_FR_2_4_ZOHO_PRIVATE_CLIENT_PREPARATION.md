# FR.2.4.E3.3 — private Zoho client preparation

15 October 2026, FRE48. The three requested owner details have been received: the normal Zoho inbox host is reported as mail.zoho.com, the existing notification sender mailbox is accessible, and the staging Cloudflare Pages dashboard lists Durable Object as a binding option. The custom email domain is not the API host. These reports permit the next setup step; they do not prove an OAuth grant, account API eligibility, an authorized From address, a deployed namespace or email delivery. [Owner receipt](security-fr-2-email-hosted-readiness-owner-result.json).

## Owner action — Zoho API client only

No SQL or terminal command is required in this step. Use a private browser window so the Zoho account is explicit.

1. Sign in to Zoho as the existing notification sender mailbox account, rather than the primary or recovery Mushavo operator. Confirm the signed-in account privately. This is a Zoho mailbox login, not a new Mushavo Auth user.
2. Open https://api-console.zoho.com/ . Confirm the console remains on that hostname and uses the intended notification account. If it redirects to another regional API-console host, return only that hostname before continuing; the present source adapter supports the .com endpoint pair only.
3. If there is no existing Self Client, choose Get Started or Add Client, then Self Client, Create Now, Create and OK as shown. This registers the OAuth client and displays Client ID and Client Secret. If a Self Client already exists, report EXISTING and leave its credentials/configuration unchanged; do not reset or delete it. Its other uses must be understood before deciding whether it can safely be used for this staging sender.
4. Keep the Client ID and Client Secret private in the API console or the owner's password manager. Do not paste them into chat, Git, source config, a public upload folder or a screenshot. Do not generate the short-lived authorization code yet; its exchange needs the next private terminal helper ready. No token, sender API call, email or Cloudflare upload is requested now.

Safe reply:

```
Zoho notification account selected: YES / NO
API console hostname: api-console.zoho.com
Self Client: CREATED / EXISTING / UNAVAILABLE
Client ID and Client Secret kept private: YES / NO
```

If an account restriction or upgrade prompt prevents this, return UNAVAILABLE and the nonsecret wording; no plan purchase or account-wide policy change is requested. Client creation is not a send-mail authorization or an API/delivery acceptance test.

## Subsequent private setup design

The next helper must accept secrets through private prompts, submit OAuth material in a POST body, bound response sizes and timeouts, avoid redirects and print only an allowlisted receipt. The expected limited scopes are ZohoMail.accounts.READ for identifying the authorized sender account and ZohoMail.messages.CREATE for sending a code; no message-read, delete, organization-management or broad ALL scope is planned. The account-read response contains private mailbox metadata and must never be returned raw. A successful provider acceptance response would still require a separate controlled inbox-delivery check.

The authorization-code grant is short lived, so do not generate one until its local exchange command is ready. Refresh tokens and client secrets remain private runtime secrets. A production sender grant must not be silently repurposed or rotated during staging setup. The future gateway remains controlled-recipient-only until application integration and acceptance justify expanding its scope.

E4 canonical schema/migration, login UI and all RLS/RPC/Edge/Storage/Admin entry-point guards remain required. No existing application data guard is removed by this setup. The previous authenticator/factor-review instructions remain paused. No operator role has been promoted. Existing offline checkpoints remain E2 46PASS, E3.1 63PASS and E3.2 31PASS, with no routine rerun required. No source implementation, hosted database, account role, email setting or Cloudflare resource was changed by this record-only checkpoint. All 20 full findings remain open; production is excluded and APK/native work stays deferred.

Official instructions checked 15 October 2026:
- Self Client creation and intended own-account backend use: https://www.zoho.com/developer/oauth/self-client/overview.html
- Short-lived code and token exchange: https://www.zoho.com/developer/oauth/self-client/authorization-code-flow.html
- Account metadata scope: https://www.zoho.com/mail/help/api/get-all-users-accounts.html
- Send scope and sender endpoint: https://www.zoho.com/mail/help/api/post-send-an-email.html
