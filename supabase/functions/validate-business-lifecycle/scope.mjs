import { BUCKET, OWNER, WORKSPACE, bindBusinessDocument } from "../validate-business-document/scope.mjs";

export { BUCKET, OWNER, WORKSPACE };
export const DOCUMENTS = Object.freeze({
  orphan: "a83a436a-a324-45a3-b321-17084d2d5062",
  committed: "32ea8cbf-0a6c-43cc-a21a-42dfe989b424",
});
export const prefix = document => `workspaces/${WORKSPACE}/${OWNER}/${document}/`;
export function bindLifecycleTrial(client, userId, _type, request) {
  const lane = request?.headers.get("x-mushavo-attachment");
  const scope = bindBusinessDocument(client, userId);
  return scope && Object.hasOwn(DOCUMENTS,lane) ? {...scope,prefix:prefix(DOCUMENTS[lane])} : null;
}
