# Business identity and compact navigation — 4.9.30

Business owners choose a name and optional logo in the first Business setup step. Existing owners use Settings → Business details to rename the company, upload or replace its logo, or remove it. PNG, JPEG and WebP are accepted up to 2 MB and 4096 × 4096 pixels. No logo is required: company initials appear instead.

The company identity appears in the desktop sidebar, compact header and navigation drawer. “Business workspace” and “Powered by Mushavo Budget” remain visible. Staff see the saved company identity but cannot edit it. Personal and Family branding is unchanged.

At compact widths the Menu button opens a full-height drawer with grouped section links, active-page indication, company switcher and fixed account actions. Its middle section scrolls independently. Escape, close, selecting a section or tapping the backdrop closes it. Opening starts at the top.

## Backend

Apply `supabase/migrations/20261002070000_business_branding.sql` before deploying the frontend, then run `supabase/diagnostics/business_branding_diagnostic.sql`. All 20 diagnostic rows should report PASS. No Edge Function deployment is needed.

The private `business-logos` bucket permits uploads only from the current active Business Owner with an active subscription. Members can read attached logos for their own active Business; owners can read their unlinked uploads to clean them up. Attached files cannot be deleted directly. The protected branding RPC checks ownership, account/workspace/subscription access, the profile version, file location, stored MIME type and size. The setup wrapper saves details and branding in one database transaction. Name changes synchronize the workspace label and write an audit event.

Signed logo URLs last 10 minutes and refresh while the Business app is active. Changing workspaces discards the previous company's preview and rejects old responses. Private uploaded files are cleaned up after a confirmed replacement/removal. An upload whose save response is uncertain is retained privately to avoid deleting an image that may have been saved successfully.

## Validation

- `npm test` — 345 automated checks.
- `MUSHAVO_PGLITE_MODULE=/path/to/@electric-sql/pglite node scripts/verify-business-branding-sql.cjs` — disposable PostgreSQL: 27 behavior checks and all 20 diagnostic rows, including safe migration retry, owner/staff isolation, stale writes, expired/suspended accounts and atomic setup rollback.
- `MUSHAVO_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/verify-business-branding-ui.cjs` — full application code with offline backend fixtures at 1366×800, 680×720, 390×844, 320×640 and 680×380. Drawer navigation/scrolling, saved name, logo preview/save/remove, invalid types, staff editor visibility and old-workspace responses.

## Manual acceptance

1. Existing Owner: change name and upload a logo in Settings; save and reload. Confirm identity in sidebar/header/menu and the workspace selector.
2. New Business Owner: choose name/logo in first setup and continue. Complete setup and confirm the saved branding.
3. Staff: open the same company and confirm branding is visible and the editor is absent.
4. Compact screen: open Menu, scroll to Subscription & Billing and use Team/Settings; verify the close/sign-out actions remain reachable.
5. Switch between two companies with different branding; verify each company retains its own identity.
6. Remove a saved logo and reload; company initials should appear. Invalid image type/size should show an explanatory message.
