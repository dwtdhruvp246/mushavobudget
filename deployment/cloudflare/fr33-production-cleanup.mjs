const PURPOSE = "mushavo-production:fr33-storage:v1";
const ENDPOINT = "https://kttkospkblwvguuwnhjj.supabase.co/functions/v1/fr33-file-cleanup";

export default {
  async fetch() {
    return new Response(null, { status: 404, headers: {"cache-control":"no-store"} });
  },
  async scheduled(_event, env) {
    const key = await crypto.subtle.importKey("jwk", JSON.parse(env.FR33_SIGNING_KEY),
      {name:"ECDSA", namedCurve:"P-256"}, false, ["sign"]);
    const time = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomUUID();
    const signature = await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"}, key,
      new TextEncoder().encode([PURPOSE,time,nonce].join("\n")));
    const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2,"0")).join("");
    const response = await fetch(ENDPOINT, {
      // Workers uses manual redirect handling. The status check prevents a
      // signed dispatch from following a redirect to another host.
      method:"POST", redirect:"manual", signal:AbortSignal.timeout(20000),
      headers: {
        "x-mushavo-cleanup-time":time,
        "x-mushavo-cleanup-nonce":nonce,
        "x-mushavo-cleanup-signature":hex,
      },
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error("FR33 Storage dispatch failed");
  }
};
