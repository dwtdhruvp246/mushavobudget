# 5.3 — Native origins, callbacks, permissions, transport and iOS privacy

**12 October 2026 / S5E05 — selected source and 11 existing local callback tests complete; one owner platform-configuration receipt pending.**
Source pin: `14f5926d6301b961e86e9bfaf1680aff83007c30`. [Five-step Stage 5 plan](SECURITY_STAGE_5_NATIVE_PLAN.md). [Source/local evidence](security-stage-5-platform-review.json).

5.1/5.2 stay complete with their scoped carry-forward. 5.3 remains active. APK update is deferred; full Stage 5 report stays at 5.5. No native source, identity, signing settings, hosted origin or Auth dashboard configuration is changed.

## Source facts and compatibility limits

| Area | Selected source fact | Required evidence still missing |
|---|---|---|
| Server origins | Business/admin invitation functions reject a nonempty request Origin that differs from configured APP_ORIGIN; they separately verify Auth and authorization | Effective function configuration, actual WebView Origin and supported native request contract |
| Callback construction | Auth confirmation/recovery uses `auth.html` relative to current page origin; Business invitations use server APP_ORIGIN | Exact native callback registrations, hosted redirect allowlist, browser/WebView handoff and verifier/state ownership |
| Existing link protections | Callback material is scrubbed early, isolated session storage is used, server identity is checked and normal session transfer requires the existing controlled flow | Real links, external-browser/native delivery, account switching, expiry/replay and app lifecycle evidence |
| Native bridge | Selected App bridge uses appStateChange to recheck access on resume; no appUrlOpen dispatcher was inspected in this selected bridge | MainActivity/custom platform routing, cold/warm link dispatch and validated OS registration |
| Web hardening | `_headers` contains selected web deployment controls, including an observation-only resource CSP | The builder does not copy this file as an asset; equivalent effective native local-server/WebView policy is unverified |
| Android configuration | 5.1 reports an untracked JSON config, main manifest and file_paths resource; 5.2 confirms backup enabled without rule references | Actual app ID/webDir/server fields, permissions, exports/filters, cleartext/debug flags and referenced transport/provider resources |
| iOS privacy | Current root package declares core/App/Preferences/Android; no iOS platform dependency or selected local root project was identified | Actual iOS target, Info.plist/entitlements/privacy resources, SDK list, required reasons and final signed archive |

**Conditional compatibility concern:** if the bundled WebView sends a local origin different from the selected invitation function's configured hosted APP_ORIGIN, that source guard will reject its nonempty Origin. We have not observed the actual native request or hosted settings; this is not a failed live request. Requests without an Origin still require the existing identity/authorization checks. Broad origin relaxation is not a repair plan.

Callback helpers preserve the current page origin; they do not establish that an emailed URL opens the installed app, that a WebView-local URL is a suitable email callback, or that state/verifier material is safely handed between a system browser and app storage. An OS link dispatcher needs explicit scheme/host/path validation and the existing verified identity/link contract. Google/Apple login implementation remains Stage 6; 5.3 records its native dependencies without installing it.

The historical LAST_WORKSPACE guidance says native notification/link integration retains its existing setup. That is not evidence that such setup is present in the owner's current source or final binary. No local-platform absence is generalized to every checkout/device.

## iOS declarations and current primary references

