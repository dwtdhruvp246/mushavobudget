import { crc32, deflateRawSync } from "node:zlib";

const core = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";
const docRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const types = "http://schemas.openxmlformats.org/package/2006/content-types";
const sheetType = "application/vnd.openxmlformats-officedocument.spreadsheetml";

export const csvFixture = Buffer.from('Name,Amount\n"Coffee, ""beans""",-2.5\nTea,0\n');
export const csvCanonical = Buffer.from('"Name","Amount"\r\n"Coffee, ""beans""","-2.5"\r\n"Tea","0"\r\n');
export const formatExamples = {
  formula: '<c r="A1"><f>1+1</f><v>2</v></c>',
  externalRelationship: '<Relationship Id="rId2" TargetMode="External" Target="https://example.invalid/" Type="other"/>',
};

export function xlsxFixture({ cell = '<c r="A1" t="inlineStr"><is><t>Coffee</t></is></c>', relationship = "", extra = {},
  declarations = "", worksheetTail = "" } = {}) {
  const parts = {
    "[Content_Types].xml": `<Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${sheetType}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${sheetType}.worksheet+xml"/>${declarations}</Types>`,
    "_rels/.rels": `<Relationships xmlns="${rel}"><Relationship Id="rId1" Target="xl/workbook.xml" Type="${docRel}/officeDocument"/></Relationships>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="${rel}"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="${docRel}/worksheet"/>${relationship}</Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${core}" xmlns:r="${docRel}"><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${core}"><sheetData><row r="1">${cell}</row></sheetData></worksheet>${worksheetTail}`,
    ...extra,
  };
  const entries = [], central = [];
  let offset = 0;
  for (const [path, value] of Object.entries(parts)) {
    const name = Buffer.from(path), bytes = Buffer.from(value);
    const data = deflateRawSync(bytes), checksum = crc32(bytes);
    const local = Buffer.alloc(30), index = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); index.writeUInt32LE(0x02014b50);
    local.writeUInt16LE(20, 4); index.writeUInt16LE(20, 6);
    local.writeUInt16LE(8, 8); index.writeUInt16LE(8, 10);
    local.writeUInt32LE(checksum, 14); index.writeUInt32LE(checksum, 16);
    local.writeUInt32LE(data.length, 18); index.writeUInt32LE(data.length, 20);
    local.writeUInt32LE(bytes.length, 22); index.writeUInt32LE(bytes.length, 24);
    local.writeUInt16LE(name.length, 26); index.writeUInt16LE(name.length, 28);
    index.writeUInt32LE(offset, 42);
    entries.push(local, name, data); central.push(index, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, directory, end]);
}
