# Stage 4 / FR.3.2 static WebP logo trial

The isolated staging workspace can accept static lossy and lossless WebP, including transparency. The validator checks the RIFF size, chunk bounds, canvas and image dimensions before decoding, then writes a metadata-free PNG. EXIF orientation uses the same code as JPEG. Animated files, embedded ICC profiles and unknown chunks are outside this trial. The 2 MiB and 1024 × 1024 trial limits remain in effect.

The decoder is @stacksjs/ts-webp 0.1.7, pinned with integrity in the Deno and npm locks. Independently encoded fixtures passed the targeted checks. Local results cover 23 Node tests, 19 Deno tests and the frozen entry point type check. The API passed 14 checks, including animated and mislabeled file rejection, immutable retry, branding linkage and exact private readback. Hosted Chromium uploaded the WebP through Business setup and rendered the oriented PNG after reload. Independent readback confirmed the fixture is suspended, the gate is closed and no trial files or sessions remain. Both run plans are archived.

[Hosted WebP closeout](security-fr-3-2-business-logo-webp-closeout.json)

[Prior JPEG acceptance](security-fr-3-2-business-logo-jpeg-closeout.json) · [Prior PNG acceptance](security-fr-3-2-business-logo-browser-and-size-closeout.json)
