> FRE223, 26 October 2026: **Stage 3/10 | FR.2/8 | Batch W/Z — owner Windows74/74 PASS, combined exit0, real retained public ZIP patch COMPLETE.** Exact output ZIP SHA256 `3255992abbc6058afa2e74f804cc19b3d9337d2380db52d52b82d0363454218b`;44 files/3 changed/41 preserved. No hosted setting, frontend upload or quarantine recheck occurred. [Current combined staging upload/settings handoff](SECURITY_FR_2_5_BATCH_W_EIGHT_DEPLOYMENT_AND_SETTINGS_HANDOFF.md); no terminal/offline rerun, installation or credential input required. Minimum8 and four exact callback readback remain pending; V MFA stays ON HOLD. Earlier preparation-pending statements below are retained as dated history.

> FRE221–FRE222,26October2026: **Stage 3/10 | FR.2/8 | Batch W/Z — owner chooses8 characters; implementation/local74/74 COMPLETE, deployment/settings acceptance pending.** This explicitly supersedes the prior12-character instruction. Shared new-password validation/error copy, signup/recovery/change native fields/hints now use8; metadata compares the same shared rule. Seven source revisions include4 previously in the345 manifest and3 newly covered policy inputs;341 previous sources and308/310 historical U identities remain unchanged. Historical manifests/receipts remain at their accepted pins; old U acceptance is not transferred to changed Auth bytes. [One combined check and retained-U-ZIP update](SECURITY_FR_2_5_BATCH_W_EIGHT_CHARACTER_POLICY_HANDOFF.md):356 hashes/10 syntax checks,74 selected tests, then patch only auth-security.js/auth.html/signup.html in the exact accepted44-file public ZIP; preserve41 entries/config/public push key/worker/headers/routes and the original ZIP. No new credentials, private packet, key generation, dependency/browser/PGlite installation or MFA action. Owner Windows/new real ZIP preparation remains pending; frontend upload, server minimum8, callback readback and actual Auth acceptance are not claimed. Current server value must be read before any save; prior6 observation and possible earlier12 action are not assumed current. Four callback additions remain the same. V stays ON HOLD; full W/FR.2/Stage3/release remain open.

# Batch W — exact callbacks and new-password minimum alignment

**Stage 3/10 | FR.2/8 | Batch W/Z — local/source preparation COMPLETE; owner staging settings action pending. V MFA remains ON HOLD for phone transfer.** This is a concrete manual dashboard action within W, not an additional letter or full W acceptance.

## Reviewed current evidence

FRE219 records the owner's URL Configuration screenshot: Site URL `https://mushavo-budget-staging.pages.dev`, total4 redirects, all displayed. They are `/signup.html`, `/signup.html?mode=self-signup`, `/app.html`, and `/` on that origin. CategoryO is observed: none of the4 intended `auth.html?flow=...` literals or the staging double-star entry is present. The project name reads Mushavo Budget Staging, but the screenshot does not show its reference/address bar; before saving, the owner must verify `dczlddwbtgvfdujgcitb` in the browser URL. The main/PRODUCTION badge alone is not an independently verified project-reference observation and is not treated as proof of the separate production target.

FRE218's corrected owner dashboard report is retained: server minimum6, no required character classes; email provider, signup, confirmation and canonical Site URL true; current-password requirement and secure email change off; reauthentication unknown; session limits off. The original data-entry exit1 is preserved and the owner's later view-only clarification resolves the no-save uncertainty without inventing an exit0 or a new observation time. API Auth-config GET403 remains recorded; no retry/new token/scope expansion is requested. Last independently read quarantine is26October07:21:25.371UTC, not remeasured by these screenshots.

## Exact intended changes and prompts

Use existing dashboard access. Normal Supabase dashboard login/MFA may appear only if that browser session expired; use existing working access in the browser. No terminal password/token/code, MFA enrollment/reset, dependency, new deployment, ZIP/upload or previous20/86 test rerun is part of this action.

1. Open staging URL Configuration at <https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/url-configuration> and verify the project reference in the browser URL. Refresh/read the existing state first. Preserve all four reviewed current URLs. If an intended callback is already present, reuse it; if unrelated entries have changed or disappeared, stop and report the existing state before any repair.
2. Use **Add URL** to add each missing exact literal below. The dialog asks for a redirect URL; paste one literal and use its Add/Save confirmation. Read the list after each save. Do not add a wildcard, replace the Site URL, delete an original entry or guess that a failed response means no write. If a save fails/is uncertain, reload the list and inspect before retrying.

