# Stage 4 / FR.3.2 JPEG logo trial

This candidate extends the isolated Business logo workspace to baseline and progressive 8-bit JPEG with one or three components. The 2 MiB input and output limits and 1024 × 1024 dimensions still apply. The validator bounds marker and scan counts and decoder memory, then normalizes the decoded pixels into a PNG with EXIF orientation applied. The output strips source metadata and uses the same private path and upload retry contract as the PNG trial.

JPEG decoding uses jpeg-js 0.4.4 with exact npm and Deno lock entries. Node and Deno tests exercise baseline, progressive, grayscale, rotation, malformed files, dimension rejection, output shape and immutable retries. The Edge entry point passed a frozen Deno type check. No Storage policy or permission changes are required.

The existing [hosted PNG and browser result](security-fr-3-2-business-logo-browser-and-size-closeout.json) remains the baseline. The completed one-time JPEG API run verified declared-type mismatch, normalization, immutable retry, branding save, private readback and exact cleanup. A separate hosted Chromium run served the exact candidate, uploaded the JPEG with its correct media type, saved it through Business setup and rendered the oriented PNG after reload.

Independent staging readback found the fixture suspended at support version 18 with an empty logo, zero trial objects and sessions, and zero queued messages. Both live plans are disabled. The wider FR.3.2 work, including WebP and other upload types, remains open.

[Hosted JPEG closeout](security-fr-3-2-business-logo-jpeg-closeout.json)
