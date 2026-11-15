const ENDPOINT = "https://dczlddwbtgvfdujgcitb.supabase.co/functions/v1/validate-business-lifecycle";
const PURPOSE = "mushavo-staging:business-file-cleanup:v1";
const encoder = new TextEncoder();

export async function dispatchCleanup(env, fetcher = fetch) {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(env.CLEANUP_SIGNING_KEY),
    {name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const signature = new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"}, key,
    encoder.encode([PURPOSE,timestamp,nonce].join("\n"))));
  const response = await fetcher(ENDPOINT,{
    method:"POST",redirect:"manual",signal:AbortSignal.timeout(25000),
    headers:{"Content-Type":"application/json","x-mushavo-attachment":"scheduled-reconcile",
      "x-mushavo-cleanup-time":timestamp,"x-mushavo-cleanup-nonce":nonce,
      "x-mushavo-cleanup-signature":Array.from(signature,byte => byte.toString(16).padStart(2,"0")).join("")},
    body:"{}",
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Staging cleanup returned HTTP ${response.status}`);
}

export default { scheduled: async (_controller, env) => { await dispatchCleanup(env); } };
