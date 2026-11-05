# Mushavo staging test runner

5 November 2026. Existing scope: Stage 3/10 → FR.2/8 → Batch W/Z.

This changes execution of existing checks. It does not create another stage,
FR or batch, repeat accepted invitations, reinstate MFA, or approve production.

The owner saved six repository Actions secrets. Their names were observed in
GitHub's repository secrets list; their contents were not read. The runner uses
them privately for the two designated ordinary accounts and existing Super Admin.

## Current finite run

`scripts/ci/staging-run.json` selects **access-and-confirmation / AU01.05**:

1. Match private email inputs to the designated account bindings, sign in once
   per account, verify each confirmed identity, active profile and platform role,
   and read only owned workspace metadata. This is access readiness, not general
   role/finance acceptance.
2. Run the outstanding AU01.05 browser flow against the stable staging site:
   one duplicate signup attempt for the already-confirmed ordinary account,
   generic pending guidance, browser-aborted resend, retained form/address/button,
   and local cooldown without another dispatch. The browser intercepts actual
   requests; it does not replace the application handler or supply a fake success.
3. Close the isolated test browser while its blocking rules remain installed and
   request local logout for every session the runner created. Unverified logout
   blocks COMPLETE. Existing browser sessions are not selected for logout.

Source identities are pinned to the already accepted signup and security files.
Configuration must name staging project `dczlddwbtgvfdujgcitb` and use a public
publishable key. API destinations and methods are fixed. Unexpected mutations,
global logout, email recovery and unblocked resend are refused. Duplicate signup
can cause provider behavior that is not measured as email delivery; at most one
such request is forwarded. Provider 429/quota behavior is not claimed by the
local cooldown check. Service workers are disabled only in this isolated
network-interception browser, so this run is not PWA/service-worker acceptance.

## Trigger and output

The workflow runs only on the `security/stage-3-authorization` branch when the
finite run-plan file changes. Routine progress/documentation commits do not
restart hosted tests. There is no schedule or pull-request secret-bearing run.
One staging run executes at a time, with an eight-minute timeout and no automatic
test retries. Only read access to repository contents is requested.

Node and browser installation steps receive no app credentials. Browser tools
are version-locked with an integrity-checked lockfile; GitHub actions are pinned
to verified official commit SHAs. Six secrets are assigned only to the check step.

The safe receipt is printed and added to the GitHub job summary. It contains
booleans, counts, fixed result codes, commit/run references and HTTP statuses.
It does not contain email addresses, passwords, access/refresh tokens, identity
UUIDs, workspace names, raw server bodies, browser logs, saved browser sessions,
screenshots, videos, traces or HAR. Do not add these to artifacts for diagnosis.

The runner's User-Agent contains the exact GitHub run ID and attempt. If cleanup
needs independent investigation, this uniquely tagged run can be distinguished
from older unbound Node sessions. A timeout or interrupted network operation can
leave cleanup unverified; do not broadly delete sessions based on counts or age.

## Verification and remaining scope

Nine offline guard checks cover credential/configuration rejection, fixed API
routes, expected roles/distinct actors, bounded requests, report privacy,
failure-path cleanup, cleanup failure and browser mutation/resend boundaries.
These checks do not constitute hosted acceptance. Record the actual workflow
receipt before crediting access readiness or AU01.05.

All previously accepted W observations remain retained. AU03.04 interruption/
retry stays owner-deferred. The other outstanding W variants, V/X/Y/Z, later
FRs, native/device/provider acceptance and release decisions remain governed by
their existing checklists and prerequisites. Extend the finite run plan only for
the next applicable existing scope after reconciling its fixtures and evidence.
