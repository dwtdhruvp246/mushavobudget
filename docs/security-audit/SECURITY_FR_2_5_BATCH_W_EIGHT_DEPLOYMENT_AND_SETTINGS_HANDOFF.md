# Batch W — eight-character staging deployment and settings readback

**Stage 3/10 | FR.2/8 | Batch W/Z — Windows verification/public ZIP COMPLETE; staging deployment/settings action ready, not performed. V MFA remains ON HOLD during phone transfer.**

FRE223 records the owner run at published commit b8664567ee69f41fe30e7ea9191f19712de1c6c6: Node22.17.0,74/74 PASS,356 source hashes/10 syntax checks, local and combined exit0, checked2026-10-26T10:59:04.430Z. The real retained U ZIP was hashed/read without rewriting; the new44-file ZIP changes only auth-security.js/auth.html/signup.html and preserves41 entries plus public configuration/push key/worker/headers/routes/SW. The assistant independently compared those3 new entry hashes with staging-exported pinned source; it has not opened the owner's actual archive. Portable ZIP readback passed on Windows; .NET archive readback was not performed. No repeat test, key, dependency or private packet is needed.

## Exact artifact and scope

Upload this existing file from the owner's Desktop; do not rebuild:

```text
C:\Users\HP\Desktop\Mushavo-W-Password-8-7dffbe2c15624168a4c4158266a9460f\mushavo-password-eight-staging.zip
```

Whole ZIP SHA256: `3255992abbc6058afa2e74f804cc19b3d9337d2380db52d52b82d0363454218b`.

The accepted predecessor is the original retained U archive with SHA25603542ed32e0ef32392f718f518248954a81f5317e94b77adf90c5c2b9457fd1a. Original U hosted acceptance stays historical; it is not transferred to modified Auth bytes. New hosted source/delivery and actual Auth acceptance remain pending. This handoff changes the staging frontend and at most5 logical Auth settings (4 missing callback additions and1 minimum-length save); application mode is not opened.

## One combined manual action

Use existing signed-in Cloudflare and Supabase dashboards. No terminal command or prompt is required. If either session has expired, normal account selection/login/password/verification/MFA may appear in that provider's browser; use existing access there. Do not create/reset a factor or send credentials/codes to chat. Cloudflare asks for the existing project, deployment environment and upload file, then deployment confirmation. Supabase Add URL asks for one URL and its Add/Save confirmation; the Email provider asks for a numeric minimum and Save changes. Reuse already-correct values. Never infer that an uncertain Save/Deploy failed; inspect current status/state before retrying.

1. Cloudflare dashboard > Workers & Pages > **mushavo-budget-staging** > Create deployment/Upload assets. Reuse this exact existing Pages project. If the environment is asked, use its **Production** deployment channel so the canonical staging pages.dev URL updates; the project name must still be mushavo-budget-staging. This is the production channel of the staging project, not the separate Mushavo production target. Choose the exact ZIP above, confirm deployment once, then wait for its success status. If outcome is uncertain, inspect the deployment list rather than uploading again. Copy the new `https://<deployment>.mushavo-budget-staging.pages.dev/` URL. Confirm the canonical staging URL is assigned to this successful deployment. Source serving is independently checked after the URL is returned; no hosted pass is assumed from upload status.
2. After successful staging deployment, open <https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/providers?provider=Email>. Verify the reference **dczlddwbtgvfdujgcitb** in the address bar. Read the current Minimum password length. If6 or12, set **8** and Save changes once. If already8, reuse it. If another value appears, stop and report it before changing it. Keep required characters **None**; report an unexpected current rule before altering it. No other Auth toggle is included. Reload and read the saved minimum/rule again. An unsaved input is not readback.
3. Open <https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/url-configuration>. Read before editing. Preserve the canonical Site URL `https://mushavo-budget-staging.pages.dev` and all original4 entries below. Add only missing exact callback entries below, one per Add URL confirmation. Reuse any already present. If existing unrelated entries differ from the reviewed set, report that state before repairing it. After an uncertain Save, reload before deciding whether any further write is necessary.

Original4, preserved:

```text
https://mushavo-budget-staging.pages.dev/signup.html
https://mushavo-budget-staging.pages.dev/signup.html?mode=self-signup
https://mushavo-budget-staging.pages.dev/app.html
https://mushavo-budget-staging.pages.dev/
```

Add/reuse these4 exact callbacks:

```text
https://mushavo-budget-staging.pages.dev/auth.html?flow=confirm
https://mushavo-budget-staging.pages.dev/auth.html?flow=recover
https://mushavo-budget-staging.pages.dev/auth.html?flow=business-new
https://mushavo-budget-staging.pages.dev/auth.html?flow=business-existing
```

4. Reload URL Configuration independently; confirm actual total8, original4 retained, all4 callback literals present and canonical Site URL preserved. Do not add wildcard/preview domains or delete unrelated entries. A successful Save/click alone is not acceptance. Return actual observed values or public-field-only screenshots, never arbitrary private configuration, email links, provider bodies or credential fields.

## Evidence and boundaries

Record deployment success/new URL and owner dashboard reload values as owner-reported metadata. Independent served-byte/header/TLS checks follow the new deployment URL; real confirmation/recovery/invitation/password/session cases remain within the unchanged31 AU matrix. No AU case is credited by configuration or package preparation. Existing-password compatibility remains to be tested against real Auth. API/config GET403 is retained and not retried; no token scope expansion. Reauthentication stays unknown; current-password/secure-email/session toggles remain outside this narrow action.

No email/code request, account creation, user password reset, application resume/quarantine, role/factor action, scheduler/Edge installation or production/native update is included. The last independent quarantine read remains2026-10-26T07:21:25.371Z; this local run did not remeasure it. V MFA/FR.2/full W/main Stage3/release acceptance remain open. APK deferred, five packages V–Z remain, and Z is final.

Manual dashboard actions generate no process exit code. Return `exit_code:null`; retain the completed local command's exit0 separately. The safe response contains actual deployment URL/success, staging reference confirmation, reloaded password minimum/character class, original4/four callback/canonical Site URL preservation, total redirect count, unexpected changes and a null manual exit. Do not prefill intended values as observations.

Primary documentation checked26October2026: <https://developers.cloudflare.com/pages/get-started/direct-upload/>, <https://supabase.com/docs/guides/auth/password-security>, <https://supabase.com/docs/guides/auth/redirect-urls>. These support dashboard deployment/settings capabilities, not this project's actual readback or hosted acceptance.

Send me the safe JSON and exit code.
