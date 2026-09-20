# Currency recovery 4.6.3

The reported provider HTTP 422 indicates validation failure, not a confirmed
expired key. The currently checked-in filters are documented as valid. The
deployed request and account response have not been inspected live.

This release uses the documented minimal USD-based request and filters returned
codes locally, trims surrounding secret whitespace, surfaces allowlisted error
fields without provider text, and refreshes auth before manual sync. Monetary
display uses two decimals. Exchange rates and historical records retain their
precision and are not rewritten.

After merging this release and updating the web deployment, run in PowerShell:

```powershell
cd "C:\Users\HP\Desktop\Mushavo Budget"
git pull --ff-only origin main
npx.cmd supabase functions deploy sync-exchange-rates --project-ref kttkospkblwvguuwnhjj --use-api
```

No SQL, Cron, Vault, or secret changes are required by this release. Do not paste
API credentials into chat or GitHub.

On web version 4.6.3, open Admin Finance and press Sync rates now once. Confirm
latest sync and provider dates, USD/INR conversion, and two-decimal monetary
display. Partial success may indicate unsupported currencies or unavailable
historical data; missing conversions must not be fabricated. If it fails, report
the new safe message. HTTP 401/403 needs key/account-access review; HTTP 429 needs
quota review; HTTP 422 needs the reported validation field checked. Production
recovery is pending this live test.
