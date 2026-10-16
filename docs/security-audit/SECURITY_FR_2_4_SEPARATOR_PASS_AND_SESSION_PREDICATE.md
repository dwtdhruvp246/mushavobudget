# Update — owner Windows check passed

16 October 2026, FRE66. [Owner receipt](security-fr-2-email-session-owner-Windows-pass.json): 24 PASS, 61 source hashes, Node v22.17.0, exit 0. Do not repeat this component batch. [Continue to FR.2.4.E4.3 database integration](SECURITY_FR_2_4_SESSION_PASS_AND_DATABASE_GUARDS.md). No hosted enforcement was installed. The original handoff follows as historical evidence.

---

# FR.2.4.E4.2 — separator alignment received; shared session check ready for Windows

16 October 2026, FRE65. The owner returned a successful staging transaction receipt at 05:24:10.809717 UTC. [Exact owner receipt](security-fr-2-bill-reminder-separator-owner-pass.json) records the corrected bill-reminder body MD5, preserved line endings and protected metadata, and source parity for the selected 278 non-event functions under assertions. No scheduler/provider was invoked and email enforcement was not installed. This resolves the narrow separator drift; it does not establish complete authorization, scheduler or login acceptance. The earlier 277-match comparison remains historical evidence from before correction.

## New source

[Candidate SQL](../../supabase/candidates/security_fr_2_4_email_session_predicate.sql), [verifier](../../scripts/verify-fr-2-email-session.mjs), [61-file manifest](security-fr-2-email-session-source-manifest.json), [24 local checks](security-fr-2-email-session-local-checks.json), [contract](security-fr-2-email-session-candidate-contract.json).

The new private predicate derives the actor and session from the current Auth request. It takes no user/session IDs or claimed verification booleans from RPC arguments. It requires an authenticated request, canonical UUID actor/session fields, a future numeric access-token expiry, coherent Auth actor/role helpers, and the E2 backend's stored proof joined to the actual session/account security version and active profile. The backend checks confirmation, ban state and session timebox. Missing/malformed claims return false; database permission/configuration failures are not silently accepted. PostgreSQL request claims are trusted only after the API has authenticated the JWT. Local claim settings do not establish provider signature validation.

The two authenticated-only public wrappers expose either the caller's boolean or a fixed EMAIL_VERIFICATION_REQUIRED permission denial. The private helper remains inaccessible to all API roles. All three functions pin search_path=pg_catalog and retain a distinct email-proof contract; there is no forged AAL2, platform-role promotion or blanket service-token exemption. Existing service-only challenge/status functions remain the gateway's trusted path. A service caller with a validated user bearer still needs the correct purpose-specific check before privileged application work; it must not call a user wrapper using only its service token and assume approval.

This is explicitly an offline candidate requiring its own acknowledgement and the E2 backend. It refuses preexisting entrypoint names, including overloads. It adds no table, replaces no application function and attaches no application policy. The canonical schema/versioned migration, full table/RPC/Storage/Edge/Admin integration, login/code/remember-device frontend and coordinated Pages deployment remain pending. These functions are a tested component of that work, not a global gate ready to enable by itself.

## Actual local evidence

24 cases pass on Node v24.19.0 with PGlite 0.5.8, the complete unchanged 54-migration source and actual E2/candidate SQL. The manifest hashes 61 source/tool inputs. The database has explicit synthetic stand-ins for provider Auth columns/sessions; it is not connected to hosted Auth. Checks exercise ordinary and Admin password-only denial, actual challenge-to-proof authorization, account/session substitution, missing/malformed/expired claims, false verification/AAL2/Admin flags, API/private helper grants, a fixed permission assertion, security-version changes, password invalidation, suspension/reactivation, session deletion and day-seven behavior.

A temporary restrictive policy runs on the real modeled public.profiles table: unverified reads return no rows, verified ordinary reads retain ownership isolation, and a verified platform Admin retains its preexisting role authorization. A clearly named synthetic SECURITY DEFINER RPC proves the assertion reads the original request context even under definer execution and keeps a separate ownership check. These two representative fixtures are removed and prior public function/policy/trigger metadata is compared unchanged. This does not claim all 180 user-executable functions, every table, real Storage, Edge service paths, frontend or hosted authorization is covered.

The behavior checks reused the existing PGlite 0.5.8 installation. A fresh local npm ci --offline attempt returned ENOTCACHED because its package tarball is absent from the npm cache. Fresh locked installation is therefore an explicit Windows check, not a claimed local success.

## Owner handoff

Run the complete PowerShell command supplied in chat. It fetches the pinned commit, exports selected files to a fresh temporary folder, installs only the locked PGlite dependency there with npm.cmd ci --ignore-scripts, and executes the new checks in an in-memory database. npm contacts its registry during dependency installation; the test batch then disables default Node fetch/HTTP transport. That transport guard is not an operating-system sandbox. No root dependency installation, Git checkout, Supabase SQL, Cloudflare upload/token, Zoho credential file, email or APK action is requested. The manifest checks source bytes and package metadata; installed package bytes are not independently hashed.

Return only the new JSON and exit code. Expected result: OFFLINE_ACTUAL_SESSION_PREDICATE_AND_REPRESENTATIVE_GUARDS_SCOPED_PASS, 24 PASS, zero FAIL, exit 0. If any step fails, return the failure before retrying or changing guards. Windows execution is pending; the previous local result is not counted as an owner result. Do not paste this candidate SQL into the hosted SQL editor yet.

All 20 original findings stay open. Release gate OPEN_PENDING_REQUIRED_EVIDENCE; full re-audit PLANNED_NOT_PERFORMED. Hosted/native/store acceptance remains false, production excluded and APK deferred. Prior audit stages, evidence events, retained fixtures and carry-forward work remain preserved.
