export const FAMILY = "08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c";
export const ITEM = "0986f8bc-7905-4ec8-b023-a00f10a18d88";
export const OWNER = "ca7bdcf2-e69d-42e2-8ae8-79cac6de2184";
export const MEMBER = "660a1463-6589-4c4d-ab6c-8ee50161038f";
export const prefixFor = user => `families/${FAMILY}/${OWNER}/${user}/fr3-proof/${ITEM}/`;

export function bindFamilyProof(client, user) {
  if (user !== OWNER && user !== MEMBER) return null;
  return {
    prefix: prefixFor(user),
    async canWrite() {
      const session = await client.rpc("app_session_status");
      if (session.error || session.data?.session_valid !== true) return false;
      const membership = await client.rpc("is_active_family_participant", { p_family_id: FAMILY });
      if (membership.error || membership.data !== true) return false;
      const item = await client.from("payment_items").select("id,workspace_id,owner_id,visibility,family_id,status")
        .eq("id", ITEM).maybeSingle();
      const row = item.data;
      if (item.error || row?.id !== ITEM || !row.workspace_id || row.owner_id !== OWNER
          || row.visibility !== "family" || row.family_id !== FAMILY || row.status !== "active") return false;
      const workspace = await client.from("budget_workspaces").select("id,legacy_family_id,owner_id,workspace_type,status")
        .eq("id", row.workspace_id).maybeSingle();
      const w = workspace.data;
      if (workspace.error || w?.id !== row.workspace_id || w.legacy_family_id !== FAMILY || w.owner_id !== OWNER
          || w.workspace_type !== "household" || w.status !== "active") return false;
      const entitlement = await client.rpc("effective_workspace_entitlement", { p_workspace_id: w.id });
      const e = entitlement.data?.[0];
      return !entitlement.error && e?.workspace_id === w.id && e.read_only === false && e.effective_status === "active";
    },
  };
}
