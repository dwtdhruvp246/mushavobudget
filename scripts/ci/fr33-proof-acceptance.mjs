import { readFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { API_ORIGIN, WEB_ORIGIN, digest, need, readPublicConfiguration, tokenIdentity } from './staging-access.mjs';
import { createMailbox } from './staging-recovery-bridge.mjs';

const plan = JSON.parse(await readFile(new URL('./fr33-proof-run.json', import.meta.url), 'utf8'));
if (plan.enabled === false) process.exit(0);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const roles = ['owner','uploader','outsider'];
const business = ['fr33-business-proof','fr33-owned-business-proof'].includes(plan.scope);
const owned = ['fr33-owned-family-proof','fr33-owned-business-proof'].includes(plan.scope);
const ids = [...roles.map(role => plan[role]),plan.workspace,plan.attachment,
  ...(business ? [plan.category,plan.claim] : [plan.family,plan.item,plan.payment])];
need(plan.project === 'dczlddwbtgvfdujgcitb' && (business || owned || plan.scope === 'fr33-family-proof')
  && ids.every(id => uuid.test(id)) && new Set(ids).size === ids.length, 'DISPOSABLE_SCOPE_REQUIRED');
const mailbox = createMailbox(process.env);
const fixtureName = business ? 'FR33 synthetic Business proof ' + plan.workspace : 'FR33 synthetic Family proof ' + plan.family;
const uploaderName = 'FR33 Disposable Uploader';
const bucket = business ? 'business-documents' : 'payment-proofs';
const prefix = business
  ? ['workspaces',plan.workspace,plan.uploader,plan.attachment,'managed-upload-v1',''].join('/')
  : ['families',plan.family,plan.owner,plan.uploader,'managed-upload-v1',plan.attachment,''].join('/');

const config = await fetch(WEB_ORIGIN + '/config.js', {redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
need(config.ok, 'LIVE_STAGING_CONFIGURATION_REQUIRED');
const { key } = readPublicConfiguration(await config.text());
const accounts = {};
let requests = 0;
async function request(method, route, token, body, { upload, readBytes = false } = {}) {
  const url = new URL(route, API_ORIGIN);
  need(++requests <= 150 && url.origin === API_ORIGIN && route.startsWith('/') && !url.hash, 'HTTP_SCOPE_REQUIRED');
  const result = await fetch(url, {
    method, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(15000),
    headers:{apikey:key,
      ...(token ? {Authorization:'Bearer '+token} : {}),
      ...(body === undefined ? {} : {'Content-Type':upload ? 'image/png' : 'application/json'}),
      ...(upload ? {'x-mushavo-attachment':[bucket,plan.workspace,plan.attachment,
        ...(business ? ['expense_claim',plan.claim] : [])].join(':')} : {}),
      ...(method === 'POST' && ['/rest/v1/payment_items','/rest/v1/payment_records'].includes(route) ? {Prefer:'return=minimal'} : {})},
    ...(body === undefined ? {} : {body:upload ? body : JSON.stringify(body)})
  });
  const data = result.ok && readBytes ? Buffer.from(await result.arrayBuffer()) : await result.json().catch(() => null);
  return {status:result.status, data};
}
const rpc = (name, token, body = {}) => request('POST','/rest/v1/rpc/'+name,token,body);
const expect = (result, status, message) => {
  need(result.status === status, message + '_HTTP_' + result.status);
  return result.data;
};
const record = token => request('GET','/rest/v1/payment_records?select=id,proof_path,recorded_by,amount,fr33_family_payment_names(recorder_name)&id=eq.'+plan.payment,token);
const download = (path, token) => request('POST','/functions/v1/get-private-file',token,{bucket,path},{readBytes:true});
const claimRecord = token => request('GET','/rest/v1/business_expense_claims?select=id,submitted_by,retained_submitter_name,status,amount,version&id=eq.'+plan.claim+'&workspace_id=eq.'+plan.workspace,token);
const documentRecord = token => request('GET','/rest/v1/business_documents?select=id,parent_id,uploaded_by,storage_path&id=eq.'+plan.attachment+'&workspace_id=eq.'+plan.workspace,token);

async function uploadProof() {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOQq/Q6df8xA4QCACp5BtsvverpAAAAAElFTkSuQmCC', 'base64');
  const proof = expect(await request('POST','/functions/v1/validate-ordinary-private-upload',accounts.uploader,png,{upload:true}),200,'PROOF_UPLOAD');
  need(proof?.path?.startsWith(prefix) && /^[A-Za-z0-9_-]+\.png$/.test(proof.path.slice(prefix.length))
    && proof.type === 'image/png' && Number.isSafeInteger(proof.size) && proof.size > 0 && proof.size < 10000, 'EXACT_UPLOAD_RECEIPT_REQUIRED');
  return proof;
}

async function prepareBusinessProof() {
  const workspaces = expect(await request('GET','/rest/v1/budget_workspaces?select=id,name,owner_id,workspace_type&id=eq.'+plan.workspace,accounts.owner),200,'BUSINESS_WORKSPACE');
  need(workspaces.length === 1 && workspaces[0].name === fixtureName && workspaces[0].owner_id === plan.owner
    && workspaces[0].workspace_type === 'business','EXACT_BUSINESS_REQUIRED');
  const drafts = expect(await claimRecord(accounts.uploader),200,'READ_FIXTURE_CLAIM');
  need(drafts.length === 1 && drafts[0].status === 'draft' && drafts[0].submitted_by === plan.uploader
    && Number(drafts[0].amount) === 11,'EXACT_DISPOSABLE_DRAFT_REQUIRED');
  const proof = await uploadProof();
  const fields = {p_workspace_id:plan.workspace,p_claim_id:plan.claim};
  const document = expect(await rpc('register_business_document',accounts.uploader,{
    p_document_id:plan.attachment,p_workspace_id:plan.workspace,p_parent_type:'expense_claim',p_parent_id:plan.claim,
    p_storage_path:proof.path,p_original_name:'disposable-claim-proof.png',p_mime_type:proof.type,p_size_bytes:proof.size
  }),200,'LINK_BUSINESS_PROOF');
  need(document?.id === plan.attachment && document.uploaded_by === plan.uploader && document.storage_path === proof.path,
    'EXACT_BUSINESS_DOCUMENT_REQUIRED');
  const submitted = expect(await rpc('submit_business_claim',accounts.uploader,{
    ...fields,p_expected_version:drafts[0].version
  }),200,'SUBMIT_BUSINESS_CLAIM');
  need(submitted?.status === 'submitted','SUBMITTED_CLAIM_REQUIRED');
  const reviewed = expect(await rpc('review_business_claim',accounts.owner,{
    ...fields,p_expected_version:submitted.version,p_decision:'approved',p_reason:'Disposable FR33 acceptance'
  }),200,'APPROVE_BUSINESS_CLAIM');
  need(reviewed?.status === 'approved','APPROVED_CLAIM_REQUIRED');
  const paid = expect(await rpc('record_business_claim_payment_with_source',accounts.owner,{
    ...fields,p_expected_version:reviewed.version,p_paid_at:new Date().toISOString(),
    p_payment_reference:'Disposable FR33 acceptance',p_payment_source:'cash'
  }),200,'PAY_BUSINESS_CLAIM');
  need(paid?.status === 'paid' && paid.submitted_by === plan.uploader && Number(paid.amount) === 11, 'PAID_CLAIM_REQUIRED');
  return proof;
}

async function prepareFamilyProof() {
  const families = expect(await request('GET','/rest/v1/families?select=id,name,owner_id&id=eq.'+plan.family,accounts.owner),200,'FAMILY');
  need(families.length === 1 && families[0].owner_id === plan.owner && families[0].name === fixtureName, 'EXACT_FAMILY_REQUIRED');
  const today = new Date().toISOString().slice(0,10);
  const items = expect(await request('GET','/rest/v1/payment_items?select=id,owner_id,family_id,name&id=eq.'+plan.item,accounts.owner),200,'FIND_PAYMENT_ITEM');
  if (items.length === 0) {
    expect(await request('POST','/rest/v1/payment_items',accounts.owner,{
      id:plan.item,family_id:plan.family,owner_id:plan.owner,created_by:plan.owner,visibility:'family',
      name:'FR33 disposable proof payment',category:'Other',amount:11,currency:'USD',start_date:today,status:'active'
    }),201,'PAYMENT_ITEM');
  } else {
    need(items.length === 1 && items[0].owner_id === plan.owner && items[0].family_id === plan.family
      && items[0].name === 'FR33 disposable proof payment', 'EXACT_RETRY_ITEM_REQUIRED');
  }
  const proof = await uploadProof();
  expect(await request('POST','/rest/v1/payment_records',accounts.uploader,{
    id:plan.payment,family_id:plan.family,owner_id:plan.uploader,recorded_by:plan.uploader,visibility:'family',
    payment_item_id:plan.item,period_start:today,due_date:today,payment_date:today,
    amount:11,currency:'USD',payment_method:'Cash',
    proof_path:proof.path,proof_name:'disposable-proof.png',proof_mime_type:proof.type,proof_size_bytes:proof.size
  }),201,'PAYMENT_PROOF_LINK');
  const before = expect(await record(accounts.owner),200,'PAYMENT_BEFORE_ERASURE');
  need(before.length === 1 && before[0].id === plan.payment && before[0].recorded_by === plan.uploader
    && before[0].proof_path === proof.path && Number(before[0].amount) === 11, 'PAYMENT_BINDING_REQUIRED');
  return proof;
}

let code = 'UNEXPECTED_ERROR';
try {
  const input = await mailbox.receive('FR33_PROOF_INPUT');
  for (const role of roles) {
    const supplied = input[role];
    need(supplied?.email === role+'-'+plan[role]+'@fr33proof.example.invalid'
      && /^[A-Za-z0-9_-]{43}$/.test(supplied.password), 'DISPOSABLE_CREDENTIALS_REQUIRED');
    const logon = expect(await request('POST','/auth/v1/token?grant_type=password',null,supplied),200,'DISPOSABLE_LOGIN_'+role);
    need(tokenIdentity(logon?.access_token)?.userId === plan[role], 'DISPOSABLE_TOKEN_ID_REQUIRED');
    accounts[role] = logon.access_token;
    need(expect(await rpc('app_session_status',accounts[role]),200,'SESSION_'+role)?.session_valid === true, 'DISPOSABLE_SESSION_INVALID_'+role);
    delete input[role];
  }
  const proof = business ? await prepareBusinessProof() : await prepareFamilyProof();
  const original = expect(await download(proof.path,accounts.owner),200,'MEMBER_DOWNLOAD_BEFORE_ERASURE');
  need(original.length === proof.size, 'EXACT_PROOF_SIZE_REQUIRED');
  const outsiderBefore = await download(proof.path,accounts.outsider);
  need([401,403,404].includes(outsiderBefore.status), 'OUTSIDER_BEFORE_MUST_BE_DENIED');
  const subject = owned ? 'owner' : 'uploader';
  const impact = expect(await rpc('fr33_account_deletion_impact',accounts[subject]),200,'DELETION_IMPACT');
  need(/^[0-9a-f]{64}$/.test(impact?.impact_token ?? ''), 'DELETION_IMPACT_TOKEN_REQUIRED');
  if (owned) {
    need(impact.workspaces?.length === 1 && impact.workspaces[0].kind === (business ? 'business' : 'family')
      && impact.workspaces[0].name === fixtureName, 'EXACT_OWNED_WORKSPACE_WARNING_REQUIRED');
  }
  const confirmed = expect(await rpc('fr33_submit_account_deletion',accounts[subject],{p_impact_token:impact.impact_token}),200,'DELETION_SUBMIT');
  need(uuid.test(confirmed?.request_id ?? ''), 'CONFIRMED_REQUEST_REQUIRED');
  await mailbox.status('FR33_PROOF_READY');
  const deadline = Date.now()+240000;
  let erased = false;
  while (Date.now() < deadline) {
    const result = await rpc('app_session_status',accounts[subject]);
    if ([401,403].includes(result.status) || result.status === 200 && result.data?.session_valid === false) { erased = true; break; }
    await wait(3000);
  }
  need(erased, 'DELETION_SUBJECT_SESSION_STILL_ACTIVE');
  if (owned) {
    need(expect(await rpc('app_session_status',accounts.uploader),200,'FORMER_MEMBER_SESSION')?.session_valid === true,
      'FORMER_MEMBER_ACCOUNT_MUST_SURVIVE');
    for (const role of roles) {
      const result = await download(proof.path,accounts[role]);
      need([401,403,404].includes(result.status),'CLOSED_WORKSPACE_FILE_DENIAL_REQUIRED_'+role);
    }
    console.log(JSON.stringify({result:business ? 'FR33_OWNED_BUSINESS_PROOF_ACCESS_CLOSED'
      : 'FR33_OWNED_FAMILY_PROOF_ACCESS_CLOSED',proof_bytes:original.length,requests}));
    await mailbox.status('FR33_OWNED_WORKSPACE_ACCESS_CLOSED','success');
  } else {
    if (business) {
      const after = expect(await claimRecord(accounts.owner),200,'CLAIM_AFTER_ERASURE');
      const documents = expect(await documentRecord(accounts.owner),200,'DOCUMENT_AFTER_ERASURE');
      need(after.length === 1 && after[0].status === 'paid' && Number(after[0].amount) === 11
        && after[0].submitted_by === null && after[0].retained_submitter_name === uploaderName, 'CLAIM_AND_NAME_MUST_SURVIVE');
      need(documents.length === 1 && documents[0].parent_id === plan.claim && documents[0].uploaded_by === null
        && documents[0].storage_path === proof.path, 'CLAIM_PROOF_LINK_MUST_SURVIVE');
    } else {
      const after = expect(await record(accounts.owner),200,'PAYMENT_AFTER_ERASURE');
      need(after.length === 1 && after[0].proof_path === proof.path && after[0].recorded_by === null
        && after[0].fr33_family_payment_names?.recorder_name === uploaderName && Number(after[0].amount) === 11, 'PAYMENT_AND_NAME_MUST_SURVIVE');
    }
    const restored = expect(await download(proof.path,accounts.owner),200,'MEMBER_DOWNLOAD_AFTER_ERASURE');
    need(digest(restored) === digest(original), 'RETAINED_PROOF_BYTES_CHANGED');
    for (const role of ['uploader','outsider']) {
      const result = await download(proof.path,accounts[role]);
      need([401,403,404].includes(result.status),'POST_ERASURE_DENIAL_REQUIRED_'+role);
    }
    console.log(JSON.stringify({result:business ? 'FR33_BUSINESS_PROOF_BYTES_MATCH' : 'FR33_FAMILY_PROOF_BYTES_MATCH',proof_bytes:restored.length,requests}));
    await mailbox.status('FR33_PROOF_BYTES_MATCH','success');
  }
  code = null;
} catch (error) {
  code = typeof error.code === 'string' && /^[A-Z0-9_-]{1,100}$/i.test(error.code) ? error.code : 'UNEXPECTED_ERROR';
  console.log(JSON.stringify({result:'FR33_PROOF_REVIEW',code,requests}));
  try { await mailbox.status(code.slice(0,110),'failure'); } catch {}
} finally {
  for (const role of roles) {
    if (accounts[role]) {
      try { await request('POST','/auth/v1/logout?scope=local',accounts[role]); } catch {}
    }
  }
}
if (code) process.exitCode = 1;
