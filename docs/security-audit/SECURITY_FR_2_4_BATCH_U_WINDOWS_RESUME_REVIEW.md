# Batch U Windows local stop and resume-test correction

**Stage 3/10 | FR.2/8 | Batch U/Z — IN PREPARATION.** This stays within U; it neither adds a letter nor completes U's hosted exit gate.

FRE180 records the owner's uploaded result at published `fb19a36dc1f399972fa16bf399ffaa12e86d9c99`: Windows Node22.17.0, Chrome155.0.8059.79, PGlite0.5.8,279 source hashes and105 syntax checks,49/50 tests and combined exit1. The positive case stopped at `OLD_ACCOUNT_LATE_RESPONSE_AND_ACTUAL_CROSS_TAB_SIGNOUT` / `BROWSER_CHECK_TIMEOUT`. Its seven completed checks include real page/SDK/worker startup, native form reset, password-only lock, remembered cookie, session-local signout preservation and own SQL/RLS data loading. The old `SDK_refresh_and_view_rebind_verified` field used a weak criterion: a refresh request and a currently displayed canary, without both tabs' new-token request/response correlation. Preserve the raw report, but do not treat that field as stronger evidence than it supplies.

All nine cases reported exact selected synthetic cleanup, preexisting session/device/proof preservation, browser-context/process/profile cleanup and fixture closure. Zero staging requests, real emails, real credentials, mode changes or uploads occurred. The wrapper stopped before ZIP selection/preparation; its output directory was null. There is no new candidate ZIP from this attempt to retry or upload.

## What the stop establishes and leaves unknown

The positive case still had the app view, one synthetic local logout (the earlier sign-out check), one successful synthetic token refresh and no rejected network request or SQL error. Therefore the second UI signout had not completed. The coarse checkpoint covers the online refresh, held SQL response, UI signout and peer-view wait. Its exact inner timeout and the actual Windows visibility/startup state were not recorded. Source review identifies plausible prerequisites, not a proven Windows root cause: `refreshAfterAppResume()` returns while hidden, unauthorized or `appLoadPromise` is active. The old test created another tab, weakly accepted refresh completion, then dispatched `online` without checking these prerequisites.

The old negative-case assertion also accepted any contained error. In the owner's receipt the named `close` case stopped at the same earlier late-response checkpoint, rather than the intended main close-response-loss boundary. Cleanup containment is valid; the named close acceptance was not established. A configured close fault could also occur during cleanup, which does not substitute for reaching the intended main checkpoint. Earlier Linux results are preserved as historical executions; their assertion weakness is now explicitly corrected.

## Correction

Only the local driver, synthetic fixture, tests, verifier and evidence change. Product `app.js`, `session-entry.js`, worker, SDK bytes and the planned two-file candidate remain unchanged from the prior U product fixes.

- Correlate each of the two selected pages' new current-token proof request and successful payment-data response after refresh, then require both actual views to render the canary. An old rendered view alone cannot set refresh/rebind success.
- Arm the held finance response, bring the selected page to the foreground using the browser protocol, and require native `document.visibilityState === "visible"` before dispatching the actual app's online event. Keep the application's own resume guard; do not insert a production hook, invoke internal loaders, increase timeouts or bypass proof/roles.
- Split foreground, online trigger, held-SQL wait, UI signout, cross-tab signed-out view, private-DOM clearing, second-account sign-in and response release into separate safe checkpoints. Record only native visibility class, booleans/counts and fixed browser-operation names if an async failure occurs; never IDs, headers, tokens, DOM text or provider errors.
- Require each negative case's exact expected checkpoint and error code plus its executed synthetic fault marker. A refused profile-sync request has its own marker. Apply the same contract in the verifier. Two unit regressions reject an earlier contained timeout labelled as close and a correctly named boundary without its executed marker.

The full retry expects52 tests:32 retained entry tests,11 SDK/policy/artifact/named-fault units and9 browser cases. Existing budgets remain1600 intercepted attempts,400 preflights and one synthetic begin/verify/open/quarantine per case. No timeout increase, new dependency, installation or staging action is part of the correction. All eight injected fault boundaries must now be specifically observed for a pass.

## Next owner scope

After assistant tests and publication/archive hash readback pass, the complete pinned PowerShell wrapper is supplied in chat. It reuses the existing browser and PGlite0.5.8, extracts a new public source snapshot, runs all52 local tests and only then asks for the retained `mushavo-pages-offline-review.zip`. It prepares `mushavo-batch-u-lifecycle-review.zip` in a new Desktop folder, changes the same two product files, preserves42 entries/public configuration/key/worker/headers and verifies every entry with Windows .NET. Keep that candidate local for receipt review.

Expected prompts remain: an existing Edge/Chrome executable path only if auto-detection fails, then the retained public ZIP's full path only after all local checks pass. No password, token, inbox/code, DPAPI packet or browser login prompt. Public test-dependency fallback uses the existing lockfile only if no retained PGlite exists. No blind email resend/window reopen or T repeat.

Windows root-cause confirmation and corrected Windows outcome remain pending until the new receipt. Hosted U acceptance, real-input storage isolation, legitimate startup-write preconditions, full Business/role/privileged matrices and release approval remain open. The last hosted database-mode observation remains T's QUARANTINED receipt at2026-10-24T07:43:01.498Z. No findings closed; production/native excluded and APK deferred.

FRE181 assistant validation:52/52 PASS,280 hashes/106 syntax, Nodev24.22.1, nine native-browser cases including all eight exact injected fault boundaries. One earlier exploratory corrected-flow run completed17 checks but reported an unclassified asynchronous CDP_COMMAND_REQUIRED; cleanup passed. Fixed-operation diagnostics were then added, and the next positive and combined suite passed. That exploratory stop is preserved separately and is not evidence of the exact Windows cause. No product source, timeout, network budget, SDK or retained artifact change in this follow-up.
