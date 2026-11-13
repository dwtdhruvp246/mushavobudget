import { inflateSync } from "node:zlib";
import { LogoInputError } from "../validate-business-logo/png.mjs";

export const PDF_MAX_BYTES = 2 * 1024 * 1024;
const MAX_OBJECTS = 512;
const MAX_PAGES = 12;
const MAX_DECODED = 8 * 1024 * 1024;
const MAX_CONTAINER_DEPTH = 32;
const decoder = new TextDecoder("latin1");
const unsafeKeys = new Set([
  "/AA", "/OpenAction", "/A", "/JS", "/JavaScript", "/AcroForm", "/XFA", "/EF", "/AF",
  "/EmbeddedFiles", "/Collection", "/RichMediaContent", "/RichMediaSettings", "/Launch", "/URI",
  "/F", "/FFilter", "/FDecodeParms", "/Encrypt", "/Prev", "/XRefStm", "/Perms", "/Names",
  "/Outlines", "/Threads", "/Alternates", "/OPI", "/PieceInfo",
]);
const unsafeNames = new Set([
  "/Action", "/JavaScript", "/Launch", "/EmbeddedFile", "/Filespec", "/RichMedia",
  "/Movie", "/Sound", "/Screen", "/3D", "/GoToR", "/GoToE", "/SubmitForm", "/ImportData",
  "/XRef", "/ObjStm", "/Crypt", "/JBIG2Decode",
]);
const allowedCatalog = new Set(["/Type", "/Pages", "/Version", "/PageLayout", "/PageMode", "/Metadata"]);
const nameByte = byte => byte > 32 && byte < 127 && ![37, 40, 41, 47, 60, 62, 91, 93, 123, 125].includes(byte);
const allowedTrailer = new Set(["/Size", "/Root", "/Info", "/ID"]);
const invalid = () => new LogoInputError(422, "INVALID_PROOF_PDF");
const unsupported = () => new LogoInputError(422, "UNSUPPORTED_PROOF_PDF_STRUCTURE");
const bounded = () => new LogoInputError(413, "PROOF_PDF_PROCESSING_LIMIT");

function requireValid(condition) {
  if (!condition) throw invalid();
}

// The first staging batch accepts static, unencrypted PDFs with one classic
// xref table. Read objects only at the declared offsets, with no repair mode.
function readIndex(text) {
  const ending = /(?:^|[\r\n])startxref[\t ]*[\r\n]+([0-9]{1,8})[\t ]*[\r\n]+%%EOF[\t \r\n]*$/.exec(text.slice(-128));
  if (!ending) throw invalid();
  const offset = Number(ending[1]);
  const tail = text.slice(offset);
  if (!/^xref[\t ]*[\r\n]/.test(tail)) throw unsupported();
  const header = /^xref\s+0[\t ]+(\d{1,5})[\t ]*[\r\n]+/.exec(tail);
  if (!header) throw unsupported();
  const count = Number(header[1]);
  if (count > MAX_OBJECTS + 1) throw bounded();
  requireValid(count >= 4);
  const row = /(\d{10}) (\d{5}) ([nf])[\t ]*(?:\r\n|\n|\r)/y;
  const entries = [];
  let cursor = header[0].length;
  for (let id = 0; id < count; id++) {
    row.lastIndex = cursor;
    const match = row.exec(tail);
    requireValid(match);
    cursor = row.lastIndex;
    const [, rawOffset, rawGeneration, kind] = match;
    if (id === 0) requireValid(kind === "f" && rawGeneration === "65535");
    else if (kind === "n") {
      const start = Number(rawOffset);
      requireValid(rawGeneration === "00000" && start > 0 && start < offset);
      entries.push({ id, start });
    }
  }
  const trailer = /^\s*trailer\s*([\s\S]+?)\s+startxref[\t ]*[\r\n]+\d+[\t ]*[\r\n]+%%EOF[\t \r\n]*$/.exec(tail.slice(cursor));
  requireValid(trailer);
  entries.sort((a, b) => a.start - b.start);
  return { entries, offset, trailer: trailer[1], count };
}

