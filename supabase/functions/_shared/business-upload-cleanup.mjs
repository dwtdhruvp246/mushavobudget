const MAX_CLEANUP_BATCH = 20;
const UUID = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
const TOKEN = new RegExp(`^${UUID}$`);
const PATH = new RegExp(`^workspaces/(${UUID})/${UUID}/${UUID}/${UUID}[.](?:pdf|png|csv|xlsx)$`);

// The service-side adapter claims work from the durable manifest. A worker
// never receives filenames from a request or mutates Storage metadata via SQL.
export async function reconcileBusinessUploads(workspaceId, { claim, remove, finish }) {
  if (!TOKEN.test(workspaceId || "")) throw new Error("Invalid cleanup workspace");
  const batch = await claim(workspaceId, MAX_CLEANUP_BATCH);
  if (!Array.isArray(batch) || batch.length > MAX_CLEANUP_BATCH) throw new Error("Invalid cleanup batch");
  const seen = new Set();
  for (const item of batch) {
    if (PATH.exec(item?.object_name || "")?.[1] !== workspaceId
        || !TOKEN.test(item?.cleanup_token || "") || seen.has(item.object_name)) {
      throw new Error("Invalid cleanup claim");
    }
    seen.add(item.object_name);
  }

  const counts = { claimed: batch.length, removed: 0, retry: 0 };
  for (const { object_name, cleanup_token } of batch) {
    try {
      const { data, error } = await remove("business-documents", object_name);
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
