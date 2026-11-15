import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodeWebp } from "npm:@stacksjs/ts-webp@0.1.7";
import * as pdf from "npm:pdf-lib@1.17.1";
import { createProofHandler, ORDINARY_PROOF_MAX_BYTES, ORDINARY_PROOF_IMAGE_LIMITS } from "../validate-payment-proof/handler.mjs";
import { normalizeStaticPdf } from "../validate-payment-proof/pdf.mjs";
import { readSignedPrivateObject } from "../get-private-file/signed-private-file.mjs";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const settings = { auth: { persistSession: false, autoRefreshToken: false } };
const bucketName = "subscription-proofs";
const privileged = () => createClient(url, service, settings);
const bucket = () => privileged().storage.from(bucketName);
const uuid = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
const requestScope = new RegExp("^(?<workspace>" + uuid + "):(?<upload>" + uuid + ")$");
const userScope = new RegExp("^" + uuid + "$");

type FileReceipt = {path: string; type: string; size: number};
async function updateReceipt(file: FileReceipt, verify: boolean) {
  const r = await privileged().rpc("record_managed_subscription_upload", {
    p_path:file.path, p_mime:file.type, p_size:file.size, p_verify:verify,
  });
  if (r.error || typeof r.data !== "boolean") throw new Error("Upload manifest unavailable");
  return r.data;
}

Deno.serve(request => {
  const scope = requestScope.exec(request.headers.get("x-mushavo-attachment") || "")?.groups;
  return createProofHandler({
    configured: () => url === "https://dczlddwbtgvfdujgcitb.supabase.co" && Boolean(anon && service),
    allowedOrigin: (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin),
    createUserClient: (token: string) => createClient(url, anon, {
      ...settings, global: { headers: { Authorization: "Bearer " + token } },
    }),
    // The database reservation is authoritative and must exist before upload.
    gateReady: async () => true,
    attachmentHeader: true,
    pdfInputLimit: ORDINARY_PROOF_MAX_BYTES,
    imageLimits: ORDINARY_PROOF_IMAGE_LIMITS,
    bind: (client, userId, inputType) => {
      if (!scope || !userScope.test(userId)) return null;
      const prefix = "workspaces/" + scope.workspace + "/" + userId + "/managed-proof-v1/" + scope.upload + "/";
      return {
        prefix,
        async canWrite() {
          const [session, profile, workspace] = await Promise.all([
            client.rpc("app_session_status"),
            client.rpc("my_account_suspended"),
            client.from("budget_workspaces").select("id,owner_id,workspace_type,status").eq("id", scope.workspace).maybeSingle(),
          ]);
          const row = workspace.data;
          if (session.error || session.data?.session_valid !== true || profile.error || profile.data !== false
            || workspace.error || row?.id !== scope.workspace || row.owner_id !== userId || row.status !== "active"
            || !["personal", "household", "business"].includes(row.workspace_type)) return false;
          if (row.workspace_type !== "business") return true;

          const suffix = inputType === "application/pdf" ? ".pdf" : ".png";
          const permission = await client.rpc("business_subscription_proof_access", {
            p_path: prefix + "00000000-0000-4000-8000-000000000000" + suffix, p_write: true,
          });
          return !permission.error && permission.data === true;
        },
      };
    },
    denied: "CURRENT_SUBSCRIPTION_WORKSPACE_OWNER_REQUIRED",
    lifecycle: {reserve: file => updateReceipt(file, false), verify: file => updateReceipt(file, true)},
    decodeJpeg: jpeg.decode,
    decodeWebp,
    normalizePdf: (bytes: Uint8Array) => normalizeStaticPdf(bytes, pdf, jpeg.decode, {maxBytes:ORDINARY_PROOF_MAX_BYTES}),
    store: async (path: string, bytes: Uint8Array, type: string) => {
      const result = await bucket().upload(path, bytes, {contentType:type, cacheControl:"0", upsert:false});
      if (result.error) throw new Error("Storage upload unconfirmed");
    },
    read: async (path: string, maxBytes: number) => (await readSignedPrivateObject({
      bucket:bucketName, path, maxBytes,
      mint: (_bucket: string, name: string, seconds: number) => bucket().createSignedUrl(name, seconds),
    })).data,
  })(request);
});
