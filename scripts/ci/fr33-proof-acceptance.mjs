import { readFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { API_ORIGIN, WEB_ORIGIN, digest, need, readPublicConfiguration, tokenIdentity } from './staging-access.mjs';
import { createMailbox } from './staging-recovery-bridge.mjs';

const plan = JSON.parse(await readFile(new URL('./fr33-proof-run.json', import.meta.url), 'utf8'));
if (plan.enabled === false) process.exit(0);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const roles = ['owner','uploader','outsider'];
const ids = [...roles.map(role => plan[role]),plan.family,plan.workspace,plan.item,plan.payment,plan.attachment];
need(plan.project === 'dczlddwbtgvfdujgcitb' && plan.scope === 'fr33-family-proof'
  && ids.every(id => uuid.test(id)) && new Set(ids).size === ids.length, 'DISPOSABLE_SCOPE_REQUIRED');
const mailbox = createMailbox(process.env);
const fixtureName = 'FR33 synthetic Family proof ' + plan.family;
const uploaderName = 'FR33 Disposable Uploader';
const prefix = ['families',plan.family,plan.owner,plan.uploader,'managed-upload-v1',plan.attachment,''].join('/');

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
      ...(upload ? {'x-mushavo-attachment':['payment-proofs',plan.workspace,plan.attachment].join(':')} : {}),
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
const download = (path, token) => request('POST','/functions/v1/get-private-file',token,{bucket:'payment-proofs',path},{readBytes:true});

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
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOQq/Q6df8xA4QCACp5BtsvverpAAAAAElFTkSuQmCC', 'base64');
  const proof = expect(await request('POST','/functions/v1/validate-ordinary-private-upload',accounts.uploader,png,{upload:true}),200,'PROOF_UPLOAD');
  need(proof?.path?.startsWith(prefix) && /^[A-Za-z0-9_.-]+\.png$/.test(proof.path.slice(prefix.length))
    && proof.type === 'image/png' && Number.isSafeInteger(proof.size) && proof.size > 0 && proof.size < 10000, 'EXACT_UPLOAD_RECEIPT_REQUIRED');
  expect(await request('POST','/rest/v1/payment_records',accounts.uploader,{
    id:plan.payment,family_id:plan.family,owner_id:plan.uploader,recorded_by:plan.uploader,visibility:'family',
    payment_item_id:plan.item,period_start:today,due_date:today,payment_date:today,
    amount:11,currency:'USD',payment_method:'Cash',
    proof_path:proof.path,proof_name:'disposable-proof.png',proof_mime_type:proof.type,proof_size_bytes:proof.size
  }),201,'PAYMENT_PROOF_LINK');
  const before = expect(await record(accounts.owner),200,'PAYMENT_BEFORE_ERASURE');
  need(before.length === 1 && before[0].id === plan.payment && before[0].recorded_by === plan.uploader
    && before[0].proof_path === proof.path && Number(before[0].amount) === 11, 'PAYMENT_BINDING_REQUIRED');
  const original = expect(await download(proof.path,accounts.owner),200,'MEMBER_DOWNLOAD_BEFORE_ERASURE');
  need(original.length === proof.size, 'EXACT_PROOF_SIZE_REQUIRED');
  const outsiderBefore = await download(proof.path,accounts.outsider);
  need([401,403,404].includes(outsiderBefore.status), 'OUTSIDER_BEFORE_MUST_BE_DENIED');
  const impact = expect(await rpc('fr33_account_deletion_impact',accounts.uploader),200,'DELETION_IMPACT');
  need(/^[0-9a-f]{64}$/.test(impact?.impact_token ?? ''), 'DELETION_IMPACT_TOKEN_REQUIRED');
  const confirmed = expect(await rpc('fr33_submit_account_deletion',accounts.uploader,{p_impact_token:impact.impact_token}),200,'DELETION_SUBMIT');
  need(uuid.test(confirmed?.request_id ?? ''), 'CONFIRMED_REQUEST_REQUIRED');
  await mailbox.status('FR33_PROOF_READY');
  const deadline = Date.now()+240000;
  let erased = false;
  while (Date.now() < deadline) {
    const result = await rpc('app_session_status',accounts.uploader);
    if ([401,403].includes(result.status) || result.status === 200 && result.data?.session_valid === false) { erased = true; break; }
    await wait(3000);
  }
  need(erased, 'UPLOADER_SESSION_STILL_ACTIVE');
  const after = expect(await record(accounts.owner),200,'PAYMENT_AFTER_ERASURE');
  need(after.length === 1 && after[0].proof_path === proof.path && after[0].recorded_by === null
    && after[0].fr33_family_payment_names?.recorder_name === uploaderName && Number(after[0].amount) === 11, 'PAYMENT_AND_NAME_MUST_SURVIVE');
  const restored = expect(await download(proof.path,accounts.owner),200,'MEMBER_DOWNLOAD_AFTER_ERASURE');
  need(digest(restored) === digest(original), 'RETAINED_PROOF_BYTES_CHANGED');
  for (const role of ['uploader','outsider']) {
    const result = await download(proof.path,accounts[role]);
    need([401,403,404].includes(result.status),'POST_ERASURE_DENIAL_REQUIRED_'+role);
  }
  console.log(JSON.stringify({result:'FR33_FAMILY_PROOF_BYTES_MATCH',proof_bytes:restored.length,requests}));
  await mailbox.status('FR33_PROOF_BYTES_MATCH','success');
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
