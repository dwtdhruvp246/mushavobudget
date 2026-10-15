# Current checkpoint — three setup facts received; private Zoho client preparation next

15 October 2026, FRE48. [Owner readiness receipt](security-fr-2-email-hosted-readiness-owner-result.json) records mail.zoho.com, notification-mailbox access YES and staging Durable Object option AVAILABLE, all owner reported. [Private Zoho client preparation](SECURITY_FR_2_4_ZOHO_PRIVATE_CLIENT_PREPARATION.md): select the notification Zoho account, create Self Client if absent or report an existing client without resetting it, and keep credentials private. No SQL, terminal, short-lived code, email, token exchange or Cloudflare upload requested at this step. E2/E3.1/E3.2 offline results remain preserved; hosted acceptance and E4 global guard/canonical integration remain pending. No finding closure; production excluded and APK deferred.

---

# FR.2.4.E3.3 — actual setup readiness: three read-only owner details

15October2026,FRE47. [Owner Windows31PASS](security-fr-2-email-workers-owner-Windows-result.json), [readiness contract](security-fr-2-email-hosted-readiness-contract.json). Source commitd89d8ca49b738fb29a4812fcd30b1ee26e9c3a87.

## E3.2 Windows checkpoint complete

Owner Node22.17.0 returned31tests/31PASS/0fail,exit0;16source SHA256 matches,exact tools-lock SHA256 match and12syntax checks. Actual esbuild0.28.2and Miniflare4.20260730.0/workerd1.20260730.1 executed successfully on Windows. Both generated bundle hashes exactly match the pinned assistant outputs:Pages fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99;limiter4d10a3f6ea03ab14979b1d821df2c35409d519b0550da8bd4a92f4b28d37b0a1. The native local SQLite limiter passed simultaneous-request,shared-binding and complete runtime-restart persistence checks. Temporary runtime/state cleanup completed. Npm installed30platform-applicable packages under the isolated tools folder with scripts disabled. Installed dependency bytes were not independently hashed;lock metadata/source/output hashes were checked.

No real Auth,Zoho or Cloudflare API request/email/hosted resource change occurred. The tests used local workerd,SQLite and synthetic upstream responses. E2Windows46PASS/59hashes and E3.1Windows63PASS/64hashes remain preserved;these checkpoints require no routine repeat. E3.2 is complete as local source/bundle/runtime evidence,not as hosted acceptance. Real elapsed-hour/alarm cleanup,hosted ingress/multi-location behavior and browser/native/full application guards remain carried.

## Next owner action: inspect only

No SQL or terminal command is needed for this checkpoint. Three nonsecret facts are required because the real account setup cannot be inferred from a passing local test.

1. Open the normal Zoho Mail inbox and return only its hostname,for example mail.zoho.com or mail.zoho.eu. Do not return the full signed-in link/query or mailbox contents. The current adapter deliberately supports only accounts.zoho.com/mail.zoho.com;another region needs a reviewed endpoint adaptation before private setup.
2. Check whether the existing notification-role Zoho mailbox can be opened normally. Return YES,NO or UNSURE. The notification mailbox is the proposed sender using an address the owner already maintains. No message needs sending and no new Mushavo Auth identity needs creating. Mailbox access alone does not verify OAuth API grant/authorized From eligibility,quotas or delivery.
3. In Cloudflare Workers & Pages,select only mushavo-budget-staging,then Settings > Bindings > Add. Inspect whether Durable Object is listed. Return AVAILABLE or NOT_VISIBLE;selecting/saving a binding,creating a Worker/namespace,adding a secret or uploading a ZIP is not requested. An empty namespace list is not an error at this stage,because the separate candidate limiter Worker has not been deployed. This owner UI observation is not independent account/feature/deployment verification.

Suggested safe reply:

```
Zoho inbox hostname:
Notification mailbox accessible: YES / NO / UNSURE
Cloudflare Durable Object binding option: AVAILABLE / NOT_VISIBLE
```

No password,API key,OAuth client secret,refresh token,account identifier,recovery material or inbox screenshot is requested. The next private setup instructions must be tailored to these facts and must keep secrets out of Git/chat/audit receipts. Mailbox/namespace eligibility and account costs still need checking before any paid-resource decision;no subscription change is requested here.

## Integration commitment

The owner asked whether staging fixes will reach the actual files. The reviewed candidate implementations are already real Git source on security/stage-3-authorization. Recent terminal commands export source into temporary directories and therefore do not replace the normal local working folder or main branch. Earlier targeted hosted staging database repairs are separate evidence;these email batches have not installed the email backend or global gate into hosted staging. E4must integrate the candidate with canonical schema/versioned migrations,existing login/remember UI and every applicable RLS/RPC/Edge/Storage/Admin data-entry guard. Passing local checks alone does not mark that integration complete. The final controlled merge/deployment sequence remains required after coordinated acceptance;production is excluded now and APK/native update deferred.

Full release gate stays OPEN_PENDING_REQUIRED_EVIDENCE,final re-audit PLANNED_NOT_PERFORMED,all20original full findings open. Original stage0-10objects,123coverage rows,prior evidence/actions/decisions and other remediation steps remain preserved. No implementation source changes are made by this record-only checkpoint.

Source for Cloudflare binding UI and separate Worker requirement,checked earlier15October2026:https://developers.cloudflare.com/pages/functions/bindings/. The owner must inspect the actual account;the documentation is not evidence that its namespace/configuration exists. Source for Zoho sender/account API eligibility:https://www.zoho.com/mail/help/api/post-send-an-email.html . Real mailbox/data centre/API grant remain unverified.
