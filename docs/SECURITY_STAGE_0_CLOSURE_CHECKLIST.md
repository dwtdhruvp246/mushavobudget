# Stage 0 closure checklist

Updated 7 October 2026. **Stage 0 remains open; Stage 1 has not started.** Current reviewed main: `464f52c39ff56cc57bf8dfd2b0e35bd3d51a4436`, merged web/PWA 4.9.40. This checklist closes baseline collection and assigns the work that follows. It does not certify all 123 controls, store readiness or future architecture.

## Already accounted for

| Area | Current result | Scope |
|---|---|---|
| Audit coverage | All 123 sections and original F01–F20 retained | Evidence-backed applicability/worklist; not 123 completed tests |
| Narrow database repairs | Both owner metadata rechecks PASS | Private-table SELECT and internal-helper EXECUTE properties; wider live behavior remains open |
| Native build dependencies | Locked install, asset build and actual consumer checks PASS locally/owner Windows/CI | Web packaging only; original checkout reconciliation, native compile/signing/devices outstanding |
| Signup/Admin invitation | Owner normal smoke tests PASS | No full direct API/replay/expiry matrix inferred |
| Business SQL/UI | Notification SQL owner 8/8 PASS; revised UI owner “now working” | Merge #90, successful deployment checks and dated 4.9.40 source evidence; full action/denial/realtime matrix outstanding |
| SMTP | Owner corrected host and reports working | Normal sending blocker resolved at owner scope; current templates/redirects/recovery/all-email matrix not inferred |
| Staging/iOS prerequisite | Owner reports no separate Supabase test project and no Mac/Xcode access | Isolation Stage 1 and iOS build access Stage 5 remain required before their full tests |
| Recovery prerequisite | Owner reports Free; screenshot shows PITR Pro add-on/Upgrade screen | Manual database/Storage backups and restore history remain unknown; no upgrade requested |
| APK/email boundary | APK update deferred; full email architecture deferred | No APK, new hook, application dispatcher or queue implemented by this reconciliation |

Detailed snapshots and hashes remain in [the baseline](SECURITY_STAGE_0_BASELINE.md), [all-section register](SECURITY_AUDIT_REGISTER.md) and `security-stage-0-evidence.json`. E27–E30 supersede only the current-state outcomes covered by later evidence; old snapshots remain intact.

## First bundle received (E30)

The owner answered all three prerequisite questions on 7 October: **no** separate Supabase staging project, **Free** plan, **no** Mac/Xcode access. The screenshot shows the Point in time tab and Pro add-on/Upgrade screen. It does not display Scheduled backups, a manual export method or a restore result. These questions are accounted for; do not request the same screenshot or answers again.

Current [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups), checked 7 October, describes paid-plan daily backups and off-site database exports for Free projects. Storage object bytes need their own protection. Establish a feasible Stage 1 recovery method; no paid upgrade or restore is requested by this baseline step. Likewise, staging and iOS access remain explicit future prerequisites, not PASS results.

## Next owner evidence bundle

Status answers are enough; no settings change is requested.

1. **Existing backups:** do you currently keep any manual database backups or copies of uploaded files outside Supabase? State **database yes/no/unsure; uploaded files yes/no/unsure**. If yes, give the method name and last approximate date, not the backup itself.
2. **Account security:** is two-step verification/MFA enabled for **GitHub, Cloudflare, Supabase and Zoho**? Answer each **yes/no/unsure**; never share codes or recovery material.
3. **Store prerequisites:** do you already have a **Google Play developer account** and an **Apple Developer account**? Answer each **yes/no**. If yes, state personal/organization and active/pending/unsure. No purchase or enrollment is requested now.

## Remaining baseline inputs to account for

After each bundle, collect remaining inputs in small groups. Do not keep Stage 0 open until every listed later repair is implemented. For unavailable evidence, record **UNKNOWN/NOT CONFIGURED**, owner, dependency and target stage; do not claim PASS. Product/operator decisions that determine later design need an explicit answer or deferral.

