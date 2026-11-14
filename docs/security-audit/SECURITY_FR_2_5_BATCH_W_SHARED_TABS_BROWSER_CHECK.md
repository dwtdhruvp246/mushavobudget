# Shared normal tabs — deployed URL received, browser cycle next

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** [Owner receipt](security-fr-2-batch-w-owner-shared-tabs-package-and-deployment.json) records the exact preparation result: entry/manifest checks, 28 source identities, 42 files, app.js/app.html changed, 40 preserved, original ZIP unchanged, portable readback true, process/combined exit **0**. New ZIP SHA256 **6da3fff4dc55de8d0c76ed2d7635bcd8b915b3a5ad3bfe871475fef55838b169**; retained input SHA256 **37df1a67363e7fff5735ade834736bee1957963a1a73d7437d54425683cb12ab** is now owner-reported rather than guessed. Windows .NET readback is false, not relabelled. The source is pinned at **7005e81825049510aa8b45c08d21c42031328794**.

The owner also supplies [e39c66dd staging](https://e39c66dd.mushavo-budget-staging.pages.dev/). This is owner-reported frontend deployment evidence. The preparation's frontend_uploaded:false describes its pre-upload context and remains intact in the receipt. No provider status or independently served-source parity is inferred from the URL. One assistant public app.html read returned URL not accessible via this tool, with no HTTP/source metadata; no owner outage is inferred. No Auth/SQL/provider/email request was performed by the assistant. Prior 129 selected local passes retain their source pin; no source change or test rerun is needed for this receipt.

## One two-tab sign-in/signout/sign-in cycle — AU05.06

Open **the same new e39c66dd deployment URL** in two normal tabs of the same browser/profile. Use an existing controlled test account. Both tabs must use this exact origin; the older f8c4b8d6 URL/private profiles have separate browser storage and are not the paired test tabs.

1. Sign in in one tab if needed. Expect both tabs to show the same account's dashboard.
2. Sign out once in either tab. Expect both tabs to clear the dashboard and show sign-in automatically.
3. Sign in once more in either tab. Expect both tabs to open the same current account dashboard automatically **without refreshing the other tab**. This second sign-in exercises the corrected manual guard after the shared signout.

Report **all three pass**, or the specific step/message that differs. Maximum two manual password sign-ins and one signout for this cycle. No new code, recovery email, password save, SQL, settings, ZIP rebuild or upload. Never post credentials/tokens/private account data. A held or failed Auth logout must report its actual outcome; do not repeatedly submit attempts.

These observations credit only the shared normal-tab/sign-in/signout variant of frozen AU05.06. Do not infer full in-flight/Business role scopes, independent timing, immediate server JWT revocation, actual expiry/refresh behavior or full case/W completion from this cycle. Original 31 definitions remain unchanged and earlier tab-A-stays-signed-out observations remain historical under the superseded UX rule. Preserve AU05.03 owner PASS without repetition.

The AU04.06 real recovery-link test stays paused. The saved f8c4b8d6 recovery callback is historical configuration evidence for that origin and is not an allowance for e39c66dd; no new callback write or recovery email is requested now. Password-only all-role sign-in, signup confirmation, existing server role/tenant/session checks and isolated recovery/invitation adoption remain unchanged. V stays on hold with policy reconciliation before future factors; stronger-MFA criteria stay unmet. Password-mismatch visibility remains deferred. Full W/FR.2/Stage 3/re-audit/release/findings stay open; production/native unchanged, APK deferred.
