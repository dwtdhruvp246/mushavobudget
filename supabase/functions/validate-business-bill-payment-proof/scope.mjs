import { BUCKET, WORKSPACE, OWNER, bindBusinessDocument } from "../validate-business-document/scope.mjs";

export { BUCKET, WORKSPACE, OWNER };
export const BILL = "509ea1cd-6182-404c-bf52-46d33ea05a3c";
export const PAYMENT = "89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120";
export const DOCUMENT = "ef6fb184-5e10-44b8-9d8a-a4ed532733c7";
export const PREFIX = `workspaces/${WORKSPACE}/${OWNER}/${DOCUMENT}/`;

export function bindBillPaymentProof(client, userId) {
  const scope = bindBusinessDocument(client, userId);
  if (!scope) return null;
  return {
    prefix: PREFIX,
    async canWrite() {
      if (!await scope.canWrite()) return false;
      const {data,error} = await client.from("business_bill_payments").select("id,workspace_id,bill_id,recorded_by")
        .eq("id",PAYMENT).eq("workspace_id",WORKSPACE).maybeSingle();
      return !error && data?.id === PAYMENT && data.workspace_id === WORKSPACE && data.bill_id === BILL
        && data.recorded_by === OWNER;
    },
  };
}
