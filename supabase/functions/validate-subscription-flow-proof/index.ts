import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodeWebp } from "npm:@stacksjs/ts-webp@0.1.7";
import * as pdf from "npm:pdf-lib@1.17.1";
import { normalizeStaticPdf } from "../validate-payment-proof/pdf.mjs";
import { createProofHandler, OWNER } from "../validate-payment-proof/handler.mjs";
import { readSignedPrivateObject } from "../get-private-file/signed-private-file.mjs";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const bucketName = "subscription-proofs";
const privileged = () => createClient(url, secret, options);
const bucket = () => privileged().storage.from(bucketName);
const scopePattern = /^(personal|family-plan|family-renewal|family-extra|business):([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/;

type Proof = { path: string; type: string; size: number };
async function record(file: Proof, verify: boolean) {
  const r = await privileged().rpc("fr32_subscription_flow_file", {
    p_path: file.path, p_type: file.type, p_size: file.size, p_verify: verify,
  });
  return !r.error && r.data === true;
}

Deno.serve(request => {
  const [, lane, workspace] = scopePattern.exec(request.headers.get("x-mushavo-attachment") || "") ?? [];
  return createProofHandler({
    configured: () => url === "https://dczlddwbtgvfdujgcitb.supabase.co" && Boolean(anon && secret),
    allowedOrigin: (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin),
    createUserClient: (token: string) => createClient(url, anon, {
      ...options, global: { headers: { Authorization: "Bearer " + token } },
    }),
    gateReady: async () => {
      const r = await privileged().rpc("fr32_subscription_flow_ready", { p_lane: lane });
      return !r.error && r.data === workspace;
    },
    bind: (client, userId) => {
      if (userId !== OWNER || !lane || !workspace) return null;
      return {
        prefix: "workspaces/" + workspace + "/" + OWNER + "/fr32-billing-" + lane + "/",
        async canWrite() {
          const [session, row, suspension] = await Promise.all([
            client.rpc("app_session_status"),
            client.from("budget_workspaces").select("owner_id,status").eq("id", workspace).maybeSingle(),
            client.rpc("my_account_suspended"),
          ]);
          return !session.error && session.data?.session_valid === true
            && !row.error && row.data?.owner_id === OWNER && row.data.status === "active"
            && !suspension.error && suspension.data === false;
        },
      };
    },
    denied: "SUBSCRIPTION_FLOW_OWNER_REQUIRED",
    attachmentHeader: true,
    lifecycle: { reserve: file => record(file, false), verify: file => record(file, true) },
    decodeJpeg: jpeg.decode,
    decodeWebp,
    normalizePdf: (bytes: Uint8Array) => normalizeStaticPdf(bytes, pdf, jpeg.decode),
    store: async (path: string, bytes: Uint8Array, contentType: string) => {
      const r = await bucket().upload(path, bytes, { contentType, cacheControl: "0", upsert: false });
      if (r.error) throw new Error("Proof write unconfirmed");
    },
    read: async (path: string, maxBytes: number) => (await readSignedPrivateObject({
      bucket: bucketName, path, maxBytes,
      mint: (_bucket: string, name: string, seconds: number) => bucket().createSignedUrl(name, seconds),
    })).data,
  })(request);
});
