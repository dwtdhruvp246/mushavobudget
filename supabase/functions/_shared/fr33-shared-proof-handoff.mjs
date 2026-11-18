const uuid = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const identifier = new RegExp(`^${uuid}$`);
const familyExtensions = "pdf|png|jpe?g|webp";
const familySource = new RegExp(`^families/${uuid}/${uuid}/${uuid}/${uuid}[.](?:${familyExtensions})$`);
const businessSource = new RegExp(`^workspaces/${uuid}/${uuid}/${uuid}/${uuid}[.](?:pdf|png)$`);
const familyTargetSuffix = new RegExp(`^managed-upload-v1/${uuid}/${uuid}[.](?:${familyExtensions})$`);
const businessTargetSuffix = new RegExp(`^managed-upload-v1/${uuid}[.](?:pdf|png)$`);

function validHandoff(plan) {
  const family = plan.bucket === "payment-proofs";
  const business = plan.bucket === "business-documents";
  if (!family && !business) return false;
  const { source_path: source, target_path: target, source_version: version,
    byte_count: bytes, mime_type: type, relinked, sha256 } = plan;
  if (![source, target, version, plan.id, plan.lease_token].every(value => typeof value === "string")
    || !identifier.test(plan.id) || !identifier.test(plan.lease_token)
    || !identifier.test(version) || typeof relinked !== "boolean"
    || !Number.isInteger(bytes) || bytes < 1 || bytes > 10_485_760
    || (sha256 !== null && !/^[a-f0-9]{64}$/.test(sha256))
    || !(family ? familySource : businessSource).test(source)
  ) return false;
  const prefix = source.slice(0, source.lastIndexOf("/") + 1);
  const extension = source.slice(source.lastIndexOf("."));
  const media = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp" };
  return target.startsWith(prefix)
    && (family ? familyTargetSuffix : businessTargetSuffix).test(target.slice(prefix.length))
    && target.endsWith(extension)
    && type === media[extension];
}

async function digest(blob, expectedSize) {
  if (!blob || blob.size !== expectedSize) throw new Error("Unexpected proof size");
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function reconcileSharedProof({ claim, step, copy, read, remove }) {
  const plan = await claim();
  if (plan === null) return { claimed: 0, advanced: 0 };
  if (!plan || !validHandoff(plan)) throw new Error("Invalid proof transfer claim");
  const { bucket, source_path: source, target_path: target, byte_count: bytes } = plan;
  if (plan.relinked) {
    if (!await step(plan, "remove")) return { claimed: 1, advanced: 0 };
    const { data, error } = await remove(bucket, source);
    if (error || !Array.isArray(data) || data.length > 1 || data.some(object => object?.name !== source)) {
      return { claimed: 1, advanced: 0 };
    }
    return { claimed: 1, advanced: Number(await step(plan, "finish")) };
  }

  if (!await step(plan, "copy")) return { claimed: 1, advanced: 0 };
  // A retry can find a copy left by the previous lease. Verify its actual bytes
  // before asking Postgres to accept it as the exact ownerless replacement.
  await copy(bucket, source, plan.source_version, target);
  const [sourceDigest, targetDigest] = await Promise.all([
    read(bucket, source, bytes).then(blob => digest(blob, bytes)),
    read(bucket, target, bytes).then(blob => digest(blob, bytes)),
  ]);
  if (sourceDigest !== targetDigest || (plan.sha256 !== null && plan.sha256 !== sourceDigest)) {
    return { claimed: 1, advanced: 0 };
  }
  return { claimed: 1, advanced: Number(await step(plan, "relink", sourceDigest)) };
}
