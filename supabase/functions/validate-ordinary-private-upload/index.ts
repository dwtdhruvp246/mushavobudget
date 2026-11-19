import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodeWebp } from "npm:@stacksjs/ts-webp@0.1.7";
import * as pdf from "npm:pdf-lib@1.17.1";
import pako from "npm:pako@2.1.0";
import sax from "npm:sax@1.6.1";
import { createProofHandler, ORDINARY_PROOF_MAX_BYTES, ORDINARY_PROOF_IMAGE_LIMITS } from "../validate-payment-proof/handler.mjs";
import { normalizeStaticPdf } from "../validate-payment-proof/pdf.mjs";
import { LOGO_IMAGE_LIMITS } from "../validate-business-logo/png.mjs";
import { CSV_MIME, XLSX_MIME, normalizeCsv, validateXlsx } from "../validate-business-table/table-files.mjs";
import { readSignedPrivateObject } from "../get-private-file/signed-private-file.mjs";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const settings = { auth: { persistSession: false, autoRefreshToken: false } };
const configured = () => url === "https://dczlddwbtgvfdujgcitb.supabase.co" && Boolean(anon && service);
const allowedOrigin = (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const types = new Set(["payment-proofs", "business-documents", "business-logos"]);
const parents = new Set(["workspace","profile","expense_claim","business_bill","business_bill_payment","dimension","category"]);
const tableFormats = new Map([
  [CSV_MIME, { suffix: ".csv", normalize: normalizeCsv }],
  [XLSX_MIME, { suffix: ".xlsx", normalize: (bytes: Uint8Array) => validateXlsx(bytes, sax, pako.Inflate) }],
]);

Deno.serve(request => {
  const fields = (request.headers.get("x-mushavo-attachment") || "").split(":");
  const [bucketId, workspace, attachment, parentType, parent] = fields;
  const document = bucketId === "business-documents";
  const logo = bucketId === "business-logos";
  const valid = types.has(bucketId) && uuid.test(workspace) && uuid.test(attachment)
    && (document ? fields.length === 5 && parents.has(parentType) && uuid.test(parent) : fields.length === 3)
    && (!logo || attachment.startsWith("f3320000-"));
  const storage = () => createClient(url, service, settings).storage.from(bucketId);
  const scope = {p_bucket:bucketId, p_workspace:workspace, p_attachment:attachment,
    p_parent_type:document ? parentType : null, p_parent:document ? parent : null};
  let actor: string;
  async function record(file: {path:string; type:string; size:number}, verify: boolean) {
    const r = await createClient(url,service,settings).rpc("fr32_record_ordinary_upload", {
      ...scope,p_actor:actor,p_path:file.path,p_mime:file.type,p_size:file.size,p_verify:verify,
    });
    if (r.error || typeof r.data !== "boolean") throw new Error("Upload registry unavailable");
    return r.data;
  }

  return createProofHandler({
    configured, allowedOrigin, gateReady: async () => true, attachmentHeader:true,
    createUserClient: (token: string) => createClient(url,anon,{
      ...settings,global:{headers:{Authorization:"Bearer " + token}},
    }),
    async bind(client, userId) {
      if (!valid || !uuid.test(userId)) return null;
      actor = userId;
      const getPrefix = async () => {
        const r = await client.rpc("fr32_ordinary_upload_scope", scope);
        return !r.error && typeof r.data === "string" && r.data !== "" ? r.data : null;
      };
      const prefix = await getPrefix();
      if (!prefix) return null;
      return {prefix, canWrite:async () => await getPrefix() === prefix,
        ...(logo ? {objectName: () => attachment} : {})};
    },
    denied:"CURRENT_UPLOAD_PERMISSION_REQUIRED",
    imageLimits:logo ? LOGO_IMAGE_LIMITS : ORDINARY_PROOF_IMAGE_LIMITS,
    pdfInputLimit:ORDINARY_PROOF_MAX_BYTES,
    normalizePdf:logo ? null : (bytes:Uint8Array) =>
      normalizeStaticPdf(bytes,pdf,jpeg.decode,{maxBytes:ORDINARY_PROOF_MAX_BYTES}),
    ...(document ? {extraFormats:tableFormats} : {}),
    decodeJpeg:jpeg.decode, decodeWebp,
    lifecycle:{reserve:file=>record(file,false),verify:file=>record(file,true)},
    store:async (path:string,bytes:Uint8Array,contentType:string) => {
      const r = await storage().upload(path,bytes,{contentType,cacheControl:"0",upsert:false});
      if (r.error) throw new Error("Storage upload unavailable");
    },
    read:async (path:string,maxBytes:number) => (await readSignedPrivateObject({
      bucket:bucketId,path,maxBytes,
      mint:(_bucket:string,name:string,seconds:number)=>storage().createSignedUrl(name,seconds),
    })).data,
  })(request);
});
