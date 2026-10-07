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
| Recovery prerequisite | E30 Free/PITR not enabled; E31 no external database/uploaded-file backups | Known Stage 1 recovery gap; provider-internal behavior/restore history not certified |
| Infrastructure security | E31 GitHub MFA believed enabled; Cloudflare/Supabase/Zoho unconfirmed | Stage 1 must verify actual account security and recovery |
| Store prerequisite | E31 no Google Play/Apple developer accounts | Enrollment/type/verification/testing gates remain later work; no purchase now |
| APK/email boundary | APK update deferred; full email architecture deferred | No APK, new hook, application dispatcher or queue implemented by this reconciliation |

Detailed snapshots and hashes remain in [the baseline](SECURITY_STAGE_0_BASELINE.md), [all-section register](SECURITY_AUDIT_REGISTER.md) and `security-stage-0-evidence.json`. E27–E31 supersede only the current-state outcomes covered by later evidence; old snapshots remain intact.

## First bundle received (E30)

The owner answered all three prerequisite questions on 7 October: **no** separate Supabase staging project, **Free** plan, **no** Mac/Xcode access. The screenshot shows the Point in time tab and Pro add-on/Upgrade screen. It does not display Scheduled backups, a manual export method or a restore result. These questions are accounted for; do not request the same screenshot or answers again.

Current [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups), checked 7 October, describes paid-plan daily backups and off-site database exports for Free projects. Storage object bytes need their own protection. Establish a feasible Stage 1 recovery method; no paid upgrade or restore is requested by this baseline step. Likewise, staging and iOS access remain explicit future prerequisites, not PASS results.

## Second bundle received (E31)

The owner reports **no** external database/uploaded-file backups and **no** Play/Apple developer accounts. For two-step verification the owner says **“i think only for github”**: record GitHub as believed enabled/unverified and Cloudflare/Supabase/Zoho as unconfirmed. Do not turn uncertainty into a definitive disabled state or a PASS. This bundle is accounted for; Stage 1 will verify those settings and establish protection/recovery/isolation before riskier work. No settings, backups or paid accounts are changed now.

## Next operator/operations bundle

Answers or an explicit **undecided/unsure/not yet** are sufficient; no account purchase or settings change is requested.

1. **Operator/support:** will Mushavo Budget be operated by you as an individual or by a registered business, or is that undecided? Which existing email should receive user support/security reports? If no mailbox is active yet, say not yet; no personal address or registration document is needed now.
2. **Initial launch scope:** Zimbabwe only, selected countries (name them), worldwide, or undecided? Confirm whether the app is for adults or whether children are intended users; undecided is an explicit decision prerequisite.
3. **Alerts:** are any automatic error/outage or spending alerts already configured for the project/services? Answer **yes/no/unsure**; if yes, name the service and who receives them without exporting alert credentials or customer logs.

After this broad owner bundle, prepare the factual Stage 0 sign-off with known gaps/owners/stages. Any unverified Auth/deployment/workflow property remains explicitly limited and assigned for its later check; do not invent PASS or require every later-stage repair to be finished first. Only a concrete ambiguity that changes the baseline needs a further narrow question.

## Remaining baseline inputs to account for

After each bundle, collect remaining inputs in small groups. Do not keep Stage 0 open until every listed later repair is implemented. For unavailable evidence, record **UNKNOWN/NOT CONFIGURED**, owner, dependency and target stage; do not claim PASS. Product/operator decisions that determine later design need an explicit answer or deferral.

| Baseline input | Evidence/question now | Implementation or full validation later | Owner |
|---|---|---|---|
| Staging isolation | E30: no separate Supabase project. Backend/preview/inbox isolation remains to be arranged | Establish isolation before risky negative tests: Stage 1; full tenant/event tests Stages 3/8/9 | Both |
| Database recovery | E30 Free/PITR screen; E31 no external database backups. Restore history unknown | Establish exports/protection, recovery targets and isolated drill: Stage 1; no paid purchase requested now | Owner/Both |
| Storage recovery | E31 no uploaded-file copies outside Supabase, owner-reported | Separate object-byte protection and database-plus-files restore verification: Stage 1 | Both |
| Operations | Incident owner/support address; whether cost/error alerts and budgets exist | Thresholds, runbooks, alert tests and response drills: Stages 1/10 | Owner/Both |
| Infrastructure access | E31 GitHub MFA believed enabled/unverified; Cloudflare/Supabase/Zoho unconfirmed; store accounts absent | Verify actual security/recovery, then harden in Stage 1; app Admin MFA remains Stage 3 | Owner |
| Auth delivery/config | Saved Business redirect/template state; recovery offered/tested/not yet; rate/session/MFA settings snapshot | Coordinated Auth UX/authorization Stage 3; callback/email-type architecture Stage 6 | Both |
| Deployed backend | Edge function names/update dates, APP_ORIGIN value without secrets, existing schedules and redacted last success/failure | Reconcile deployments/operational controls: Stage 1; scheduler/event reliability Stage 8 | Both |
| Currency repair compatibility | Controlled legitimate payment/settings and scheduler outcomes if already available; otherwise record not tested | Fixture PASS and grant metadata do not establish live workflow/history. Verify safely before relying on those workflows; full tenant/finance matrix Stages 3/7/9 | Both |
| Hosting mapping | Current Worker deployment/version/traffic details; whether GitHub Pages intentionally serves anything; TLS/redirect settings | Headers/contact/egress Stage 2; exposed-environment cleanup Stage 1 | Owner/Both |
| Native prerequisite | E30: no Mac/Xcode access. Android Studio/JDK/current signing ownership still to be accounted for; original local edits preserved | Resolve iOS access and reconcile/build/device/token/backup controls Stage 5; artifacts Stage 9 | Owner/Both |
| Stores/operator | E31 no Play/Apple accounts. Operator/support/launch scope needs answer or undecided result; enrollment type/status becomes a later prerequisite | Factual policies Stage 4; channel/billing mapping Stage 7; console/review evidence Stages 9/10 | Owner |
| Privacy/processor facts | Known services and actual data/support/retention decisions, with unknowns named | Public notices/deletion/retention Stage 4; SDK/native inventory Stages 5/9 | Both |

Do not send passwords, SMTP/API/service-role credentials, recovery codes, keystores, signed auth links, full customer logs or production backups. Provider/settings screenshots should show labels/status only. No direct production restore or adversarial financial/delete test is authorized by this checklist.

## Later email work

The agreed direction is a shared versioned template catalog, a signed Supabase Auth Send Email Hook for purpose-aware Auth messages and a separate dispatcher/event queue for application messages. Stage 6 will cover all supported Auth email types, validated invitation context and provider failure/retry behavior; Stage 1 supplies secret/operational controls and Stage 8 coordinates notification events. This is a proposal only. Keep the current working SMTP path until that complete replacement is reviewed and tested.

## Closure gate

Stage 0 can be signed off when baseline source/deployments are reconciled; every required external input has evidence or an explicit known gap/prerequisite; demonstrated repairs have their scoped rechecks and remaining behavior limits recorded; staging requirements are concrete; and the register identifies the next stage/owner for outstanding work. Obtain the owner's agreement to that factual baseline and next-stage scope. Unavailable iOS access or missing staging becomes an explicit prerequisite, not a PASS.

The Stage 0 sign-off should state **baseline complete, known gaps assigned**. Store submission, native release, full recovery/authorization testing and email architecture retain their separate gates. Stage 1 starts only after that sign-off and agreement on its concrete work.
