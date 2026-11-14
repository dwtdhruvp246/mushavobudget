# FR.2.4.E5.4: modern key transport and private local preparation

19 October 2026, FRE91. Parent source: `b5da5055c52ffa408c00e580395528789ddde974`.

The owner reports the intended staging project and all four key-label observations. This is availability evidence, not independent project selection, key ownership or provider validity. No key values have been received by the assistant.

## Gateway change and validation

The gateway's service RPC adapter now sends a modern `sb_secret_` key only in `apikey`. The legacy JWT service credential retains its previous bearer transport. User Auth requests still carry the actual caller JWT and the public key; session and actor binding, RPC allowlisting, ownership and role controls remain enforced. Supabase documents the modern key limitation at https://supabase.com/docs/guides/getting-started/api-keys#known-limitations.

[Local receipt](security-fr-2-email-modern-preparation-local-checks.json): 141/141 checks passed, 91 source SHA256 identities, 23 syntax checks. These include the actual compiled Pages Worker, real local SQLite Durable Object, full55 modeled SQL, 13 modern transport cases and 26 private-packet cases. No real Auth, Cloudflare, Zoho, hosted SQL or email requests occurred. The prior full1525 suite was not rerun.

| Artifact | SHA256 |
| --- | --- |
| New Pages Worker | `a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651` |
| Unchanged limiter Worker | `4d10a3f6ea03ab14979b1d821df2c35409d519b0550da8bd4a92f4b28d37b0a1` |
| Retained old ZIP, configuration extraction only | `33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1` |

The old ZIP remains unuploaded and must be replaced before deploying with the modern Secret key. Historical manifests and receipts are preserved at their original pins; replay their checks using the corresponding pinned source, not the changed working source. This checkpoint changes one runtime gateway adapter and its affected assertions; it does not alter SQL, policies, grants, roles, hooks, mail delivery or the limiter source.

## Owner's next action

Export this new pinned commit with LF line endings into a fresh temporary folder. Install the existing pinned worker and database tool dependencies in their isolated fixtures, then run `scripts/verify-fr-2-email-modern-preparation.mjs`. Stop before entering credentials if it fails. Parse the PowerShell wrapper before executing it.

Invoke `scripts/prepare-fr-2-email-private-packet.ps1 -SnapshotRoot <export>` through the supplied command. The Windows wrapper verifies all91 source hashes, resolves the working Node executable, and performs DPAPI/private-pipe synthetic preflight before requesting keys. It then checks the exact old ZIP, extracts only its staging configuration, and privately decrypts the retained Zoho sender file.

The three hidden inputs are the existing staging Publishable key, existing modern Secret key beginning `sb_secret_`, and 1–10 existing staging app account emails with inboxes the owner controls. The public key must exactly match the private retained configuration; the modern Secret key is not replaced by the legacy service_role value. The recipient list is only a future staging allowlist; no email is sent.

The script validates the16 gateway variables with the actual constructor, creates two independent32-byte random peppers, then writes a new exclusive DPAPI CurrentUser encrypted file under the owner's LocalApplicationData MushavoBudget/PrivateStaging folder. It decrypts the saved packet for exact readback and checks the old Zoho file is unchanged. Existing private packets and the ZIP are not overwritten. Keys, peppers, addresses and Zoho credentials travel only through private process memory and the parent-child pipe; no plaintext secret file, argument or environment variable is created. Ordinary managed strings cannot be promised to be securely erased.

Actual Windows DPAPI execution and the new packet's save/readback remain owner-pending. Return only the safe verifier JSON, safe private-packet JSON and exit codes; keep the encrypted packet and its contents private. A failure requires review before rerunning.

## Remaining rollout work

After the Windows result, prepare and verify a separate replacement ZIP and a concrete staged secret-installation handoff. Real provider key ownership/validity, mail delivery, uploaded bundle identity, live runtime binding, coordinated SQL activation, browser/cookie/recovery behavior and Admin acceptance remain pending. No Cloudflare token, upload, secret installation, SQL or role action is required by this command.

Both channels referenced in the previous date receipt belong to the staging Pages project. Production and native builds remain unchanged; APK update deferred. Findings stay open, release gate `OPEN_PENDING_REQUIRED_EVIDENCE`, re-audit `PLANNED_NOT_PERFORMED`.