function parseAt(bytes, pdf, context, budget, dict = false) {
  const parser = pdf.PDFObjectParser.forBytes(bytes, context);
  let depth = 0;
  const parseName = parser.parseName.bind(parser);
  parser.parseName = () => {
    for (let length = 1; nameByte(parser.bytes.peekAhead(length)); length++) {
      if (length > 128) throw bounded();
    }
    if (--budget.names < 0) throw bounded();
    return parseName();
  };
  const parse = parser.parseObject.bind(parser);
  parser.parseObject = () => {
    if (--budget.tokens < 0 || ++depth > MAX_CONTAINER_DEPTH) throw bounded();
    try { return parse(); }
    finally { depth--; }
  };
  // Parse stream dictionaries independently so the library cannot recover a
  // malformed stream or allocate decompressed data using untrusted metadata.
  const value = dict ? parser.parseDict() : parser.parseObject();
  return { value, length: parser.bytes.offset() };
}

function verifyObjects(pdf, context, trailer, decodeJpeg) {
  const { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef } = pdf;
  let remaining = MAX_DECODED;
  let imagePixels = 4_000_000;
  let nodes = 16000;
  function inspect(value, depth = 0) {
    if (--nodes < 0 || depth > MAX_CONTAINER_DEPTH) throw bounded();
    if (value instanceof PDFRef) {
      requireValid(context.lookup(value));
    } else if (value instanceof PDFDict) {
      for (const [key, child] of value.entries()) {
        if (unsafeKeys.has(key.asString())) throw unsupported();
        // Empty annotation arrays are common in generated receipts.
        if (key.asString() === "/Annots" && (!(child instanceof PDFArray) || child.size() !== 0)) throw unsupported();
        inspect(child, depth + 1);
      }
    } else if (value instanceof PDFArray) {
      for (const child of value.asArray()) inspect(child, depth + 1);
    } else if (value instanceof PDFName) {
      if (unsafeNames.has(value.asString())) throw unsupported();
    } else if (value instanceof PDFNumber) {
      requireValid(Number.isFinite(value.asNumber()));
    }
  }
  for (const [, value] of context.enumerateIndirectObjects()) {
    if (!(value instanceof PDFRawStream)) {
      inspect(value);
      continue;
    }
    inspect(value.dict);
    const filter = value.dict.get(PDFName.of("Filter"));
    const bytes = value.getContents();
    const image = value.dict.get(PDFName.of("Subtype")) === PDFName.of("Image");
    let width, height;
    if (image) {
      width = value.dict.get(PDFName.of("Width"))?.asNumber?.();
      height = value.dict.get(PDFName.of("Height"))?.asNumber?.();
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
        || width * height > imagePixels) throw bounded();
      imagePixels -= width * height;
    }
    if (filter === PDFName.of("FlateDecode")) {
      if (!remaining) throw bounded();
      remaining -= inflateSync(bytes, { maxOutputLength: remaining }).length;
    } else if (filter === PDFName.of("DCTDecode")) {
      if (!image || !decodeJpeg) throw unsupported();
      const decoded = decodeJpeg(bytes, {
        useTArray: true, formatAsRGBA: false, tolerantDecoding: false,
        maxResolutionInMP: 4, maxMemoryUsageInMB: 40,
      });
      requireValid(decoded?.width === width && decoded.height === height);
      remaining -= bytes.length;
    } else if (filter === undefined) {
      remaining -= bytes.length;
    } else {
      throw unsupported();
    }
    if (remaining < 0) throw bounded();
  }
  for (const [key] of trailer.entries()) if (!allowedTrailer.has(key.asString())) throw unsupported();
  inspect(trailer);

  const name = value => PDFName.of(value);
  const rootRef = trailer.get(name("Root"));
  const root = context.lookup(rootRef);
  requireValid(rootRef instanceof PDFRef && root instanceof PDFDict && root.get(name("Type")) === name("Catalog"));
  for (const [key] of root.entries()) if (!allowedCatalog.has(key.asString())) throw unsupported();
  const seen = new Set();
  let pages = 0;
  function visit(ref, parent, depth) {
    if (depth > MAX_CONTAINER_DEPTH) throw bounded();
    requireValid(ref instanceof PDFRef && !seen.has(ref));
    seen.add(ref);
    const node = context.lookup(ref);
    requireValid(node instanceof PDFDict && node.get(name("Parent")) === parent);
    if (node.get(name("Type")) === name("Page")) {
      if (++pages > MAX_PAGES) throw bounded();
      return 1;
    }
    const children = node.get(name("Kids"));
    const count = node.get(name("Count"));
    requireValid(node.get(name("Type")) === name("Pages") && children instanceof PDFArray && count instanceof PDFNumber);
    const total = children.asArray().reduce((sum, child) => sum + visit(child, ref, depth + 1), 0);
    requireValid(total > 0 && total === count.asNumber());
    return total;
  }
  visit(root.get(name("Pages")), undefined, 0);
  context.trailerInfo = { Root: rootRef };
}

