import { LogoInputError } from "../validate-business-logo/png.mjs";

export const CSV_MIME = "text/csv";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_BYTES = 2097152;
const MAX_CELLS = 50000;
const MAX_FIELD = 16384;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();
const reject = (code = "INVALID_PROOF_TABLE") => { throw new LogoInputError(422, code); };
const limit = () => { throw new LogoInputError(413, "PROOF_TABLE_PROCESSING_LIMIT"); };

function boundedInput(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) reject();
  if (bytes.length > MAX_BYTES) limit();
}
function decode(bytes) {
  try { return utf8.decode(bytes); }
  catch { return reject(); }
}

export function normalizeCsv(bytes) {
  boundedInput(bytes);
  const text = decode(bytes);
  if (!text || /^sep\s*=/i.test(text.trimStart()) || /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/.test(text)) reject("INVALID_PROOF_CSV");
  const rows = [];
  let row = [], field = "", state = "start", cells = 0, width;
  function addField() {
    if (++cells > MAX_CELLS || row.length >= 128 || field.length > MAX_FIELD) limit();
    const value = field.trimStart();
    const signedNumber = /^[+-](?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trimEnd());
    if (/^[\t\r\n]/.test(field) || (/^[=+\-@＝＋－＠]/u.test(value) && !signedNumber)) {
      reject("PROOF_CSV_FORMULA_UNSUPPORTED");
    }
    row.push(field);
    field = "";
    state = "start";
  }
  function addRow() {
    addField();
    width ??= row.length;
    if (row.length !== width) reject("INVALID_PROOF_CSV");
    if (rows.length >= 5000) limit();
    rows.push(row.map(value => '"' + value.replaceAll('"', '""') + '"').join(","));
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === "quoted") {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i++; }
        else state = "closed";
      } else field += c;
    } else if (c === ",") addField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i+1] === "\n") i++;
      addRow();
    } else if (c === '"' && state === "start") state = "quoted";
    else {
      if (state === "closed" || c === '"') reject("INVALID_PROOF_CSV");
      field += c;
      state = "bare";
    }
    if (field.length > MAX_FIELD) limit();
  }
  if (state === "quoted") reject("INVALID_PROOF_CSV");
  if (row.length || field.length || state !== "start") addRow();
  if (!rows.length || !text.trim()) reject("INVALID_PROOF_CSV");
  const normalized = encoder.encode(rows.join("\r\n") + "\r\n");
  if (normalized.length > MAX_BYTES) limit();
  return normalized;
}

