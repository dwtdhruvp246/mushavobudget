import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import test from "node:test";
import jpeg from "../scripts/fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js";
import { pdf, receiptPdf } from "../scripts/fixtures/pdf-proof-tools/fixtures.mjs";
import { normalizeStaticPdf, PDF_MAX_BYTES } from "../supabase/functions/validate-payment-proof/pdf.mjs";
import { createProofHandler, OWNER, PAYMENT_ITEM, PREFIX, WORKSPACE } from "../supabase/functions/validate-payment-proof/handler.mjs";

const normalize = bytes => normalizeStaticPdf(bytes, pdf, jpeg.decode);
const document = await receiptPdf();

test("static PDF receipts survive canonical serialization and reopen with the same page count", async () => {
  const image = jpeg.encode({ width: 3, height: 4, data: Buffer.alloc(48, 160) }).data;
  for (const input of [document, await receiptPdf({ pages: 3, jpeg: image })]) {
    const output = await normalize(input);
    assert.deepEqual(await normalize(output), output);
    const source = await pdf.PDFDocument.load(input);
    const saved = await pdf.PDFDocument.load(output);
    assert.equal(saved.getPageCount(), source.getPageCount());
    assert.deepEqual(saved.getPage(0).getSize(), source.getPage(0).getSize());
  }
});

test("rejects truncated, mislabeled and unsupported PDF structures", async () => {
  const malformed = Buffer.from(document);
  const firstRow = malformed.indexOf("0000000016 00000 n");
  assert.ok(firstRow > 0);
  malformed[firstRow + 9] = 55;
  for (const input of [Buffer.from("%PDF-1.7\n"), document.slice(0, -8), malformed]) {
    await assert.rejects(normalize(input), { message: "INVALID_PROOF_PDF" });
  }
  await assert.rejects(normalize(await receiptPdf({ objectStreams: true })), { message: "UNSUPPORTED_PROOF_PDF_STRUCTURE" });
});

test("rejects attachments and interactive document structure", async () => {
  const d = await pdf.PDFDocument.load(document, { updateMetadata: false });
  d.catalog.set(pdf.PDFName.of("AcroForm"), d.context.obj({ Fields: [] }));
  const input = await d.save({ useObjectStreams: false, updateFieldAppearances: false });
  await assert.rejects(normalize(input), { message: "UNSUPPORTED_PROOF_PDF_STRUCTURE" });
});

test("enforces input, page and decompressed stream limits", async () => {
  await assert.rejects(normalize(new Uint8Array(PDF_MAX_BYTES + 1)), { message: "PROOF_PDF_PROCESSING_LIMIT" });
  await assert.rejects(normalize(await receiptPdf({ pages: 13 })), { message: "PROOF_PDF_PROCESSING_LIMIT" });
  const d = await pdf.PDFDocument.load(document, { updateMetadata: false });
  const stream = d.context.stream(deflateSync(Buffer.alloc(8 * 1024 * 1024 + 1)), { Filter: "FlateDecode" });
  d.getPage(0).node.set(pdf.PDFName.of("Contents"), d.context.register(stream));
  const input = await d.save({ useObjectStreams: false, updateFieldAppearances: false });
  await assert.rejects(normalize(input), { message: "PROOF_PDF_PROCESSING_LIMIT" });
});

test("the Personal endpoint stores only canonical PDF bytes and returns immutable metadata", async () => {
  const objects = new Map();
  const handler = createProofHandler({
    configured: () => true, allowedOrigin: () => false, gateReady: async () => true, normalizePdf: normalize,
    createUserClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) },
      rpc: async name => ({ data: name === "app_session_status" ? { session_valid: true }
        : [{ workspace_id: WORKSPACE, read_only: false, effective_status: "active" }] }),
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: { id: PAYMENT_ITEM, workspace_id: WORKSPACE, owner_id: OWNER, visibility: "personal", family_id: null, status: "active" },
      }) }) }) }),
    }),
    store: async (path, bytes, type) => {
      assert.equal(type, "application/pdf");
      if (objects.has(path)) throw Error("already stored");
      objects.set(path, new Blob([bytes], { type }));
    },
    read: async path => objects.get(path),
  });
  const send = body => handler(new Request("https://proof.test.invalid", {
    method: "POST", headers: { "content-type": "application/pdf", authorization: "Bearer " + "a".repeat(32) }, body,
  }));
  const invalid = await send(Buffer.from("receipt"));
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error, "INVALID_PROOF_PDF");
  assert.equal(objects.size, 0);
  const first = await send(document);
  assert.equal(first.status, 200);
  const file = await first.json();
  assert.ok(file.path.startsWith(PREFIX) && file.path.endsWith(".pdf"));
  assert.equal(file.type, "application/pdf");
  assert.equal(file.size, objects.get(file.path).size);
  assert.deepEqual(await (await send(document)).json(), file);
  assert.equal(objects.size, 1);
});
