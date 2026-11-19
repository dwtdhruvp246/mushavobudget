# 3.4 — Privileged entrypoints and Admin MFA checkpoint

**Closed with BLOCKED hosted acceptance and carry-forward — 11 October 2026, S3E21.** All three bounded work items have recorded outcomes. This closes the checkpoint, not F08/F15 or MFA enforcement. Next is **3.5.1 — sign-in, password, invitation and recovery source review**. Stage 3's full report/action plan remains due at **3.6**.

## Recorded outcomes

| Milestone | Actual evidence | Outcome and limit |
|---|---|---|
| 3.4.1 | S3E19: selected source entrypoints and frozen A01–A05 matrix | Source review complete; no hosted privilege/MFA acceptance |
| 3.4.2 | S3E20: guarded SQL/UI/Edge/recovery candidate; 58 database, 16 controller/Edge and 16 regression checks | 90 local PASS, exit 0; modeled Auth/Storage/grants and adapter execution; not deployed |
| 3.4.3 | S3E21: owner read-only readiness JSON from the pinned handoff | Metadata recorded; genuine privileged MFA/role/recovery/dispatch acceptance BLOCKED; no hosted API batch ran |

The source candidate and [local report/receipts](SECURITY_STAGE_3_4_ADMIN_MFA_CANDIDATE.md) remain pinned at `d96e7536d28485e015a879adc4e20f8540f74ac4` on `security/stage-3-authorization`. The [canonical owner readiness receipt](security-stage-3-admin-mfa-owner-readiness.json) preserves all returned values and all 34 mismatch names. The receipt was supplied as CSV-escaped JSON; only its representation was decoded, not its policy or routine results.

## Owner readiness result

| Field | Reported result | Interpretation |
|---|---:|---|
| Selected routines | 36 | Selected metadata only, not every transitive path |
| LF / exact CRLF body matches | 0 / 36 | All selected bodies match the explicit reviewed CRLF variant |
| Routine body-or-definition-shape mismatches | 0 | Narrow source metadata match; not an authorization/MFA PASS |
| Selected policies / mismatches | 58 / 34 | 24 selected definitions match; 34 need private comparison before candidate installation |
| Platform staff role counts | `{}` | No platform staff rows reported |
| Active super users with verified TOTP | 0 | `BLOCKED_NO_VERIFIED_SUPER_OPERATOR` |
| Candidate helpers present | 0 | Candidate helper names are absent; no installed MFA enforcement is demonstrated |
| Anonymous / authenticated executable selected routines | 14 / 31 | Actual returned execute-grant counts; executable does not mean unauthorized effect is possible |
| Auth settings / recovery / hosted acceptance | false / false / false | Unverified; genuine hosted checks were not performed |

The mismatch predicate compares policy command, permissive/restrictive setting, role names and deparsed USING/WITH CHECK expressions. The receipt gives names and a combined mismatch result, not the differing attributes/expressions. It cannot distinguish formatting/deparser/qualification differences from semantic drift, and does not demonstrate an unauthorized read/write. Do not infer that 34 policies are insecure, or that their differences are only cosmetic. Guard reconciliation stays OPEN; do not normalize away or override mismatches.

The handoff targeted STAGING `dczlddwbtgvfdujgcitb`. Its `project_selection` remains `OWNER_MUST_CONFIRM_STAGING`; SQL does not independently attest the dashboard/project selected. This limitation remains in the evidence rather than being inferred from source matching. Production `kttkospkblwvguuwnhjj` remains outside the checkpoint scope.

## BLOCKED hosted groups

The existing A01–A05 matrix remains frozen. No controlled privileged actor or genuine stepped-up session was established, no candidate installation was performed, and no new hosted administrative API/MFA test count is claimed.

| Group | Hosted outcome |
|---|---|
| A01 — Platform operation role boundaries | BLOCKED: no controlled platform staff sessions; candidate not installed; selected policy drift unresolved |
| A02 — Same-session staff revocation/suspension | BLOCKED: no isolated privileged actor and no installed candidate |
| A03 — Genuine TOTP/assurance and direct backend bypass controls | BLOCKED: zero verified active super operators; settings and genuine Auth-issued assurance unverified |
| A04 — Factor lifecycle/refresh/recovery/browser flows | BLOCKED: controlled recovery identity/path and hosted UI/session checks unavailable |
| A05 — Human Edge and safe legitimate service controls | BLOCKED: hosted assurance/gateway parity and safe provider/destination controls unverified; local handler/secret tests remain local |

Ordinary owner/anonymous negative tests alone cannot replace the missing genuine privileged positive and low-assurance staff controls. The two shared ordinary accounts stay ordinary. No account creation, promotion, factor enrollment, Auth change, installer/rollback execution, provider/email/job execution, production promotion or native build was requested by the readiness handoff. No repeated setup/diagnostic/API loop is requested now. Personal/Family and two manual-conversion fixtures retain their previous outcomes; Business remains BLOCKED with zero API checks.

## Final-remediation actions

| Action | Required work and acceptance evidence |
|---|---|
| AM-R01 — Privileged actor, settings and recovery | Confirm staging identity/settings through an authorized operator path; use a separately controlled isolated staff actor and independent recovery route. Do not promote either shared account or use the sole operator for lockout tests. Prove genuine enrollment, invalid/valid challenge and scoped recovery/re-enrollment without exposing secrets. |
| AM-R02 — Policy/source parity | Privately compare the 34 named policies' roles/type/command/USING/WITH CHECK with the pinned source, accounting for deparser/version/qualification differences only after review. Preserve owner/member/public branches; reject unexplained drift. Reconcile reviewed guards and test both preserved and narrowed behavior before installation. Review wider transitive/hosted parity separately. |
| AM-R03 — Coordinated enforcement and effective grants | Recheck the 14 anonymous/31 authenticated execute counts against selected signatures/role intent and direct denied-effect controls; counts alone do not establish exposure. Deploy the coordinated reviewed SQL/Edge/UI candidate only after source/recovery prerequisites and concrete approval. Validate the exact operation role allowlists and service-only helpers with genuine same-bearer controls. |
| AM-R04 — Full bounded A01–A05 hosted batch | Run the frozen permitted/denied table/RPC/Storage/Edge, assurance/revocation/factor/refresh/account-switch and safe job controls with known rows and owner readbacks. Record unavailable positive provider/dispatch/browser/Deno/recovery cases as BLOCKED. Verify actual token/session behavior; do not assume instantaneous global revocation. |
| AM-R05 — Preservation, reporting and fresh re-audit | Recheck retained Personal/Family/conversion fixtures, Business prerequisites and operator rollback safeguards without historical rewrites. Include these outcomes and unrun cases at 3.6 and in final remediation/full re-audit. Keep F08/F15 OPEN until sufficient demonstrated acceptance. |

The checkpoint contains a locally tested candidate and one owner metadata result. It does not establish application MFA enforcement, hosted role security, complete recovery or production readiness.