```text
https://mushavo-budget-staging.pages.dev/auth.html?flow=confirm
https://mushavo-budget-staging.pages.dev/auth.html?flow=recover
https://mushavo-budget-staging.pages.dev/auth.html?flow=business-new
https://mushavo-budget-staging.pages.dev/auth.html?flow=business-existing
```

3. Open the staging Email provider at <https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/providers?provider=Email>. Re-read **Minimum password length**. Change6 to **12**, matching the existing new-password UI, then **Save changes**. Reuse12 without another write if already present. If the value is neither the reported6 nor intended12, report it before changing it. Required characters remain **None**; other Auth controls, session settings, current-password/reauthentication/secure-email toggles and deferred MFA are outside this narrow change. No existing user's password is explicitly reset or updated.
4. Reload both pages independently. Read back minimum12/charactersNone and all8 exact expected redirect entries (the original4 plus these4), with the canonical Site URL preserved. A successful click or unsaved field alone is not accepted readback. This is owner dashboard metadata only, not proof of server signup/link/login behavior or current application quarantine.

The intended maximum is5 logical setting changes:4 missing redirect additions and1 password-minimum save. Dashboard HTTP traffic is not independently counted. No application rollout mode, role, factor, schedule, deployment or application row change is requested. If any result is uncertain, report the observed state before further writes; no automatic retry or token privilege change exists.

## Local validation and practical limits

FRE220 records42/42 assistant-local PASS on Node24.22.1:2 new tests execute the actual9 hash-checked pinned Supabase SDK2.110.9 modules and40 affected existing Auth-flow tests cover new-password boundaries, confirmation/recovery/invitation identity, password writes/retries, nonce/current-password payloads and session/logout isolation. No public dependency is installed. The SDK and licenses are the existing committed U fixtures; all345 previous executed source identities remain unchanged. No product code, live deployment or prior owner receipt is modified.

The new SDK check uses a synthetic HTTP200 Auth response with a valid six-character password and a `weak_password` advisory. The actual SDK returns a session and null error, consistent with the existing app `query`/sign-in path accepting session-bearing data. A synthetic HTTP400/versioned invalid-credentials response still produces an error/no session. This verifies client parsing compatibility; it is not real Auth password-policy enforcement, real JWT validation, a real older-password login or a hosted AAL2 case. A fail-on-use WebSocket stand-in exists for SDK initialization; no socket is opened. Default test networking is disabled with the existing preload, while explicit Auth fetch is synthetic; no OS sandbox is claimed.

Initial local fixture failures are retained in the local receipt: the VM lacked a WebSocket capability, then an error fixture lacked the API-version header used for modern error-code decoding. Those omissions were corrected in the synthetic environment; no product or hosted defect is inferred. Two redundant new boundary/URL cases were removed because existing affected tests already cover them. Final42/42 passes; VM experimental/module-type warnings remain non-failing. New SDK cases have not been executed on the owner's Node22 Windows runtime; no such claim is made and no owner rerun is needed for this manual configuration handoff.

Primary provider references support the intended configuration and expected behavior, not this project's current hosted acceptance:

- <https://supabase.com/docs/guides/auth/redirect-urls>
- <https://supabase.com/kb/troubleshooting/why-am-i-being-redirected-to-the-wrong-url-when-using-auth-redirectto-option-_vqIeO>
- <https://supabase.com/docs/guides/auth/password-security>

Supabase documents retaining valid existing-password login after stronger new-password rules. Actual hosted older-password sign-in, new-password rejection/acceptance, mail/link delivery, expired/used/wrong-identity/session outcomes and exact cleanup still need controlled W acceptance. Configuration readback alone credits none of the31 frozen AU cases. Admin-dependent cases remain blocked by V, other Auth settings remain open, and full W/V/FR.2/Stage3/release acceptance is pending.

## Owner result

Return observed values after page reload, or a screenshot cropped to the public redirect list and password-minimum field. Do not expose passwords, SMTP/OAuth fields, token material, email links or private configuration. This manual dashboard action creates no terminal process exit code: report `exit_code:null`, never invent a new exit0 or reuse the original data-entry exit1 as this action's process result.

The safe summary should identify staging reference confirmation, actual minimum, character-rule class, preservation of the original4 URLs, presence of all4 exact new callbacks, actual total URL count, reload/readback confirmation, any other settings changed and the null manual-action exit code. Report actual differences rather than copying intended values as observations.

Production/native remain excluded, APK deferred, findings open and Z remains final.

Send me the safe JSON and exit code.
