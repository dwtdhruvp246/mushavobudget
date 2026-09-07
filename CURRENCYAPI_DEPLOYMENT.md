# CurrencyAPI deployment for Mushavo Budget

This release keeps the CurrencyAPI credential entirely inside Supabase Edge Function secrets. The browser calls Mushavo's authenticated Edge Function only; it never calls CurrencyAPI directly.

## Before deployment: rotate the exposed key

The original key was pasted into a chat message. Treat it as exposed even though it was not copied into these project files.

1. Sign in to CurrencyAPI.
2. Open the API keys/credentials area.
3. Revoke or regenerate the exposed key.
4. Keep the replacement key private. Do not add it to `config.js`, HTML, JavaScript, SQL, GitHub, Cloudflare Pages variables, screenshots, or chat.

## What is the Supabase project ref?

The project ref is the short identifier before `.supabase.co` in your Supabase URL.

For example, if the URL in `config.js` is:

```text
https://abcdefghijklmnopqrst.supabase.co
```

then the project ref is:

```text
abcdefghijklmnopqrst
```

You can also find it in Supabase Dashboard → Project Settings → General → Reference ID, or in the browser address after `/project/` when the project dashboard is open.

## 1. Apply the global currency catalogue migration

For an existing Mushavo Budget database:

1. Open the same Supabase project used by `config.js`.
2. Open SQL Editor → New query.
3. Paste the complete content of `supabase/migrations/20260905090000_expand_global_currencies.sql`.
4. Select Run and confirm there is no error.

Do not rerun the full schema merely to add these currencies. For a brand-new database, the complete `supabase/schema.sql` already contains the expanded catalogue. The migration is rerunnable and preserves all existing amounts, currencies, settings and historical records.

### Apply signup currency preferences

After the global catalogue migration succeeds, run this migration once in a new SQL Editor query:

`supabase/migrations/20260905120000_signup_currency_preferences.sql`

This safely adds the public signup catalogue and initializes future Personal workspaces with the user-selected default and additional currencies. Existing workspace settings are not overwritten. The migration is rerunnable.

## 2. Install and link the Supabase CLI

From the root of the extracted Mushavo Budget folder:

