import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createPrivateFileHandler } from "./handler.mjs";
import { readS3PrivateObject } from "./s3-private-file.mjs";

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
  readPrivateObject: (bucket: string, path: string, maxBytes: number) => readS3PrivateObject({
    bucket, path, maxBytes,
    // Supabase documents temporary S3 credentials as project ref + legacy anon
    // key + valid JWT. Only this server uses the service JWT, after user RLS.
    sign: (request: Request) => new AwsClient({
      accessKeyId: 'dczlddwbtgvfdujgcitb', secretAccessKey: anonKey,
      sessionToken: serviceKey, service: 's3', region: 'eu-west-1', retries: 0,
    }).sign(request, { redirect: 'error', cache: 'no-store', signal: request.signal }),
  }),
}));
