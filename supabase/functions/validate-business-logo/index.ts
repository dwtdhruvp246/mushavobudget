import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { createLogoUploadHandler, LOGO_BUCKET } from "./handler.mjs";
import { readSignedPrivateObject } from "../get-private-file/signed-private-file.mjs";

const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const privilegedClient = () => createClient(projectUrl, serviceKey, options);
const logoStorage = () => privilegedClient().storage.from(LOGO_BUCKET);

Deno.serve(createLogoUploadHandler({
  configured: () => projectUrl === "https://dczlddwbtgvfdujgcitb.supabase.co"
    && Boolean(anonKey && serviceKey),
  allowedOrigin: (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin),
  createUserClient: (token: string) => createClient(projectUrl, anonKey, {
    ...options, global: { headers: { Authorization: `Bearer ${token}` } },
  }),
  gateReady: async () => {
    const { data, error } = await privilegedClient().rpc("fr3_logo_fixture_gate_ready");
    return !error && data === true;
  },
  storeLogo: async (path: string, png: Uint8Array) => {
    const result = await logoStorage().upload(path, png, { contentType: "image/png", upsert: false, cacheControl: "0" });
    if (result.error) throw new Error("Logo write unconfirmed");
  },
  readLogo: async (path: string, maxBytes: number) => {
    const result = await readSignedPrivateObject({
      bucket: LOGO_BUCKET, path, maxBytes,
      mint: (_bucket: string, name: string, seconds: number) => logoStorage().createSignedUrl(name, seconds),
    });
    return result.data;
  },
}));
