import { BUCKET, OWNER, WORKSPACE, bindBusinessDocument } from "../validate-business-document/scope.mjs";
import { CSV_MIME, XLSX_MIME } from "./table-files.mjs";

export { BUCKET, OWNER, WORKSPACE };
export const CSV_DOCUMENT = "90545cd6-af7c-464f-8864-45fb905f7f92";
export const XLSX_DOCUMENT = "90d83c56-a450-4fb2-9d45-bf4dc652b357";
export const tableDocuments = new Map([[CSV_MIME, CSV_DOCUMENT], [XLSX_MIME, XLSX_DOCUMENT]]);
export const documentPrefix = document => `workspaces/${WORKSPACE}/${OWNER}/${document}/`;

export function bindBusinessTable(client, userId, mimeType) {
  const scope = bindBusinessDocument(client, userId);
  const document = tableDocuments.get(mimeType);
  return scope && document ? { ...scope, prefix: documentPrefix(document) } : null;
}