```text
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

`npx` downloads/runs the Supabase CLI without requiring a global install. The login command opens a browser or asks for a Supabase access token. The link command connects this local folder to the correct project.

Confirm the link before continuing:

```text
npx supabase projects list
```

## 3. Generate the scheduler secret

This is a new random secret used only to prove that a scheduled request came from your Cron job. It is not the CurrencyAPI key.

macOS/Linux/Git Bash:

```text
openssl rand -hex 32
```

Windows PowerShell:

```text
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```

Copy the output temporarily. You will use the exact same value in Steps 4 and 6.

## 4. Add protected Edge Function secrets

Run this locally. Replace the placeholders in your terminal only:

```text
npx supabase secrets set CURRENCYAPI_API_KEY="PASTE_THE_NEW_ROTATED_KEY_HERE" CURRENCY_SYNC_SECRET="PASTE_THE_RANDOM_SECRET_FROM_STEP_3_HERE"
```

Supabase automatically supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Do not manually put any service-role credential in browser code.

Verify only the secret names:

```text
npx supabase secrets list
```

The output should include `CURRENCYAPI_API_KEY` and `CURRENCY_SYNC_SECRET`. Never print or share their values.

## 5. Deploy the Edge Function

```text
npx supabase functions deploy sync-exchange-rates --no-verify-jwt
```

`verify_jwt` is disabled at the gateway because the function supports both Cron and admin calls. The function itself still authenticates every request: Cron must supply the scheduler secret, and a manual browser request must contain a valid Supabase user token for a Finance-capable admin.

If deployment or a run fails, open Supabase Dashboard → Edge Functions → `sync-exchange-rates` → Logs. The implementation redacts API-key patterns, query credentials, and provider URLs from stored error text.

## 6. Create the twice-daily Cron job

Open `supabase/cron-currency-rates.sql` in a text editor and replace:

- `YOUR_PROJECT_REF` with the project ref from above.
- `REPLACE_WITH_THE_SAME_RANDOM_CURRENCY_SYNC_SECRET_USED_BY_THE_EDGE_FUNCTION` with the random value generated in Step 3.

Do not place the CurrencyAPI key in this SQL file. Then paste the complete SQL into Supabase SQL Editor and run it once.

The schedule is `15 0,12 * * *`, which means 00:15 and 12:15 UTC every day—02:15 and 14:15 in Zimbabwe (CAT/UTC+2).

After it runs, remove the random secret value from your local edited copy or delete that temporary edited copy. The committed template contains placeholders only.

## 7. Perform the first rate sync

1. Sign in to Mushavo Budget as Super Admin, Admin Staff, or Finance Staff.
2. Open Admin → Finance.
3. Select the currencies Mushavo accepts and the Finance reporting currency.
4. Save Finance currencies.
5. Select Sync rates now.

The status panel should show a successful attempt, provider-effective time, number of currencies stored, and the twice-daily schedule. The button is rate-limited to one manual run per five minutes and concurrent runs are rejected safely.

The sync requests CurrencyAPI's complete fiat dataset and stores every matching catalogue rate. If CurrencyAPI does not yet return a newer national code, the run records a safe partial warning while still updating every available currency. Original transactions remain usable and that unavailable conversion is never guessed.

## 8. Verify that the key is not exposed

In the deployed website:

1. Open browser developer tools → Network.
2. Reload Admin → Finance and run Sync rates now.
3. Confirm the browser requests only your Supabase function URL.
4. Confirm there is no browser request to `api.currencyapi.com`.
5. Open Sources and search for `CURRENCYAPI_API_KEY`, `cur_live_`, and the replacement key. None should exist in public assets.

## 9. Functional checks

1. Save a workspace with USD, INR, ZAR, and ZWG enabled.
2. Add payments in at least two currencies and confirm each list row includes its ISO currency code.
3. Record a partial payment and confirm it uses the obligation currency.
4. Open Reports → Original currencies and confirm totals are separated by currency.
5. Switch to Converted reporting currency and confirm a consolidated estimate is labelled with the rate status.
6. Record a completed payment and confirm its conversion row is stored in `payment_conversions` and remains unchanged after another sync.
7. In Admin Finance, approve a subscription payment and confirm original and locked converted values are shown.
8. Export both CSV files and confirm they contain original currency, converted currency, rate, rate date, and source.
9. Temporarily use an invalid provider key, sync once, restore the real secret, and confirm the previous successful rate snapshots remain available.
10. Confirm a non-admin cannot read Admin Finance settings, sync diagnostics, or platform payment conversions.

## 10. Diagnose scheduled runs

In SQL Editor:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'mushavo-currency-rates-twice-daily';

select status, started_at, completed_at, provider_effective_at,
       rates_stored, safe_error_summary
from public.exchange_rate_sync_runs
order by started_at desc
limit 10;

select *
from net._http_response
order by created desc
limit 10;
```

- No sync row: check that the Cron job is active and the Vault URL is correct.
- Authentication failure: the Vault secret and Edge Function `CURRENCY_SYNC_SECRET` differ.
- Provider rejection: rotate/check `CURRENCYAPI_API_KEY` and review the safe function log.
- No rates stored: confirm the global currency migration ran, inspect `supported_currencies`, and review the Edge Function's safe log.
- Stale warning: run a manual sync, then inspect the latest safe run result.

## Secret rotation later

Generate a replacement key in CurrencyAPI and run:

```text
npx supabase secrets set CURRENCYAPI_API_KEY="THE_NEW_KEY"
npx supabase functions deploy sync-exchange-rates --no-verify-jwt
```

No frontend upload or database migration is required when only the provider key changes.
