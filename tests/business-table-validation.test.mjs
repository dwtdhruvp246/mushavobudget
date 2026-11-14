import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { CSV_MIME, XLSX_MIME, normalizeCsv, validateXlsx } from "../supabase/functions/validate-business-table/table-files.mjs";
import { createProofHandler } from "../supabase/functions/validate-payment-proof/handler.mjs";
import { BUCKET, OWNER, bindBusinessTable, documentPrefix, tableDocuments } from "../supabase/functions/validate-business-table/scope.mjs";
import { csvCanonical, csvFixture, formatExamples, xlsxFixture } from "../scripts/fixtures/business-table-tools/fixtures.mjs";

const sax = createRequire(new URL("../scripts/fixtures/business-table-tools/package.json", import.meta.url))("sax");
const csv = value => Buffer.from(value);
const xlsx = options => validateXlsx(xlsxFixture(options), sax);

test("normalizes CSV quoting, line endings and signed numeric cells", () => {
  assert.deepEqual(Buffer.from(normalizeCsv(csvFixture)), csvCanonical);
  assert.equal(Buffer.from(normalizeCsv(csv('Name,Note\r\nTea,"first\r\nsecond"'))).toString(),
    '"Name","Note"\r\n"Tea","first\r\nsecond"\r\n');
});

test("rejects malformed CSV, invalid UTF-8 and ambiguous CSV dialects", () => {
  for (const sample of [csv('x,"y'), csv('x,y\nz'), csv('x"y,z'), csv("sep=;\na;b"), csv("x,\ty"), Buffer.from([0xff])]) {
    assert.throws(() => normalizeCsv(sample), {status: 422});
  }
});

test("refuses INERT arithmetic in spreadsheet formula positions", () => {
  for (const value of ["=1+1", "  +1+1", "＠SUM(1)", "-1+1"]) {
    assert.throws(() => normalizeCsv(csv('Name,Value\nTea,"' + value + '"')), {message: "PROOF_CSV_FORMULA_UNSUPPORTED"});
  }
});

test("applies CSV field and row budgets", () => {
  assert.throws(() => normalizeCsv(csv("x".repeat(16385))), {status: 413});
  assert.throws(() => normalizeCsv(csv("x\n".repeat(5001))), {status: 413});
});

test("returns the identical XLSX archive for a passive workbook", () => {
  const input = xlsxFixture();
  assert.equal(validateXlsx(input, sax), input);
});

test("rejects XLSX formulas and external workbook relationships", () => {
  assert.throws(() => xlsx({cell:formatExamples.formula}), {message: "PROOF_XLSX_ACTIVE_CONTENT_UNSUPPORTED"});
  assert.throws(() => xlsx({relationship:formatExamples.externalRelationship}), {message: "PROOF_XLSX_ACTIVE_CONTENT_UNSUPPORTED"});
});

test("rejects unsupported XLSX parts, malformed XML and ZIP truncation", () => {
  assert.throws(() => xlsx({extra:{"xl/other.xml":"<other/>"}}), {message: "UNSUPPORTED_PROOF_XLSX_PART"});
  assert.throws(() => xlsx({worksheetTail:"<other/>"}), {message: "INVALID_PROOF_XLSX_XML"});
  assert.throws(() => validateXlsx(xlsxFixture().subarray(0,-12), sax), {message: "INVALID_PROOF_XLSX"});
  const changed = xlsxFixture();
  changed[14] ^= 1;
  assert.throws(() => validateXlsx(changed, sax), {message: "INVALID_PROOF_XLSX"});
});

test("enforces XLSX entry and upload size limits", () => {
  assert.throws(() => xlsx({cell:" ".repeat(2097152)}), {status: 413});
  assert.throws(() => validateXlsx(Buffer.alloc(2097153), sax), {status: 413});
});

test("the Business table adapter resolves each MIME into its reserved document path", () => {
  assert.equal(BUCKET, "business-documents");
  for (const [mime, id] of tableDocuments) {
    assert.equal(bindBusinessTable({}, OWNER, mime).prefix, documentPrefix(id));
  }
  assert.equal(bindBusinessTable({}, OWNER, "application/pdf"), null);
  assert.equal(bindBusinessTable({}, "outside-account", CSV_MIME), null);
  assert.equal(tableDocuments.size, 2);
});

test("the shared handler persists only normalized, read-back-verified data", async () => {
  const objects = new Map();
  const handler = createProofHandler({
    configured: () => true,
    allowedOrigin: () => true,
    createUserClient: () => ({ auth: {getUser: async () => ({data:{user:{id:OWNER}}})} }),
    bind: (_client, _id, mime) => ({prefix: documentPrefix(tableDocuments.get(mime)), canWrite: async () => true}),
    gateReady: async () => true,
    store: async (path, data, mime) => objects.set(path, new Blob([data], {type:mime})),
    read: async path => objects.get(path),
    decodeJpeg: null, decodeWebp: null, standardFormats: false,
    extraFormats: new Map([[CSV_MIME,{suffix:".csv",normalize:normalizeCsv}],
      [XLSX_MIME,{suffix:".xlsx",normalize:bytes => validateXlsx(bytes,sax)}]]),
  });
  const call = (type, body) => handler(new Request("https://example.invalid", {
    method: "POST", headers: {authorization: "Bearer " + "a".repeat(32), "content-type": type}, body,
  }));
  assert.equal((await call("image/png", csvFixture)).status, 415);
  assert.equal((await call(XLSX_MIME, csvFixture)).status, 422);
  assert.equal(objects.size, 0);
  const result = await call(CSV_MIME, csvFixture);
  assert.equal(result.status, 200);
  const value = await result.json();
  assert.equal(value.type, CSV_MIME);
  assert.equal(value.size, csvCanonical.length);
  assert.deepEqual(Buffer.from(await objects.get(value.path).arrayBuffer()), csvCanonical);
});
