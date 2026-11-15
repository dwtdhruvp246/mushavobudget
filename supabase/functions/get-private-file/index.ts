import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { createPrivateFileHandler } from "./handler.mjs";
import { readSignedPrivateObject } from "./signed-private-file.mjs";

const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const budgetedFilePrefixes = [
  "workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/",
  "workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/",
];
const options = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(createPrivateFileHandler({
  // This rollout is staging only. No production project is a permitted target.
  configured: () => projectUrl === "https://dczlddwbtgvfdujgcitb.supabase.co" && Boolean(anonKey && serviceKey),
  allowedOrigin: (origin: string) => /^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(origin),
  createUserClient: (token: string) => createClient(projectUrl, anonKey, {
    ...options, global: { headers: { Authorization: `Bearer ${token}` } },
  }),
  authorizeDownload: async ({userId, bucket, path, size}) => {
    if (bucket !== "business-documents"
        || !budgetedFilePrefixes.some(prefix => path.startsWith(prefix))) return true;
    const r = await createClient(projectUrl, serviceKey, options).rpc("fr3_reserve_trial_download", {
      p_user: userId, p_path: path, p_size: size,
    });
    if (r.error || typeof r.data !== "boolean") throw new Error("Download quota unavailable");
    return r.data;
  },
  readPrivateObject: (bucket: string, path: string, maxBytes: number) => readSignedPrivateObject({
    bucket, path, maxBytes,
    mint: (name: string, objectPath: string, seconds: number) => createClient(projectUrl, serviceKey, options)
      .storage.from(name).createSignedUrl(objectPath, seconds),
  }),
}));
