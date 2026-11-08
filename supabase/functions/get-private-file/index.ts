import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { createPrivateFileHandler } from "./handler.mjs";

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
  createServiceClient: () => createClient(projectUrl, serviceKey, {
    ...options, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      // A unique documented Storage cache nonce prevents a previous object
      // version from satisfying this privileged, post-authorization fetch.
      url.searchParams.set('cacheNonce', crypto.randomUUID());
      return fetch(url, { ...init, cache: 'no-store' });
    } },
  }),
}));