| Baseline input | Evidence/question now | Implementation or full validation later | Owner |
|---|---|---|---|
| Staging isolation | E30: no separate Supabase project. Backend/preview/inbox isolation remains to be arranged | Establish isolation before risky negative tests: Stage 1; full tenant/event tests Stages 3/8/9 | Both |
| Database recovery | E30: owner Free; PITR upgrade screen. Manual export/restore history unknown | Feasible backup method, recovery targets and isolated drill: Stage 1; no paid purchase requested now | Owner/Both |
| Storage recovery | Whether independent Storage object-byte protection exists; name of method or “none/unknown” | Database-plus-file recovery validation: Stage 1 | Both |
| Operations | Incident owner/support address; whether cost/error alerts and budgets exist | Thresholds, runbooks, alert tests and response drills: Stages 1/10 | Owner/Both |
| Infrastructure access | GitHub, Cloudflare, Supabase, transactional mail and store MFA enabled/not enabled/unknown; recovery owner | Account hardening and recovery verification: Stage 1; Admin app MFA Stage 3 | Owner |
| Auth delivery/config | Saved Business redirect/template state; recovery offered/tested/not yet; rate/session/MFA settings snapshot | Coordinated Auth UX/authorization Stage 3; callback/email-type architecture Stage 6 | Both |
| Deployed backend | Edge function names/update dates, APP_ORIGIN value without secrets, existing schedules and redacted last success/failure | Reconcile deployments/operational controls: Stage 1; scheduler/event reliability Stage 8 | Both |
| Currency repair compatibility | Controlled legitimate payment/settings and scheduler outcomes if already available; otherwise record not tested | Fixture PASS and grant metadata do not establish live workflow/history. Verify safely before relying on those workflows; full tenant/finance matrix Stages 3/7/9 | Both |
| Hosting mapping | Current Worker deployment/version/traffic details; whether GitHub Pages intentionally serves anything; TLS/redirect settings | Headers/contact/egress Stage 2; exposed-environment cleanup Stage 1 | Owner/Both |
| Native prerequisite | E30: no Mac/Xcode access. Android Studio/JDK/current signing ownership still to be accounted for; original local edits preserved | Resolve iOS access and reconcile/build/device/token/backup controls Stage 5; artifacts Stage 9 | Owner/Both |
| Stores/operator | Play/Apple developer accounts: exists/type/status or not yet; intended platforms, countries, audience, legal operator and support address | Factual policies Stage 4; store/billing mapping Stage 7; console/review evidence Stages 9/10 | Owner |
| Privacy/processor facts | Known services and actual data/support/retention decisions, with unknowns named | Public notices/deletion/retention Stage 4; SDK/native inventory Stages 5/9 | Both |

Do not send passwords, SMTP/API/service-role credentials, recovery codes, keystores, signed auth links, full customer logs or production backups. Provider/settings screenshots should show labels/status only. No direct production restore or adversarial financial/delete test is authorized by this checklist.

## Later email work

The agreed direction is a shared versioned template catalog, a signed Supabase Auth Send Email Hook for purpose-aware Auth messages and a separate dispatcher/event queue for application messages. Stage 6 will cover all supported Auth email types, validated invitation context and provider failure/retry behavior; Stage 1 supplies secret/operational controls and Stage 8 coordinates notification events. This is a proposal only. Keep the current working SMTP path until that complete replacement is reviewed and tested.

## Closure gate

Stage 0 can be signed off when baseline source/deployments are reconciled; every required external input has evidence or an explicit known gap/prerequisite; demonstrated repairs have their scoped rechecks and remaining behavior limits recorded; staging requirements are concrete; and the register identifies the next stage/owner for outstanding work. Obtain the owner's agreement to that factual baseline and next-stage scope. Unavailable iOS access or missing staging becomes an explicit prerequisite, not a PASS.

The Stage 0 sign-off should state **baseline complete, known gaps assigned**. Store submission, native release, full recovery/authorization testing and email architecture retain their separate gates. Stage 1 starts only after that sign-off and agreement on its concrete work.
