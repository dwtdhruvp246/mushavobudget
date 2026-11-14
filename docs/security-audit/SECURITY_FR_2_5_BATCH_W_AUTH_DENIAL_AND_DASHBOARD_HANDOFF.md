> FRE217–FRE218,26October2026: **Stage 3/10 | FR.2/8 | Batch W/Z — corrected dashboard metadata recorded; no repeat command required.** Original owner run7589ab3 exited1 at OWNER_NO_CHANGES_CONFIRMATION because prompt15 was U; this did not prove an actual settings write. Preserve that original receipt/exit1. Owner subsequent text explicitly corrects9 answers and confirms view-only/no saved changes: server minimum6, no required character classes, no current-password requirement, reauthentication unknown, secure email change off, single-session/timebox/inactivity controls off. Existing email/signup/confirmation and canonical Site URL true reports remain; redirect category stays unknown. [Correction record and next narrow read-only check](SECURITY_FR_2_5_BATCH_W_CORRECTED_SETTINGS_AND_CALLBACK_CHECK.md). Corrected metadata has no new process/exit code and is not API/workflow acceptance. Pinned UI minimum12 differs from owner-reported server6; no setting has been changed to align them. All345 executed source identities and previous20/86 passes remain unchanged/reused. Next input is only the existing Redirect URLs category, no token, password, MFA, settings Save or terminal rerun. Reauthentication remains explicitly unknown. Last independently observed quarantine stays26October07:21:25.371UTC. V remains ON HOLD; full W/FR.2/Stage3/release remain open, five packages V–Z/Z final.

# Batch W — Auth configuration403 recorded; read-only dashboard summary next

**Stage 3/10 | FR.2/8 | Batch W/Z — STOPPED FOR REVIEW at the API permission boundary; dashboard fallback source review COMPLETE. V MFA remains ON HOLD for phone transfer.**

FRE215 records the owner run pinned to065bf628efe31559d480f451053630294691ae68: Node22.17,345 hashes/4 syntax checks,20/20 offline PASS/exit0. All5 hosted requests completed. Target200 and quarantined catalog201 passed before and after; Auth configuration GET returned403. The failure checkpoint is `READ_AUTH_SETTINGS`, not the final `TARGET_AFTER` checkpoint. `Auth_settings_read:false`/safe_settings:null means no current setting value was received. Combined exit1 is the permission denial; no app login/password/TOTP challenge/email/settings/account/session/factor/mode write occurred. No write outcome is uncertain and no further cleanup is indicated by this receipt.

The existing token works for the selected project/database requests. The official Auth config GET has its own read permission boundary: <https://supabase.com/docs/reference/api/v1-get-auth-service-config>. Do not infer a bad app password or unavailable authenticator from this403, retry the same GET, rotate the token or broaden its permissions. Current password policy is unknown; the old8-character dashboard report is historical, not a fresh setting. V remains separately deferred.

## Next combined owner action

Use the complete published-pin PowerShell supplied directly in chat. It fetches/verifies the security-branch commit, exports one temporary source snapshot and verifies the SHA256 of `scripts/review-fr-2-batch-w-dashboard.ps1` before executing its reviewed text in a child script block. It does not switch the checkout, repeat the20 tests, install a dependency, alter execution policy, request a token or call the Management/Auth APIs. It opens these3 fixed staging dashboard pages in the existing default browser:

- `https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/providers?provider=Email`
- `https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/url-configuration`
- `https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/sessions`

Existing browser access may be reused. If Supabase itself asks for normal dashboard sign-in/MFA, handle it only on Supabase using existing working access. No new factor setup/reset is part of this action. If access is unavailable, answer N/U to project confirmation and stop; do not disable MFA or guess settings. App operator MFA and Supabase dashboard authentication remain separate.

All15 terminal prompts are visible nonsecret summaries. Use Y/N/U for booleans; U means unknown, unavailable or plan-gated. The minimum is a bounded integer or U. Character and redirect inputs use fixed option codes; never paste a password, token, address, raw URL, private configuration value or screenshot of private fields. Read existing values; do not change toggles or press Save.

| Prompt | Input and where to find it |
|---|---|
|1 | Confirm STAGING project reference `dczlddwbtgvfdujgcitb`; Y is required to continue |
|2–4 | Email sign-in, Allow new users to sign up, Confirm email; Authentication > Sign In / Providers > Email (general signup toggle may be behind the panel) |
|5 | Current minimum password length number only |
|6 | Required character option:0 none,1 letters/digits,2 lower/upper/digits,3 adds symbols,4 other/custom,U unknown |
|7–9 | Reauthentication/Secure password change, require current password, Secure email change; same Email panel; U if not shown |
|10 | Site URL equals canonical staging root, optional trailing slash; URL Configuration |
|11 | Redirect presence category: E four printed literal callback entries; W printed staging `/**` entry without all4 literals; B both; N empty; O other/partial; U unknown |
|12–14 | Single session per user, nonzero time-box duration enabled, nonzero inactivity timeout enabled; Sessions; U for unavailable/plan-gated controls |
|15 | Confirm only viewing occurred without saving changes; N/U keeps review open |

The script prints the four already-public canonical `auth.html?flow=...` callback literals locally. Redirect classification describes presence only: other entries are unmeasured and provider pattern matching/delivery is untested. It cannot establish that the whole allowlist is safe. Session durations are classified enabled/nonzero only, not measured as seconds. Missing settings do not become default false values. Additional API-only settings, rate-limit numbers, JWT lifetime and complete allowlist review remain unknown until an appropriate later prerequisite is available; none is silently passed.

## Scope and limits

Expected marker: `BEGIN SAFE BATCH W DASHBOARD RESULT`. Exit0 means an owner-reported settings summary was collected and the owner confirmed no changes; values can still be unknown. It is not independently authenticated API readback or an AU case pass. The script requests no application email, API login, account/password/factor/role/settings/mode change and saves no collected values to disk. Git/network/browser traffic exists; the script makes0 Management/Auth API calls and does not independently count browser requests. It does not remeasure quarantine. Last verified quarantine is carried from the owner07:21:25.371UTC receipt, not asserted fresh by this dashboard summary.

The15-prompt collection source is manually reviewed; no PowerShell runtime was available in the assistant environment, so no new automated/syntax/runtime PASS is claimed. It collects reversible fixed-enum observations and does not implement product security behavior. The original345 executable source identities remain unchanged, and the owner20/20 pass is reused. No new harness or dependency is requested. All31 AU cases and five V-dependent Admin invitation cases retain their pending/blocked state. Full W/V/FR.2/Stage3/release acceptance remains open; production/native unchanged and APK deferred.

Send me the safe JSON and exit code.
