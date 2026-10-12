# Stage 6 — Identity and email workflows

**6.1 / 12 October 2026 — Source/decision inventory COMPLETE; Stage 6 IN PROGRESS.**
Source pin: `fe2c281ce13e7d0d8cb49115fa1bd6c195579c4e`. Stage 5 is closed with carry-forward; its seven native actions remain OPEN. This stage addresses existing F04 and dependencies F08/F10/F14/F15/F19/F20. Original 123 coverage rows and 20 finding definitions are unchanged.

## Four finite steps

| Step | Bounded work | Required recorded outcome |
|---|---|---|
| 6.1 | Current identity/email source, public provider requirements, known owner intent and unresolved decisions | Source review/inventory, finite acceptance contract and action/decision records |
| 6.2 | Reviewable identity/email candidate with meaningful offline validation | Repair demonstrated purpose-template mismatch; prepare precise provider/linking/callback and email-route contracts; implement only justified source scope; record actual local results and inactive/unimplemented boundaries |
| 6.3 | One bounded staging/provider/browser/native acceptance or readiness review | Run only cases with verified isolated prerequisites; otherwise record BLOCKED/UNVERIFIED and exact carry-forward. No recurring setup loop |
| 6.4 | Reconcile outcomes and issue full Stage 6 report | Preserve receipts, consolidate OPEN actions, retain release gate and hand off 7.1 |

**One of four steps is complete. Next 6.2; full report at 6.4.** Later decisions/prerequisites do not turn a source/model PASS into provider authentication, identity linking, inbox delivery or device acceptance.

## Scope and existing dependencies

Preserve working password sign-in and the current SMTP route, existing Personal/Family/Business finance, ownership/roles/seats, Admin assurance and isolated invitation sessions. Google login is existing owner intent. A qualifying iOS equivalent login must be selected before provider activation; Sign in with Apple is the proposed option, not a newly confirmed owner decision.

Use verified immutable Auth UUIDs for ownership. Provider claims, local email equality, labels in user metadata and invitation URLs do not themselves grant memberships, plans or administrative roles. Do not copy/merge financial records by email to solve a linking collision.

Existing AU-R01–AU-R06, AM actions, Personal binding/relink/deletion, Business source/fixture/grant gaps and NR-R01–NR-R07 remain dependencies. Stage 4 disclosure, minors, retention/deletion and actual provider/privacy decisions remain OPEN; Google production policy requirements are not satisfied by the unpublished privacy draft.

## Evidence and execution contract

- [6.1 source review](SECURITY_STAGE_6_1_IDENTITY_EMAIL_REVIEW.md) and [41-file byte inventory](security-stage-6-identity-email-source-inventory.json).
- [Known/unconfirmed decisions](security-stage-6-identity-email-decisions.json); no provider credential values, private links or tokens retained.
- [36 planned grouped cases](security-stage-6-identity-email-test-matrix.json), six groups IE01–IE06; zero executed so far. Cases overlap earlier AU/AM/NR coverage and are not additive global unique controls.
- [Six OPEN remediation actions](security-stage-6-remediation-actions.json), linked to existing findings.
- [Stage evidence](security-stage-6-evidence.json); source, local, owner-reported, hosted and device scopes stay separate.

Staging is `dczlddwbtgvfdujgcitb`; production `kttkospkblwvguuwnhjj` is excluded from stage mutations. Preserve the controlled fixtures and two USD1 manual conversions. APK update remains deferred. Native/provider/store setup and provider activation or email dispatch are separate concrete rollout work; this plan performs none.

When owner execution is needed, paste the full SQL/PowerShell block in chat and request the result after completion. No file-opening requirement or owner command is needed for 6.1.

## Readiness boundary

Before real acceptance, bind exact deployed source/templates/settings, explicit selected environment, allowed callbacks and selected native/system-browser return. Verify supported provider clients/capabilities/domain/sender/privacy prerequisites privately; keep secrets with the owner. Establish separate recoverable actors/inboxes and a reversible rollout with preserved SMTP and no unintended invitations/account grants.

A future Auth Send Email Hook replaces SMTP when enabled. It is not a harmless parallel observer. Review raw-body signature/timestamp checks, exact action/recipient/token mapping, bounded failure handling and restoration before enabling it. Application event mail requires a separate server-authorized durable worker; existing Web Push queues are not proof of that implementation.

Unavailable prerequisites are carried to final remediation/full re-audit after the bounded 6.3 outcome. No original finding is closed without its defined genuine rechecks.