The [Capacitor v8 Preferences documentation](https://capacitorjs.com/docs/apis/preferences) identifies UserDefaults required-reason declaration `NSPrivacyAccessedAPICategoryUserDefaults` and recommends `CA92.1`. Its actual use must fit the selected permitted reason. Documentation or a standalone plist does not prove target inclusion.

Apple's [current third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/) explicitly list **Capacitor**. Listed SDKs require privacy manifests for the stated submission cases; signatures are additionally required when they are binary dependencies. Inspect the final dependency form and archive rather than assuming every package has the same signature requirement. App/SDK data use, required reasons and the archive privacy report must match the shipped implementation and Stage 4 factual disclosures.

[Capacitor configuration](https://capacitorjs.com/docs/config) distinguishes local schemes/hostname, remote server URL, navigation and debug/mixed-content options. Current defaults are reference guidance, not measured owner runtime origins. [Deep-link guidance](https://capacitorjs.com/docs/guides/deep-links) shows native registration plus App event routing; simply bundling the App plugin is not acceptance.

[Android application documentation](https://developer.android.com/guide/topics/manifest/application-element.html) explains transport attributes and their target/platform dependence, including interaction with a Network Security Configuration. An unset attribute or missing conventional filename is not alone an unsafe/secure verdict. Inspect the merged release policy and actual supported networking stacks before recording transport acceptance.

References were accessed 12 October 2026. They are primary current guidance, not inspection of the owner's installed SDKs or final native binary.

## Local evidence

**12 exact selected Git blob matches, zero mismatches.** Ten fetched texts include the existing test file; retained app/business bytes independently match current Git blobs. No runtime source is modified.

Selected command:

```text
node --test --test-name-pattern 'capture removes sensitive|link storage is tab-isolated|legacy Business callback|legacy ordinary recovery|a recovery flag without|Auth callback errors|wrong callback type|PKCE code exchange|server identity disagreement|verified session transfer|adopted server identity mismatch' tests/stage-3-auth-flows.test.mjs
```

**11 PASS / 0 FAIL / exit 0**, Node v24.19.0. These are existing callback/link-isolation/verified-transfer cases using synthetic material and mocked Auth responses. They do not exercise Android/iOS intents, APP_ORIGIN deployment, real link/email delivery, native permissions, TLS, server headers or privacy archives. They repeat a subset of earlier Auth tests and do not add 11 distinct controls.

Node emitted its non-failing MODULE_TYPELESS_PACKAGE_JSON warning when detecting ES module syntax in auth-security.js. No global package-type change is made; that would need review of existing CommonJS tools.

The PowerShell handoff was reviewed as source; no PowerShell runtime is available here, so the assistant has not executed or syntax-validated it on Windows.

## Owner handoff

Paste the complete PowerShell block in chat; saved counterpart: [read-stage-5-platform-config.ps1](../../scripts/read-stage-5-platform-config.ps1). It reads only selected public source configuration:

- Capacitor JSON: app ID, expected webDir, selected server schemes/hostname, redacted URL summary, navigation/debug/mixed-content/logging fields and plugin-config presence.
- Main Android manifest: requested permission names, component export/permission flags, selected intent filters and file-provider resource bindings.
- Referenced main/qualified XML transport/provider resources plus the conventional file_paths resource: selected declarative attributes and source hashes.

It suppresses whole config/plugin values, full server URLs and URL credentials/query/fragment contents; it does not read signing material, local.properties, .env, device/app storage or any credential value. Linked paths stop inspection, XML DTD/external resolution is disabled, and source/node sizes are bounded. It neither evaluates TypeScript/JavaScript config nor invokes Gradle, Capacitor, project scripts or devices.

The summary is selected source inspection, not a complete native-code/plugin audit or merged/resource-precedence analysis. JSON config alternatives, generated native assets, custom networking/OS-link code, flavor/debug/release/dependency overrides and final iOS sources remain unresolved where unavailable. Empty/UNSET/redacted fields must retain that meaning.

Return one JSON receipt. After it arrives, record one bounded source-configuration outcome. No setting toggle, SQL install, email/provider request, build/sync/install/sign/upload/store action or repeated setup loop is requested.

## Existing finding completion work

| Finding/dependency | Required final work |
|---|---|
| F10 origins/callbacks | Establish actual supported native origins and explicit server policy while preserving JWT/role/MFA/tenant checks; register precise native links and validate inbound URLs/state/verifier/identity across browser/app, cold/warm launch, expiry/replay and wrong-host cases |
| F05/F06 release/configuration | Preserve app ID/signing/local edits; reconcile source/package/build baselines; review final merged permissions/exports/provider scopes, transport/debug/navigation settings and actual packaged resources |
| F17 iOS privacy | Obtain real iOS source/target/SDK inventory, correct required-reason declarations and collection facts; verify target inclusion, applicable SDK signatures and privacy report in the final archive |
| F14/Stage 4 dependencies | Keep native token/backup work open and reconcile native collection/file handling with factual privacy/retention/deletion requirements |
| Stages 6/8/9 | Complete identity and push integration in their assigned stages, then execute device/store/artifact evidence rather than accepting helper mocks |

F10/F17 and existing dependencies remain open. No finding definitions are added or closed. Stage 0–4 objects, 5.1/5.2 outcomes, prior evidence, 123 original rows/20 definitions and retained synthetic fixtures remain preserved. Zero hosted/device/native-build/privacy-archive checks or runtime/settings/production mutations; APK update stays deferred.
