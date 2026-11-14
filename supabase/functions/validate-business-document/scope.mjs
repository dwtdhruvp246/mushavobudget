import { OWNER } from "../validate-payment-proof/handler.mjs";

export { OWNER };
export const WORKSPACE = "8d9307e6-aada-4c9a-a8f5-43c57e0865e2";
export const DOCUMENT = "75e6c01e-e490-4e83-9774-618867654b24";
export const BUCKET = "business-documents";
export const PREFIX = `workspaces/${WORKSPACE}/${OWNER}/${DOCUMENT}/`;

export function bindBusinessDocument(client, userId) {
  if (userId !== OWNER) return null;
  return {
    prefix: PREFIX,
    async canWrite() {
      const [session, workspace, permission] = await Promise.all([
        client.rpc("app_session_status"),
        client.from("budget_workspaces").select("id,owner_id,status,workspace_type").eq("id", WORKSPACE).maybeSingle(),
        client.rpc("business_has_permission", { p_workspace_id: WORKSPACE, p_permission_code: "documents.create" }),
      ]);
      const w = workspace.data;
      return !session.error && session.data?.session_valid === true
        && !permission.error && permission.data === true
        && !workspace.error && w?.id === WORKSPACE && w.owner_id === OWNER
        && w.workspace_type === "business" && w.status === "active";
    },
  };
}
