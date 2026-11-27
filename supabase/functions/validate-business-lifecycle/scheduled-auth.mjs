const PURPOSE = "mushavo-staging:business-file-cleanup:v1";
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const encoder = new TextEncoder();

export async function verifiedCleanupAttempt(headers, publicKey, nowSeconds = Math.floor(Date.now() / 1000)) {
  const submitted = headers.get("x-mushavo-cleanup-time") || "";
  const nonce = headers.get("x-mushavo-cleanup-nonce") || "";
  const signature = headers.get("x-mushavo-cleanup-signature") || "";
  if (!/^\d{10}$/.test(submitted) || Math.abs(nowSeconds - Number(submitted)) > 120
      || !UUID.test(nonce) || !/^[a-f0-9]{128}$/.test(signature)) return null;
  const key = await crypto.subtle.importKey("jwk",publicKey,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const valid = await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,
    Uint8Array.from(signature.match(/../g),byte => Number.parseInt(byte,16)),
    encoder.encode([PURPOSE,submitted,nonce].join("\n")));
  return valid ? {nonce, seconds:Number(submitted)} : null;
}
