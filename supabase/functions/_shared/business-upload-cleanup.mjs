const MAX_CLEANUP_BATCH = 20;
const MAX_SMALL_BATCH = 5;
const UUID = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
const SUBSCRIPTION_PATH = new RegExp(`^workspaces/${UUID}/${UUID}/managed-proof-v1/${UUID}/${UUID}[.](?:pdf|png)$`);
const TOKEN = new RegExp(`^${UUID}$`);
const LOGO_PATH = new RegExp(`^${UUID}/${UUID}/${UUID}[.](?:png|jpg|webp)$`);
const PATH = new RegExp(`^workspaces/(${UUID})/${UUID}/${UUID}/${UUID}[.](?:pdf|png|csv|xlsx)$`);

// The service-side adapter claims work from the durable manifest. A worker
// never receives filenames from a request or mutates Storage metadata via SQL.
export async function reconcileBusinessUploads(workspaceId, { claim, remove, finish }) {
  if (!TOKEN.test(workspaceId || "")) throw new Error("Invalid cleanup workspace");
  return reconcile("business-documents", await claim(workspaceId, MAX_CLEANUP_BATCH),
    path => PATH.exec(path)?.[1] === workspaceId, MAX_CLEANUP_BATCH, remove, finish);
}

export async function reconcileReplacedLogos({claim, remove, finish}) {
  return reconcile("business-logos", await claim(MAX_SMALL_BATCH), path => LOGO_PATH.test(path), MAX_SMALL_BATCH, remove, finish);
}

export async function reconcileUnlinkedSubscriptions({claim, remove, finish}) {
  return reconcile("subscription-proofs", await claim(MAX_SMALL_BATCH), path => SUBSCRIPTION_PATH.test(path),
    MAX_SMALL_BATCH, remove, finish);
}

async function reconcile(bucket, batch, validPath, limit, remove, finish) {
  if (!Array.isArray(batch) || batch.length > limit) throw new Error("Invalid cleanup batch");
  const seen = new Set();
  for (const item of batch) {
    if (!validPath(item?.object_name || "")
        || !TOKEN.test(item?.cleanup_token || "") || seen.has(item.object_name)) {
      throw new Error("Invalid cleanup claim");
    }
    seen.add(item.object_name);
  }

  const counts = { claimed: batch.length, removed: 0, retry: 0 };
  for (const { object_name, cleanup_token } of batch) {
    try {
      const { data, error } = await remove(bucket, object_name);
      if (!error && Array.isArray(data) && data.length <= 1 && data.every(object => object?.name === object_name)
          && await finish(object_name, cleanup_token) === true) {
        counts.removed++;
      } else counts.retry++;
    } catch {
      counts.retry++;
    }
  }
  return counts;
}
