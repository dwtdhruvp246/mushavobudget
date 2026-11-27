const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const versionedKey = /^[a-f0-9-]{36}\/(?:[a-z0-9-]+\/){0,2}[a-f0-9-]{36}[.](pdf|png|jpe?g|webp)$/;

export async function reconcileBillingArchiveExpiry({ step, remove }) {
  const action = await step();
  if (action === null) return null;
  if (action.status === "completed" || action.status === "review_required") {
    return { status: action.status };
  }

  if (action.status !== "remove_proof" || !uuid.test(action.workspace_id)
    || !uuid.test(action.lease_id) || !uuid.test(action.object_id)) {
    return { status: "retry" };
  }
  const prefix = "workspaces/" + action.workspace_id + "/";
  if (typeof action.path !== "string" || !action.path.startsWith(prefix) || !versionedKey.test(action.path.slice(prefix.length))) {
    return { status: "retry" };
  }

  const removed = await remove("subscription-proofs", action.path);
  if (removed.error || !Array.isArray(removed.data)
    || removed.data.length !== 1 || removed.data[0]?.name !== action.path || removed.data[0]?.id !== action.object_id) {
    return { status: "retry" };
  }

  const receipt = await step(action.workspace_id, action.lease_id);
  return receipt?.status === "completed" || receipt?.status === "proof_confirmed" || receipt?.status === "review_required"
    ? { status: receipt.status } : { status: "retry" };
}
