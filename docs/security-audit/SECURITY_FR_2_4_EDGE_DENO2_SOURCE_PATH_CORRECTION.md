# E5.13 Deno 2 download path mapping correction

21 October 2026, FRE112. The [owner revision-two result](security-fr-2-email-edge-impact-owner-revision2-source-review.json) identifies the exact rejection reached at `2026-10-21T18:53:01.852Z`: `METADATA_ENTRYPOINT`. Four fixed GETs returned HTTP 200; the three multipart parts contained one metadata part and two source files with relative filenames. Only `deno2_entrypoint_path` was present, and its normalized value did not equal the detail endpoint's path. No private path string or source body was supplied to the assistant.

The revision-two checker incorrectly required literal equality across these two path namespaces. Its earlier fixture set did not represent this download convention. It refused the metadata equality guard before mapping filenames or comparing bytes. Therefore the two expected filename booleans remained false because their checks were not reached; they do not establish missing files. Source bytes and shared runtime impact remain unverified. The after-detail and after-list requests were not made.

## Revision three correction

The [pinned first-party Supabase CLI implementation](https://github.com/supabase/cli/blob/7e3035c644f4528833dd7a6a992535ded7158a8f/apps/cli/src/shared/functions/download.ts), read directly during this correction, provides the relevant semantics:

- Prefer a nonempty string `deno2_entrypoint_path` from multipart metadata, then the primary metadata entrypoint, then detail metadata when the source has no metadata part.
- Map source paths relative to that effective body entrypoint when both paths have the same absolute/relative form. When their forms differ, treat the downloaded path as relative to the function directory.
- The body metadata's entrypoint is not required to be the same literal string as the detail endpoint's entrypoint.

The checker now follows that entrypoint precedence and mapping in a fixed virtual directory using POSIX string operations on every host, including Windows. The virtual directory is never created or accessed. Original raw path validation still rejects traversal segments before URL parsing, encoded paths, remote URLs, backslashes and control characters. The effective entrypoint must have the exact basename `index.ts`. Every resulting mapped destination must be exactly one of `index.ts` or `handler.mjs`, with no duplicates. Matching only arbitrary basenames is insufficient: files outside the declared body namespace are rejected.

This deliberately changes the erroneous cross-endpoint path-equality requirement and the rejection of legitimate relative filenames. It does not change the required fixed project/host, prior metadata digest, sole contact slug, absent selected routes, JWT/import-map controls, two-file count, exact byte comparisons, response bounds, private output contract or before/after detail/list identity checks. Details still must agree with the original list and remain unchanged across the source download. Namespace mapping does not create a write lock or certify future runtime state.

The receipt has `diagnostic_revision: 3`. Existing `metadata_entrypoint_matches_detail` remains truthful and may be false in a successful result. New fixed diagnostic fields report which entrypoint source was selected, whether its form was absolute or relative, whether the exact two-file mapping completed, and the count of mapped relative file parts. None contains raw paths, source or metadata values. Mapping completion alone is not source-byte acceptance; altered mapped bytes still yield `FUNCTION_SOURCE_MISMATCH` and stop before the after-reads.

## Validation

Forty-three cases pass with eight source hashes and four JS syntax checks. The 33 existing cases are retained with assertions adjusted where path semantics intentionally changed, and ten cases cover:

- The observed two-relative-file/Deno-2-entrypoint shape with exact known local source bytes.
- Relative package prefixes, absolute body namespaces and mixed absolute/relative path forms.
- Deno 2 precedence when both entrypoint fields exist.
- Rejection of traversal, encoded/remote entrypoints and other entrypoint filenames.
- Rejection of changed inert source bytes, duplicate normalized paths, destination aliases and unrelated namespace paths.

All provider metadata, source-body paths and credential-like values in these fixtures are synthetic. The actual private path strings and source bytes from the owner were not received or reproduced. The correction covers the observed shape and first-party convention; successful hosted source parity is still pending. The real contact configuration reader remains exercised locally. A clean Git-tree export rehearsal is recorded without doubling the distinct test count. The original 25-case receipt, revision-two 33-case receipt and both owner error results remain unchanged.

## Owner handoff and remaining gates

Use the complete newly pinned block supplied in chat. It runs the 43-case verifier, parses the Windows parent and then prompts privately for the same staging-only read token. There are no additional permissions, npm packages, SQL requests, secret-list calls, source extraction or write operations. The maximum remains six fixed GETs with the same time/size limits and no retry/fallback. The parent requires revision three before printing the result. Return both safe JSON outputs and both exit codes.

No deployed function or configuration is modified by this checker. Source parity, private value validation, shared runtime impact, deployable recovery, external caller containment, write targeting, coordinated deployment/recovery and hosted acceptance remain open. All findings stay open, live activation stays unapproved, production/native stay unchanged and APK work remains deferred. The accepted source package and application/SQL sources are unchanged.
