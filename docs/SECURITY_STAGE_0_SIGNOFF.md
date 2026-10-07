# Stage 0 sign-off proposal

Prepared 7 October 2026. **Baseline collection is accounted for; sign-off awaits owner agreement. Stage 1 has not started.** This is a factual baseline with known gaps and prerequisites assigned, not a declaration that the application is secure, all 123 controls pass or the app is ready for stores.

## Scope and evidence

Original baseline: `d2a32032b1c560bbae853de87837c3436ea44887`, web/PWA 4.9.39. Reviewed production-source merge: `464f52c39ff56cc57bf8dfd2b0e35bd3d51a4436`, web/PWA 4.9.40 through PR #90. The documentation reconciliation is in draft PR #91. The baseline/register retain all **123 audit sections**, **20 original finding definitions** and E1–E32, with historical snapshots preserved.

Narrow table/helper permission repairs pass the owner's metadata rechecks. Notification SQL is owner-reported 8/8 PASS. Locked native dependency/asset checks pass locally, on owner Windows and in CI; this is not native compilation. The invitation candidate's historical full automated suite passed 406/406 and its scoped SQL fixtures passed, with fixture limitations retained. Merged-commit deployment checks, dated 4.9.40 public source evidence and the owner's normal working notification/SMTP reports are recorded separately from wider live authorization, event and device guarantees. The documentation update does not change runtime, SQL, provider settings or APKs.

## Owner facts and explicit unknowns

| Item | Current baseline | Work/gate |
|---|---|---|
| Supabase plan/recovery | Owner Free; screenshot shows PITR add-on upgrade screen; owner reports no external database/uploaded-file backups | Stage 1 protection and isolated recovery validation; restore history/provider-internal behavior still unverified |
| Staging | No separate Supabase test project | Stage 1 must establish separate backend/preview/inboxes before risky negative tests |
| Infrastructure MFA | GitHub believed enabled; Cloudflare/Supabase/Zoho unconfirmed | Stage 1 verify actual account security/recovery before hardening |
| Alerts | Owner reports no automated error/outage/spending alerts | Stage 1 configure feasible monitoring/response; ownership/delivery must be verified |
| Support | Owner designates `support@mushavobudget.com` | Mailbox existence/delivery/response ownership not established; verify in Stage 1 before relying on it |
| Operator | Individual versus registered business undecided | Explicit product/operator decision prerequisite for factual policies, billing and enrollment: Stages 4/7/9 |
| Launch scope | Worldwide, owner-confirmed intent | No jurisdiction/store clearance implied; later rules/disclosures must be checked for actual supported territories |
| Age audience | Not specified in the answer | Resolve before audience/privacy/store declarations in Stages 4/9; no adult-only or child-suitable claim |
| Native | No Mac/Xcode access; original Windows native edits preserved; APK updating deferred | Stage 5 environment/session/backup/signing work; Stage 9 device/artifact evidence |
| Stores | Neither Play nor Apple developer account exists | Enrollment/type/verification/testing remain Stages 9/10 prerequisites; no purchase now |
| Auth/deployment/workflows | Current hosted template/redirect/rate/session settings, deployed Edge/cron provenance, recovery and wider currency/tenant/event behavior remain scoped unknowns | Stage 1 inventory/operations; Stage 3 authorization/Auth UX; Stages 6/8 callbacks/email/events; Stages 7/9 finance/regression |
| Hosting | Workers/main/domain identified; merge/build/release/source evidence retained; exact version/traffic mapping, TLS/redirect configuration and secondary Pages role partial | Reconcile inventory Stage 1; serving-layer header/abuse work Stage 2 |

## Agreed boundaries retained

The full email architecture remains a Stage 6 proposal, coordinated with Stage 1 operations and Stage 8 events. No new Auth Send Email Hook, application dispatcher or email queue is activated. The working SMTP path remains the implementation to preserve while later routing is designed and verified. APK updating remains deferred. Missing policies/deletion, Admin app MFA, wider tenant/finance/event/device tests, social login and store billing retain the original stage assignments.

Worldwide intent and an undecided legal operator are inputs for future work, not legal or store approval. Unknowns are explicitly carried forward with owners/stages; no unavailable property is silently marked PASS. A failed or untested workflow must retain its own evidence limit even after Stage 0 baseline sign-off.

## Proposed acceptance

The owner may accept **Stage 0 baseline complete, known gaps and prerequisites assigned**, and authorize [the bounded Stage 1 foundations worklist](SECURITY_STAGE_1_FOUNDATIONS_PLAN.md). Signing off the baseline does not sign off recovery, authorization, native/store release or the full email architecture. Until that agreement, the recorded state remains **READY FOR OWNER SIGN-OFF**, with Stage 1 **NOT STARTED**.
