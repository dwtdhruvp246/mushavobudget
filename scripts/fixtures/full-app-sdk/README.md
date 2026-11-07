# Real SDK public offline fixture

These are the observed, unmodified jsDelivr ESM bytes imported by Supabase JS 2.110.9, downloaded on 24 October 2026. `manifest.json` records each exact URL, static imports, SHA256, byte length and corresponding published package license. Each module's adjacent LICENSE.txt preserves its package notice. This fixture is test-only and is not included in the deployed frontend ZIP.

The normal static closure has nine modules. The entry also has an optional nonliteral dynamic import of `@opentelemetry/api`, caught if unavailable and used only when tracing is enabled; the app does not enable that option. It is not a pinned or executed dependency in these tests. The test guard fulfills only the nine exact published module URLs and denies other destinations. V8 SourceTextModule checks the static dependencies without executing a substituted SDK.

The CDN describes these as generated builds. The hashes pin the observed fixture bytes, not a guarantee that future responses from a versioned CDN URL remain identical. Hosted acceptance must independently verify actual executed bytes. Synthetic loopback Auth/REST/Realtime/mail services do not establish real provider transport or concurrency behavior.
