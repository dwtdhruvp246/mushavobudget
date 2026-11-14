import pdf from "./node_modules/pdf-lib/cjs/index.js";

export { pdf };

export async function receiptPdf({ pages = 1, objectStreams = false, jpeg } = {}) {
  const document = await pdf.PDFDocument.create({ updateMetadata: false });
  const font = await document.embedFont(pdf.StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = document.addPage([300, 200]);
    page.drawText("Synthetic payment receipt", { x: 20, y: 120, size: 12, font });
    if (jpeg) page.drawImage(await document.embedJpg(Uint8Array.from(jpeg)), { x: 20, y: 30, width: 24, height: 18 });
  }
  return document.save({ useObjectStreams: objectStreams, updateFieldAppearances: false });
}
