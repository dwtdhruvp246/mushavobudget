# Mushavo Budget consolidated source update

Release date: 5 September 2026

This package consolidates the latest source files produced through the current
Mushavo Budget build. It is intended to be extracted over the existing project
folder so older local copies are brought up to date before the Stage 0 Git
checkpoint is created.

## What this package contains

- the latest public website and authenticated application files;
- the latest mobile layout, scrollable menu, dashboard currency conversion and
  assigned-to-me fixes;
- direct browser-to-Supabase enquiry submission with no enquiry Edge Function;
- global currencies and signup currency preferences;
- every-N-day and every-N-month payment scheduling;
- the CurrencyAPI synchronization Edge Function and its test;
- the complete current Supabase schema and all retained migrations;
- the Stage 0 PWA/Web Push audit, diagnostic and roadmap.

## Safe replacement procedure

1. Do not delete the existing project folder.
2. Make a normal Windows copy of `C:\Users\HP\Desktop\Mushavo Budget` and name
   it `Mushavo Budget - before consolidated update`.
3. Extract this ZIP into a temporary folder.
4. Copy everything inside the extracted folder into
   `C:\Users\HP\Desktop\Mushavo Budget`.
5. Choose **Replace the files in the destination** when Windows asks.
6. Keep the existing `.git` folder, `.github` folder, `package.json` and
   `package-lock.json`; this update intentionally does not replace them.

## Obsolete files to remove after extraction

Move the following items out of the project if they exist. They are not part of
the current source of truth:

- root-level `schema.sql` (the authoritative file is `supabase/schema.sql`);
- root-level `DELETE_THESE_FILES.txt`;
- root-level `SHA256SUMS.txt` from an older release;
- `supabase/functions/submit-enquiry/`;
- `supabase/functions/send-reminders/`;
- `supabase/functions/.env.example`;
- `supabase/cron.sql`;
- `supabase/migrations/20260828090000_web_push_notifications.sql`.

Do not remove `supabase/functions/sync-exchange-rates/`,
`supabase/cron-currency-rates.sql`, `sw.js`, `public.notifications`, or the
CurrencyAPI Vault secrets and scheduled job.

## Git checkpoint

After replacement and cleanup, run:

```powershell
git add -A
git status --short
git diff --cached --stat
```

Review the result before committing. The intended checkpoint message is:

```text
checkpoint: before PWA web push rebuild
```

Do not push or deploy merely to complete Stage 0. The first checkpoint can stay
local.