const core = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";
const docRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const ct = "http://schemas.openxmlformats.org/package/2006/content-types";
const props = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties";
const theme = "http://schemas.openxmlformats.org/drawingml/2006/main";
const appProps = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties";
const basicParts = new Map([
  ["[Content_Types].xml", ["Types",ct]],
  ["_rels/.rels", ["Relationships",rel]],
  ["xl/_rels/workbook.xml.rels", ["Relationships",rel]],
  ["xl/workbook.xml", ["workbook",core]],
  ["xl/sharedStrings.xml", ["sst",core]],
  ["xl/styles.xml", ["styleSheet",core]],
  ["xl/theme/theme1.xml", ["theme",theme]],
  ["docProps/core.xml", ["coreProperties",props]],
  ["docProps/app.xml", ["Properties",appProps]],
]);
const sheetPath = /^xl\/worksheets\/sheet[1-9]\d{0,2}\.xml$/;
const allowedPart = name => basicParts.has(name) || sheetPath.test(name);
const mandatoryParts = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"];
const expectedTypes = new Map([
  ["xl/workbook.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],
  ["xl/sharedStrings.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"],
  ["xl/styles.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"],
  ["xl/theme/theme1.xml","application/vnd.openxmlformats-officedocument.theme+xml"],
  ["docProps/core.xml","application/vnd.openxmlformats-package.core-properties+xml"],
  ["docProps/app.xml","application/vnd.openxmlformats-officedocument.extended-properties+xml"],
]);
const worksheetType = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";

const crcTable = Uint32Array.from({length: 256}, (_, index) => {
  let word = index;
  for (let bit = 0; bit < 8; bit++) word = (word >>> 1) ^ (word & 1 ? 0xedb88320 : 0);
  return word;
});

function crc32(bytes) {
  let word = 0xffffffff;
  for (const byte of bytes) word = (word >>> 8) ^ crcTable[(word ^ byte) & 255];
  return (word ^ 0xffffffff) >>> 0;
}

function unpack(input, size, Inflate) {
  const output = new Uint8Array(size);
  const inflate = new Inflate({ raw: true, chunkSize: 16384 });
  let written = 0;
  inflate.onData = chunk => {
    if (written + chunk.length > size) limit();
    output.set(chunk, written);
    written += chunk.length;
  };
  if (!inflate.push(input, true) || !inflate.ended || inflate.err !== 0
      || inflate.strm.avail_in !== 0 || written !== size) reject("INVALID_PROOF_XLSX");
  return output;
}

function readParts(bytes, Inflate) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16 = i => view.getUint16(i,true), u32 = i => view.getUint32(i,true);
  const end = bytes.length - 22;
  if (end < 0 || u32(end) !== 0x06054b50 || u32(end+4) || u16(end+20) || u16(end+8) !== u16(end+10)) reject("INVALID_PROOF_XLSX");
  const count = u16(end+10), index = u32(end+16);
  if (count > 64) limit();
  if (!count || index > end || u32(end+12) !== end-index) reject("INVALID_PROOF_XLSX");
  let cursor = index, expanded = 0;
  const entries = new Map();
  for (let i=0; i<count; i++) {
    if (cursor+46 > end || u32(cursor) !== 0x02014b50) reject("INVALID_PROOF_XLSX");
    const flags = u16(cursor+8), method = u16(cursor+10), check = u32(cursor+16);
    const packed = u32(cursor+20), size = u32(cursor+24), nameLength = u16(cursor+28);
    const headerEnd = cursor+46+nameLength;
    const externalMode = u32(cursor+38) >>> 16;
    const start = u32(cursor+42);
    if ((flags & ~0x806) || ![0,8].includes(method) || headerEnd > end || u16(cursor+30) || u16(cursor+32) || u16(cursor+34)
        || (externalMode & 0o170000) === 0o120000 || !packed || !size || start+30 > index) reject("INVALID_PROOF_XLSX");
    const name = decode(bytes.subarray(cursor+46,cursor+46+nameLength));
    if (!allowedPart(name) || entries.has(name)) reject("UNSUPPORTED_PROOF_XLSX_PART");
    expanded += size;
    if (size > 2097152 || expanded > 6291456) limit();
    if (u32(start)!==0x04034b50 || u16(start+6)!==flags || u16(start+8)!==method
        || u32(start+14)!==check || u32(start+18)!==packed || u32(start+22)!==size
        || u16(start+26)!==nameLength || u16(start+28)) reject("INVALID_PROOF_XLSX");
    const dataStart = start+30+nameLength, dataEnd = dataStart+packed;
    if (dataEnd>index || decode(bytes.subarray(start+30,start+30+nameLength))!==name) reject("INVALID_PROOF_XLSX");
    entries.set(name,{start,dataStart,dataEnd,method,check,size});
    cursor=headerEnd;
  }
  if (cursor!==end || !mandatoryParts.every(name=>entries.has(name))) reject("INVALID_PROOF_XLSX");
  let next = 0;
  for (const item of [...entries.values()].sort((a,b)=>a.start-b.start)) {
    if (item.start!==next) reject("INVALID_PROOF_XLSX");
    next=item.dataEnd;
  }
  if (next!==index) reject("INVALID_PROOF_XLSX");
  for (const item of entries.values()) {
    const input = bytes.subarray(item.dataStart,item.dataEnd);
    item.bytes = item.method === 8 ? unpack(input, item.size, Inflate) : input;
    if (item.bytes.length !== item.size || crc32(item.bytes) !== item.check) reject("INVALID_PROOF_XLSX");
  }
  return entries;
}

const blockedNodes = new Set(["f","formula","formula1","formula2","definedName","externalReference","externalReferences",
  "hyperlink","hyperlinks","oleObject","oleObjects","controls","customSheetView","dataValidation","dataValidations",
  "conditionalFormatting","extLst","drawing","legacyDrawing","queryTable","pivotTable","webPublishItem"]);

