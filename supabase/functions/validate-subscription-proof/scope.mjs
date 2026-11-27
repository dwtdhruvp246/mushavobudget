import { OWNER, WORKSPACE } from "../validate-payment-proof/handler.mjs";

export { OWNER, WORKSPACE };
export const BUCKET = "subscription-proofs";
export const PREFIX = `workspaces/${WORKSPACE}/${OWNER}/fr3-subscription-proof/`;

export function bindSubscriptionProof(client, userId) {
  if (userId !== OWNER) return null;
  return {
    prefix: PREFIX,
    async canWrite() {
      const [session, workspace, suspended] = await Promise.all([
        client.rpc("app_session_status"),
        client.from("budget_workspaces").select("id,owner_id,status,workspace_type").eq("id", WORKSPACE).maybeSingle(),
        client.rpc("my_account_suspended"),
      ]);
      const w = workspace.data;
      return !session.error && session.data?.session_valid === true
        && !suspended.error && suspended.data === false
        && !workspace.error && w?.id === WORKSPACE && w.owner_id === OWNER
        && w.workspace_type === "personal" && w.status === "active";
    },
  };
}
