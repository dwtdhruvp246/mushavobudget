import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { createPrivateFileHandler } from "./handler.mjs";
import { readSignedPrivateObject } from "./signed-private-file.mjs";

const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(createPrivateFileHandler({
  // This rollout is staging only. No production project is a permitted target.
  configured: () => projectUrl === "https://dczlddwbtgvfdujgcitb.supabase.co" && Boolean(anonKey && serviceKey),
  allowedOrigin: (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin),
  createUserClient: (token: string) => createClient(projectUrl, anonKey, {
    ...options, global: { headers: { Authorization: `Bearer ${token}` } },
  }),
  readPrivateObject: (bucket: string, path: string, maxBytes: number) => readSignedPrivateObject({
    bucket, path, maxBytes,
    mint: (name: string, objectPath: string, seconds: number) => createClient(projectUrl, serviceKey, options)
      .storage.from(name).createSignedUrl(objectPath, seconds),
  }),
}));
