import { BUCKET, OWNER, WORKSPACE, bindBusinessDocument } from "../validate-business-document/scope.mjs";

export { BUCKET, OWNER, WORKSPACE };
export const attachmentFixtures = new Map([
  ["expense-claim", {
    document: "7b7e5da1-ff93-44a0-91e0-2dd6a400cac3", parent: "454e6059-4b4c-4998-aa9d-ea932b15ca50", type: "expense_claim", table: "business_expense_claims",
  }],
  ["bill-invoice", {
    document: "c877b770-3bb6-4e0c-aae3-a6a10f3234f6", parent: "ac975ebd-b138-40c4-a082-c6e62670a98a", type: "business_bill", table: "business_bills",
  }],
]);

export function bindBusinessAttachment(client, userId, _type, request) {
  const scope = bindBusinessDocument(client, userId);
  const fixture = attachmentFixtures.get(request?.headers.get("x-mushavo-attachment"));
  if (!scope || !fixture) return null;
  return {
    prefix: `workspaces/${WORKSPACE}/${OWNER}/${fixture.document}/`,
    async canWrite() {
      if (!await scope.canWrite()) return false;
      const { data, error } = await client.from(fixture.table).select("id,workspace_id,status")
        .eq("id", fixture.parent).eq("workspace_id", WORKSPACE).maybeSingle();
      return !error && data?.id === fixture.parent && data.workspace_id === WORKSPACE
        && data.status === (fixture.type === "expense_claim" ? "draft" : "open");
    },
  };
}
