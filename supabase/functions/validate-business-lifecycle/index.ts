import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodeWebp } from "npm:@stacksjs/ts-webp@0.1.7";
import * as pdf from "npm:pdf-lib@1.17.1";
import { normalizeStaticPdf } from "../validate-payment-proof/pdf.mjs";
import { createProofHandler } from "../validate-payment-proof/handler.mjs";
import { BUCKET, DOCUMENTS, OWNER, WORKSPACE, bindLifecycleTrial, prefix } from "./scope.mjs";
import { bindBusinessDocument } from "../validate-business-document/scope.mjs";
import { verifiedCleanupAttempt } from "./scheduled-auth.mjs";
import { readSignedPrivateObject } from "../get-private-file/signed-private-file.mjs";
import { reconcileBusinessUploads, reconcileReplacedLogos, reconcileUnlinkedSubscriptions, reconcileOrdinaryUploads } from "../_shared/business-upload-cleanup.mjs";

const url = Deno.env.get("SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const schedulerKey: JsonWebKey = {"kty":"EC","x":"Zt1i3wh5Xkq-G9upQFy04bF_7qMN2AwKmPSJbptHT24","y":"yCwOmXUEVOHjgWJ4dLpwVK_bz3vx_Fc8oSycQ2quH5U","crv":"P-256"};
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const configured = () => url === "https://dczlddwbtgvfdujgcitb.supabase.co" && Boolean(anon && secret);
const allowedOrigin = (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin);
const privileged = () => createClient(url, secret, options);
const bucket = () => privileged().storage.from(BUCKET);
const createUserClient = (token: string) => createClient(url, anon, {
  ...options, global: { headers: { Authorization: `Bearer ${token}` } },
});
const gateReady = async () => {
  const r = await privileged().rpc("fr3_lifecycle_trial_ready");
  return !r.error && r.data === true;
};
const contextualDocument = (path: string) => Object.values(DOCUMENTS).find(id => path.startsWith(prefix(id)));
const upload = createProofHandler({
  configured, allowedOrigin, createUserClient, gateReady,
  bind: bindLifecycleTrial, attachmentHeader: true,
  denied: "BUSINESS_LIFECYCLE_FIXTURE_OWNER_REQUIRED",
  decodeJpeg: jpeg.decode, decodeWebp,
  normalizePdf: (bytes: Uint8Array) => normalizeStaticPdf(bytes, pdf, jpeg.decode),
  lifecycle: {
    reserve: async ({path,type,size}) => {
      const document = contextualDocument(path);
      if (!document || type !== "application/pdf") return false;
      const r = await privileged().rpc("fr3_reserve_lifecycle_trial", {
        p_document:document,p_object:path,p_size:size,
      });
      if (r.error) throw new Error("Reservation status unavailable");
      return r.data === true;
    },
    verify: async ({path}) => {
      const r = await privileged().rpc("fr3_verify_lifecycle_trial", {p_object:path});
      return !r.error && r.data === true;
    },
  },
  store: async (path: string, bytes: Uint8Array, contentType: string) => {
    const r = await bucket().upload(path, bytes, { contentType, cacheControl: "0", upsert: false });
    if (r.error) throw new Error("Storage write unconfirmed");
  },
  read: async (path: string, maxBytes: number) => (await readSignedPrivateObject({
    bucket: BUCKET, path, maxBytes,
    mint: (_bucket: string, name: string, seconds: number) => bucket().createSignedUrl(name, seconds),
  })).data,
});

async function runCleanup() {
  return await reconcileBusinessUploads(WORKSPACE, {
    claim: async (_workspace: string, limit: number) => {
      const r = await privileged().rpc("fr3_claim_lifecycle_trial", {p_limit:limit});
      if (r.error) throw new Error("Cleanup claim unconfirmed");
      return r.data;
    },
    remove: async (_bucket: string, path: string) => {
      if (!contextualDocument(path) || !await gateReady()) throw new Error("Cleanup scope closed");
      return await bucket().remove([path]);
    },
    finish: async (path: string, cleanupToken: string) => {
      const r = await privileged().rpc("fr3_finish_lifecycle_trial", {p_object:path,p_token:cleanupToken});
      return !r.error && r.data === true;
    },
  });
}

async function runLogoCleanup(nonce: string, epoch: number) {
  const client = privileged();
  return reconcileReplacedLogos({
    claim: async (limit: number) => {
      const r = await client.rpc("fr32_claim_logo_replacements", {p_nonce:nonce,p_epoch:epoch,p_limit:limit});
      if (r.error || !Array.isArray(r.data)) throw new Error("Logo cleanup claim unconfirmed");
      return r.data;
    },
    remove: async (name: string, path: string) => client.storage.from(name).remove([path]),
    finish: async (path: string, token: string) => {
      const r = await client.rpc("fr32_finish_logo_replacement", {p_object:path,p_token:token});
      return !r.error && r.data === true;
    },
  });
}

async function runSubscriptionCleanup(nonce: string, epoch: number) {
  const client = privileged();
  return reconcileUnlinkedSubscriptions({
    claim: async (limit: number) => {
      const r = await client.rpc("claim_managed_subscription_cleanup", {p_nonce:nonce,p_epoch:epoch,p_limit:limit});
      if (r.error || !Array.isArray(r.data)) throw new Error("Subscription cleanup claim unconfirmed");
      return r.data;
    },
    remove: async (name: string, path: string) => client.storage.from(name).remove([path]),
    finish: async (path: string, token: string) => {
      const r = await client.rpc("finish_managed_subscription_cleanup", {p_path:path,p_token:token});
      return !r.error && r.data === true;
    },
  });
}

async function runOrdinaryCleanup(nonce: string, epoch: number) {
  const client = privileged();
  return reconcileOrdinaryUploads({
    claim: async (limit: number) => {
      const r = await client.rpc("fr32_claim_ordinary_cleanup", {p_nonce:nonce,p_epoch:epoch,p_limit:limit});
      if (r.error || !Array.isArray(r.data)) throw new Error("Ordinary upload cleanup claim unconfirmed");
      return r.data;
    },
    remove: async (name: string,path: string) => client.storage.from(name).remove([path]),
    finish: async (name: string,path: string,token: string) => {
      const r = await client.rpc("fr32_finish_ordinary_cleanup",{p_bucket:name,p_path:path,p_token:token});
      return !r.error && r.data === true;
    },
  });
}

Deno.serve(async request => {
  const mode = request.headers.get("x-mushavo-attachment");
  if (request.method !== "POST" || !["scheduled-reconcile","status"].includes(mode || "")) {
    if (request.method === "POST" && request.headers.get("content-type")?.toLowerCase() !== "application/pdf") {
      return Response.json({error:"UNSUPPORTED_PROOF_TYPE"},{status:415});
    }
    return upload(request);
  }

  const origin = request.headers.get("origin") || "";
  const headers = { "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff",
    ...(mode === "status" && allowedOrigin(origin) ? {"Access-Control-Allow-Origin":origin,Vary:"Origin"} : {}) };
  const fail = (status: number) => Response.json({error:"BUSINESS_LIFECYCLE_RECONCILIATION_UNAVAILABLE"},{status,headers});
  if (!configured()) return fail(503);
  try {
    if (mode === "status") {
      const token = /^Bearer ([A-Za-z0-9._-]{20,8192})$/i.exec(request.headers.get("authorization") || "")?.[1];
      if (!allowedOrigin(origin) || !token) return fail(403);
      const client = createUserClient(token);
      const identity = await client.auth.getUser();
      const scope = bindBusinessDocument(client, identity.data.user?.id);
      if (identity.error || !scope || identity.data.user?.id !== OWNER || !await scope.canWrite()) return fail(403);
      const ready = await privileged().rpc("fr3_scheduled_cleanup_witness");
      if (ready.error || typeof ready.data !== "boolean") return fail(503);
      return Response.json({removed:ready.data},{headers});
    }

    const signed = await verifiedCleanupAttempt(request.headers,schedulerKey);
    if (!signed) return fail(403);
    const client = privileged();
    const [documentMode, logoMode, subscriptionMode, ordinaryMode] = await Promise.all([
      gateReady(), client.rpc("fr32_logo_replacement_mode"), client.rpc("managed_subscription_cleanup_due"),
      client.rpc("fr32_ordinary_cleanup_due"),
    ]);
    if (logoMode.error || subscriptionMode.error || ordinaryMode.error || typeof logoMode.data !== "boolean"
      || typeof subscriptionMode.data !== "boolean" || typeof ordinaryMode.data !== "boolean") return fail(503);
    if (!documentMode && !logoMode.data && !subscriptionMode.data && !ordinaryMode.data) {
      return new Response(null,{status:204,headers});
    }
    const extra: Record<string, unknown> = {};
    if (logoMode.data) extra.logos = await runLogoCleanup(signed.nonce, signed.seconds);
    if (subscriptionMode.data) extra.subscriptionProofs = await runSubscriptionCleanup(signed.nonce, signed.seconds);
    if (ordinaryMode.data) extra.ordinaryUploads = await runOrdinaryCleanup(signed.nonce, signed.seconds);
    if (!documentMode) return Response.json(extra,{headers});
    const auth = await privileged().rpc("fr3_consume_cleanup_dispatch", {p_nonce:signed.nonce,p_epoch:signed.seconds});
    if (auth.error || auth.data !== true) return fail(403);
    const result = await runCleanup();
    const receipt = await privileged().rpc("fr3_finish_cleanup_dispatch", {
      p_nonce:signed.nonce,p_claimed:result.claimed,p_removed:result.removed,p_retry:result.retry,
    });
    if (receipt.error || receipt.data !== true) return fail(503);
    return Response.json({...result, ...extra},{headers});
  } catch { return fail(503); }
});
