import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { createPrivateFileHandler } from "./handler.mjs";
import { privateFileDeployment, readSignedPrivateObject } from "./signed-private-file.mjs";

const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const deployment = privateFileDeployment(projectUrl, Deno.env.get("MUSHAVO_PRIVATE_FILE_PRODUCTION_ENABLED") === "true");
const budgetedFilePrefixes = [
  "workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/",
  "workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/",
];
const options = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(createPrivateFileHandler({
  configured: () => deployment !== null && Boolean(anonKey && serviceKey),
  allowedOrigin: (origin: string) => deployment?.allowsOrigin(origin) === true,
  createUserClient: (token: string) => createClient(projectUrl, anonKey, {
    ...options, global: { headers: { Authorization: `Bearer ${token}` } },
  }),
  authorizeDownload: async ({userId, bucket, path, size}) => {
    const client = createClient(projectUrl, serviceKey, options);
    if (deployment?.staging && bucket === "business-documents" && budgetedFilePrefixes.some(prefix => path.startsWith(prefix))) {
      const trial = await client.rpc("fr3_reserve_trial_download", {p_user:userId, p_path:path, p_size:size});
      if (trial.error || typeof trial.data !== "boolean") throw new Error("Download quota unavailable");
      if (!trial.data) return false;
    }
    const reply = await client.rpc("reserve_private_file_download", {
      p_user:userId, p_bucket:bucket, p_path:path, p_size:size,
    });
    if (reply.error || typeof reply.data !== "boolean") throw new Error("Download quota unavailable");
    return reply.data;
  },
  readPrivateObject: (bucket: string, path: string, maxBytes: number) => readSignedPrivateObject({
    bucket, path, maxBytes, projectUrl,
    mint: (name: string, objectPath: string, seconds: number) => createClient(projectUrl, serviceKey, options)
      .storage.from(name).createSignedUrl(objectPath, seconds),
  }),
}));