export function validateXlsx(bytes, sax, Inflate) {
  boundedInput(bytes);
  const entries = readParts(bytes, Inflate);
  const sheets = new Set(), workbookLinks = new Map(), declarations = new Map(), defaults = new Map();
  let cells = 0, nodes = 0, rootLinks = 0;
  for (const [name,item] of entries) {
    const [root,uri] = basicParts.get(name) ?? ["worksheet",core];
    const ancestors = [], relationIds = new Set();
    let depth=0, rootSeen=false, xmlDeclaration=false;
    const parser = sax.parser(true,{xmlns:true,strictEntities:true});
    parser.onerror = () => reject("INVALID_PROOF_XLSX_XML");
    parser.ondoctype = () => reject("INVALID_PROOF_XLSX_XML");
    parser.onsgmldeclaration = () => reject("INVALID_PROOF_XLSX_XML");
    parser.onprocessinginstruction = pi => {
      if (pi.name !== "xml" || rootSeen || xmlDeclaration) reject("INVALID_PROOF_XLSX_XML");
      xmlDeclaration = true;
    };
    parser.ontext = text => {
      if ((!depth || uri === ct || root === "Relationships") && text.trim()) reject("INVALID_PROOF_XLSX_XML");
    };
    parser.oncdata = () => reject("INVALID_PROOF_XLSX_XML");
    parser.onclosetag = () => { depth--; ancestors.pop(); };
    parser.onopentag = tag => {
      if (++nodes>150000 || ++depth>40) limit();
      if (depth===1) {
        if (rootSeen || tag.local!==root || tag.uri!==uri) reject("INVALID_PROOF_XLSX_XML");
        rootSeen=true;
      }
      const parent = ancestors.at(-1);
      ancestors.push(tag);
      if ((uri === ct || root === "Relationships") && depth > 2) reject("INVALID_PROOF_XLSX_XML");
      if (blockedNodes.has(tag.local)) reject("PROOF_XLSX_ACTIVE_CONTENT_UNSUPPORTED");
      if (sheetPath.test(name) && tag.uri===core && tag.local==="c" && ++cells>MAX_CELLS) limit();
      const attr = key => tag.attributes[key]?.value;
      if (uri===ct && depth===2) {
        if (tag.local==="Default" && tag.uri===ct) {
          const ext=attr("Extension"), type=attr("ContentType");
          if (defaults.has(ext) || (ext==="rels" ? type!=="application/vnd.openxmlformats-package.relationships+xml"
            : ext!=="xml" || type!=="application/xml")) reject("INVALID_PROOF_XLSX_XML");
          defaults.set(ext,type);
        } else if (tag.local==="Override" && tag.uri===ct) {
          const part=attr("PartName")?.slice(1), type=attr("ContentType");
          if (!part || !attr("PartName").startsWith("/") || !entries.has(part) || declarations.has(part)
              || type!==(sheetPath.test(part) ? worksheetType : expectedTypes.get(part))) reject("INVALID_PROOF_XLSX_XML");
          declarations.set(part,type);
        } else reject("INVALID_PROOF_XLSX_XML");
      }
      if (root==="Relationships" && depth===2) {
        const id=attr("Id"), target=attr("Target"), type=attr("Type") || "";
        if (tag.local!=="Relationship" || tag.uri!==rel || !/^rId\d{1,4}$/.test(id || "")
            || relationIds.has(id) || (attr("TargetMode") && attr("TargetMode")!=="Internal") || !target) reject("PROOF_XLSX_ACTIVE_CONTENT_UNSUPPORTED");
        relationIds.add(id);
        const absolute=target.startsWith("/") ? target.slice(1) : name.startsWith("xl/") ? "xl/"+target : target;
        if (!entries.has(absolute)) reject("INVALID_PROOF_XLSX_XML");
        if (name==="_rels/.rels") {
          if (type===docRel+"/officeDocument" && absolute==="xl/workbook.xml") rootLinks++;
          else if (!(type===rel+"/metadata/core-properties" && absolute==="docProps/core.xml")
              && !(type===docRel+"/extended-properties" && absolute==="docProps/app.xml")) reject("UNSUPPORTED_PROOF_XLSX_PART");
        } else {
          const supported = [[docRel+"/styles","xl/styles.xml"],[docRel+"/sharedStrings","xl/sharedStrings.xml"],[docRel+"/theme","xl/theme/theme1.xml"]];
          if (!(type===docRel+"/worksheet" && sheetPath.test(absolute))
              && !supported.some(([t,p])=>t===type && p===absolute)) reject("UNSUPPORTED_PROOF_XLSX_PART");
          workbookLinks.set(id,absolute);
        }
      }
      if (name==="xl/workbook.xml" && tag.local==="sheet" && tag.uri===core) {
        const rid=Object.values(tag.attributes).find(a=>a.local==="id" && a.uri===docRel)?.value;
        if (depth !== 3 || parent?.local !== "sheets" || parent?.uri !== core || !rid || sheets.has(rid)) reject("INVALID_PROOF_XLSX_XML");
        sheets.add(rid);
      }
    };
    const xml = decode(item.bytes);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)) reject("INVALID_PROOF_XLSX_XML");
    parser.write(xml).close();
    if (!rootSeen || depth!==0) reject("INVALID_PROOF_XLSX_XML");
  }
  if (rootLinks!==1 || !sheets.size || sheets.size>16 || !defaults.has("rels")) reject("INVALID_PROOF_XLSX_XML");
  const referenced=new Set();
  for (const rid of sheets) {
    const target=workbookLinks.get(rid);
    if (!target || !sheetPath.test(target) || referenced.has(target)) reject("INVALID_PROOF_XLSX_XML");
    referenced.add(target);
  }
  for (const name of entries.keys()) {
    if (sheetPath.test(name) && !referenced.has(name)) reject("INVALID_PROOF_XLSX_XML");
    if ((sheetPath.test(name) || expectedTypes.has(name)) && !declarations.has(name)) reject("INVALID_PROOF_XLSX_XML");
  }
  return bytes;
}
