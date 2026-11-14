import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import sax from "npm:sax@1.6.1";
import { createProofHandler } from "../validate-payment-proof/handler.mjs";
import { CSV_MIME, XLSX_MIME, normalizeCsv, validateXlsx } from "./table-files.mjs";
import { BUCKET, bindBusinessTable } from "./scope.mjs";
import { readSignedPrivateObject } from "../get-private-file/signed-private-file.mjs";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const privileged = () => createClient(url, secret, options);
const bucket = () => privileged().storage.from(BUCKET);

Deno.serve(createProofHandler({
  configured: () => url === "https://dczlddwbtgvfdujgcitb.supabase.co" && Boolean(anon && secret),
  allowedOrigin: (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin),
  createUserClient: (token: string) => createClient(url, anon, {
    ...options, global: { headers: { Authorization: `Bearer ${token}` } },
  }),
  gateReady: async () => {
    const r = await privileged().rpc("fr3_business_table_gate_ready");
    return !r.error && r.data === true;
  },
  bind: bindBusinessTable,
  denied: "BUSINESS_TABLE_FIXTURE_OWNER_REQUIRED",
  standardFormats: false,
  decodeJpeg: null,
  decodeWebp: null,
  extraFormats: new Map([
    [CSV_MIME, { suffix: ".csv", normalize: normalizeCsv }],
    [XLSX_MIME, { suffix: ".xlsx", normalize: (bytes: Uint8Array) => validateXlsx(bytes, sax) }],
  ]),
  store: async (path: string, bytes: Uint8Array, contentType: string) => {
    const r = await bucket().upload(path, bytes, { contentType, cacheControl: "0", upsert: false });
    if (r.error) throw new Error("Proof write unconfirmed");
  },
  read: async (path: string, maxBytes: number) => (await readSignedPrivateObject({
    bucket: BUCKET, path, maxBytes,
    mint: (_bucket: string, name: string, seconds: number) => bucket().createSignedUrl(name, seconds),
  })).data,
}));
