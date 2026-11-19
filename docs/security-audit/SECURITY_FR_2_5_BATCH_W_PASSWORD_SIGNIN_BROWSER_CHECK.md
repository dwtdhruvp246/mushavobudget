# Password sign-in backend installed — browser check next

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner supplied **PASSWORD_SIGNIN_ALL_USERS_ENABLED_STAGING**, with all-role/Admin inclusion, custom code and browser trust false, initial email confirmation true, catalog identity matched, 148 guarded RPCs, 82 restrictive policies and eight retired dispatch RPCs. [Exact owner receipt](security-fr-2-batch-w-owner-password-signin-install.json). This completes the backend installation checkpoint; the SQL's hosted_acceptance false remains accurate for the pending browser/product checks.

The corrected SQL source is 0073292982cfa4b644d7cfaf5efa88e10f740af7. Do not rerun installation, prepare another ZIP, reopen acceptance windows, change recipients or send custom sign-in codes for this checkpoint.

## Next owner action — existing AU03.01

1. If the previously prepared **mushavo-password-signin-staging.zip** is not uploaded, upload that existing ZIP to **mushavo-budget-staging** first. The SQL line-ending correction changes no frontend or Worker assets and requires no rebuild. A new ZIP preparation/deployment receipt has not been supplied; this is an upload condition, not a claim that no upload occurred.
2. Open [the staging app](https://mushavo-budget-staging.pages.dev/app.html), sign in with the existing confirmed account and expect the authorized dashboard with no custom code, Verify your sign-in or trust-device page. Keep the password private.
3. Sign out and reload. Expect the ordinary sign-in form.
4. Return the dashboard/signout-reload outcome and the Cloudflare deployment URL. This establishes which frontend was tested; no additional confirmation of the already authorized all-role policy is requested.

AU03.01 and the existing signout/reload regression are not credited as browser passes before that result. Admin-role and tenant-isolation behavior are not inferred from the ordinary account check or the install JSON. The original 31 AU definitions and all prior results, including AU05.03 owner PASS, remain unchanged. The previous 17 SQL/8 package checks and 100 unchanged runtime checks retain their original pins; this is documentation only with no new tests or hosted assistant requests.

Signup confirmation, recovery and existing roles/ownership/membership remain. No Auth user/password/factor, secret, provider or account action is requested. V remains on hold pending policy reconciliation; stronger-MFA findings are not satisfied by password-only Admin sign-in. Password-mismatch prominence stays deferred. Full W/FR.2/Stage 3/re-audit/release remain open; production/native unchanged and APK deferred. Keep the stage prefix visible in every update.