export async function normalizeStaticPdf(bytes, pdf, decodeJpeg) {
  if (bytes.length > PDF_MAX_BYTES) throw bounded();
  try {
    const text = decoder.decode(bytes);
    requireValid(/^%PDF-1\.[0-7](?:\r\n|\n|\r)/.test(text));
    const { entries, offset, trailer, count } = readIndex(text);
    const context = pdf.PDFContext.create();
    const budget = { tokens: 16000, names: 12000 };
    const trailerBytes = bytes.subarray(text.indexOf("trailer", offset) + "trailer".length);
    const skip = /^\s*/.exec(decoder.decode(trailerBytes))[0].length;
    const parsedTrailer = parseAt(trailerBytes.subarray(skip, skip + trailer.length), pdf, context, budget, true);
    requireValid(parsedTrailer.length === trailer.length && parsedTrailer.value.get(pdf.PDFName.of("Size"))?.asNumber?.() === count);
    const headerEnd = text.search(/[\r\n]/);
    requireValid(entries.length && /^[\t \r\n]*(?:%[^\r\n]*(?:\r\n|\r|\n)[\t \r\n]*)*$/.test(text.slice(headerEnd, entries[0].start)));
    for (const [index, { id, start }] of entries.entries()) {
      const end = entries[index + 1]?.start ?? offset;
      const section = text.slice(start, end);
      const open = /^(\d+)\s+0\s+obj[\t \r\n]+/.exec(section);
      requireValid(open && Number(open[1]) === id);
      const startBody = start + open[0].length;
      const isDict = text.startsWith("<<", startBody);
      const { value, length } = parseAt(bytes.subarray(startBody, end), pdf, context, budget, isDict);
      let rest = startBody + length, object = value;
      const stream = /^[\t \r\n]*stream(?:\r\n|\r|\n)/.exec(text.slice(rest, end));
      if (isDict && stream) {
        const size = value.get(pdf.PDFName.of("Length"))?.asNumber?.();
        const first = rest + stream[0].length;
        requireValid(Number.isSafeInteger(size) && size >= 0 && first + size < end);
        const close = /^(?:\r\n|\n|\r)?endstream\b/.exec(text.slice(first + size, end));
        requireValid(close);
        object = pdf.PDFRawStream.of(value, bytes.subarray(first, first + size));
        rest = first + size + close[0].length;
      }
      requireValid(/^[\t \r\n]*endobj[\t \r\n]*$/.test(text.slice(rest, end)));
      context.assign(pdf.PDFRef.of(id), object);
    }
    verifyObjects(pdf, context, parsedTrailer.value, decodeJpeg);
    const output = await pdf.PDFWriter.forContext(context, Infinity).serializeToBuffer();
    if (output.length > PDF_MAX_BYTES) throw bounded();
    return output;
  } catch (error) {
    if (error instanceof LogoInputError) throw error;
    if (error?.code === "ERR_BUFFER_TOO_LARGE") throw bounded();
    throw invalid();
  }
}
