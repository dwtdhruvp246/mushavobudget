import { BUCKET, OWNER, WORKSPACE, bindBusinessDocument } from "../validate-business-document/scope.mjs";

export { BUCKET, OWNER, WORKSPACE };
export const DOCUMENTS = Object.freeze({
  orphan: "a1a26ceb-d569-43ae-93f7-496fe0927ebc",
  committed: "c48c3db5-8eb6-4614-9b2e-784a5502a662",
});
export const prefix = document => `workspaces/${WORKSPACE}/${OWNER}/${document}/`;
export function bindLifecycleTrial(client, userId, _type, request) {
  const lane = request?.headers.get("x-mushavo-attachment");
  const scope = bindBusinessDocument(client, userId);
  return scope && Object.hasOwn(DOCUMENTS,lane) ? {...scope,prefix:prefix(DOCUMENTS[lane])} : null;
}
