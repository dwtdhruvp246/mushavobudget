# Browser trust installed: fresh signup prerequisite

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE233.

The owner completed the source-pinned Windows preparation with exit0, 48 source hashes, 44 public files, seven changed entries, 37 preserved entries and independent .NET readback. The input ZIP is unchanged. The new ZIP SHA256 is `53437a8f2b452b387f75bcbca512b08e08f29a6b446f33de28660154a03301f5`; its SQL SHA256 matches the published candidate.

The subsequent SQL result is `PERSISTENT_BROWSER_TRUST_INSTALLED_QUARANTINED`, with catalog identity matched, 148 guarded RPCs, 82 restrictive policies and application access opened false. This records an owner-provided SQL result, not an independent database query by the assistant.

Deployment: https://f3dc8933.mushavo-budget-staging.pages.dev/. Six changed public assets (`auth-flows.js`, `auth.html`, `auth-security.js`, `email-verification.js`, `session-entry.js`, `styles.css`) and preserved `config.js`/`sw.js` match the receipt at both that deployment and https://mushavo-budget-staging.pages.dev/: 16/16 selected source cases pass. The private `_worker.js` body is not exposed as a public asset. Exact Worker runtime and real browser behavior remain unaccepted. One web-reader lookup was unavailable; direct bounded HTTP source checks succeeded. Redirect followups are excluded from the count of 16 initial selected reads.

Evidence: [owner package/install/deployment receipt](security-fr-2-batch-w-browser-trust-owner-install-and-deployment.json), [public hash readback](security-fr-2-batch-w-browser-trust-public-readback.json). Original 194 local cases remain scoped to source `a1feb46df4a8c118a7e7a7d2255d4dd4e82448b4`; no new local tests, SQL/management calls, Auth requests or real emails were run by the assistant here.

The next required input is one unused email inbox controlled by the owner. Both earlier signup identities have already been confirmed and their original links consumed. Neither can exercise first-time confirmation/browser enrollment again. Do not guess a plus alias, recreate/reset those accounts, resend consumed links or treat password-only access on an existing account as proof of signup browser enrollment.

After that inbox is supplied, prepare a narrow fresh signup/link acceptance sequence. Keep one browser profile and its cookies through signup, opening the original link and later password sign-in. The confirmation step must finish with the intended account and trusted-browser success without requesting a separate code. Protected application sign-in must be tested only when the existing bounded staging acceptance controller has admitted the intended confirmed identity. Any test-window opening is separate; staging currently remains quarantined. A different browser should then need one code, and subsequent sign-ins on that browser should restore trust.

No further ZIP preparation, upload, installation SQL, credential entry, account action or acceptance-window opening is needed for the current receipt checkpoint. If the owner prefers testing an existing account first, it may require one new-device email code to enroll the browser; that does not verify the fresh-signup auto-trust path. Retain those identities and previous results.

Batch V Admin MFA remains on hold. Full W, FR.2, Stage3, release acceptance and all findings remain open. Production/native are unchanged and APK work remains deferred.
