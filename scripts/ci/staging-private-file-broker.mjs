import { randomUUID } from 'node:crypto';
import { API_ORIGIN, digest, need, tokenIdentity } from './staging-access.mjs';
const CASES = ['X_BROKER_PERSONAL_OWNER_FOREIGN', 'X_BROKER_SUBSCRIPTION_OWNER_STAFF', 'X_BROKER_NO_STORE', 'X_BROKER_EXACT_CLEANUP'];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=', 'base64');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isPrivateFileBrokerPlan(plan) {
  const diagnostic = ['enforced-diagnostic','enforced-s3','enforced-broker'].includes(plan.phase) && plan.raw_delivery_blocked === true
    && JSON.stringify(plan.case_ids) === JSON.stringify([...CASES,'X_BROKER_RAW_BEFORE_AFTER']);
  return plan.scope === 'private-file-broker' && plan.project === 'dczlddwbtgvfdujgcitb'
    && (diagnostic || plan.phase === 'additive' && plan.raw_delivery_blocked === false
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES));
}
export async function checkPrivateFileBroker({ actors, evidence }, key, agent, plan, fetcher = fetch) {
  need(isPrivateFileBrokerPlan(plan), 'REVIEWED_PRIVATE_FILE_BROKER_PLAN_REQUIRED');
  const owner = actors.USER_A, foreign = actors.USER_B, admin = actors.ADMIN;
  need(Object.keys(actors).length === 3 && new Set([owner?.id,foreign?.id,admin?.id]).size === 3
    && [owner,foreign,admin].every(a => UUID.test(a?.id || '') && tokenIdentity(a.token)?.userId === a.id), 'THREE_BOUND_FILE_ACTORS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, upload_attempts: 0, cleanup_paths: [],
    storage_cleanup_acknowledged: false, email_requests: 0, finance_writes: 0, direct_client_signed_urls_issued: 0,
    original_cached_access_finding_closed: false, raw_delivery_blocked: false, raw_route_observations: [] });
  const attempted = [], check = (name, passed) => { evidence.checks[name] = passed === true; need(passed === true, name + '_REQUIRED'); };
  let workspace, files = [], failure, cleanupFailure;
  const request = async (method, route, actor, body, { binary = false, cleanup = false } = {}) => {
    need(evidence.exercise_requests < (cleanup ? 48 : 40), 'BROKER_REQUEST_BOUND_REQUIRED');
    const u = new URL(route, API_ORIGIN);
    const workspaceRead = method === 'GET' && route === `/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status&owner_id=eq.${owner.id}&workspace_type=eq.personal&limit=2`;
    const fileRead = method === 'POST' && route === '/functions/v1/get-private-file' && Object.keys(body || {}).sort().join() === 'bucket,path'
      && files.some(f => f.bucket === body.bucket && f.path === body.path);
    const metadata = method === 'POST' && route === '/rest/v1/rpc/private_file_download_context'
      && Object.keys(body || {}).sort().join() === 'p_bucket_id,p_object_name'
      && files.some(f => f.bucket === body.p_bucket_id && f.path === body.p_object_name);
    const rawRead = ['enforced-diagnostic','enforced-s3','enforced-broker'].includes(plan.phase) && method === 'GET' && files.some(f=>u.pathname===`/storage/v1/object/authenticated/${f.bucket}/${f.path}`)
      && ([...u.searchParams.keys()].join()==='' || [...u.searchParams.keys()].join()==='cacheNonce');
    const signing = ['enforced-diagnostic','enforced-s3','enforced-broker'].includes(plan.phase) && method === 'POST' && files.some(f=>u.pathname===`/storage/v1/object/sign/${f.bucket}/${f.path}`) && body?.expiresIn===60;
    const upload = method === 'POST' && binary && attempted.some(f => route === `/storage/v1/object/${f.bucket}/${f.path}`);
    const remove = method === 'DELETE' && cleanup && files.some(f => route === `/storage/v1/object/${f.bucket}`)
      && Array.isArray(body?.prefixes) && body.prefixes.length > 0 && body.prefixes.every(path => attempted.some(f => route.endsWith('/'+f.bucket) && f.path === path));
    need(route.startsWith('/') && u.origin === API_ORIGIN && !u.hash && (workspaceRead || fileRead || metadata || upload || remove || rawRead || signing), 'BROKER_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response = await fetcher(u, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
      headers: { apikey: key, 'User-Agent': agent, ...(actor ? { Authorization: 'Bearer '+actor.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': binary ? 'image/png' : 'application/json' }), ...(binary ? { 'x-upsert':'false' } : {}) },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }) });
    const headers = Object.fromEntries(['cache-control','content-type','x-mushavo-media-type','cf-cache-status','vary','referrer-policy','x-content-type-options'].map(k=>[k,response.headers.get(k)]));
    let data;
    if (response.status === 200 && (fileRead || rawRead)) data = Buffer.from(await response.arrayBuffer());
    else { try { data = await response.json(); } catch { data = null; } }
    return { status:response.status,data,headers };
  };
  const observeRaw = async (file,label,fresh=false) => {
    const r=await request('GET',`/storage/v1/object/authenticated/${file.bucket}/${file.path}`+(fresh?'?cacheNonce='+randomUUID():''),owner);
    if(['enforced-s3','enforced-broker'].includes(plan.phase))check('RAW_OWNER_DENIED_'+file.bucket+'_'+label,[401,403,404].includes(r.status) || r.status===400 && [401,403,404].includes(Number(r.data?.statusCode)));
    evidence.raw_route_observations.push({bucket:file.bucket,label,status:r.status,headers:r.headers,
      ...(Buffer.isBuffer(r.data)?{bytes:r.data.length,harmless_fixture_matches:digest(r.data)===digest(PNG)}:{Storage_error:r.data?.error,Storage_status_code:r.data?.statusCode})});
  };
  const get = (file, actor) => request('POST','/functions/v1/get-private-file',actor,{bucket:file.bucket,path:file.path});
  const matches = r => r.status === 200 && Buffer.isBuffer(r.data) && digest(r.data) === digest(PNG);
  const noStore = r => /private, no-store/.test(r.headers['cache-control'] || '') && r.headers['referrer-policy'] === 'no-referrer'
    && r.headers['x-content-type-options'] === 'nosniff' && /Authorization/i.test(r.headers.vary || '');
  try {
    const result = await request('GET',`/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status&owner_id=eq.${owner.id}&workspace_type=eq.personal&limit=2`,owner);
    check('EXACT_PERSONAL_WORKSPACE',result.status===200 && result.data?.length===1 && UUID.test(result.data[0].id) && result.data[0].owner_id===owner.id);
    workspace=result.data[0].id;
    const nonce=randomUUID();
    files=[{bucket:'payment-proofs',path:`personal/${owner.id}/audit-broker-${nonce}.png`},
      {bucket:'subscription-proofs',path:`workspaces/${workspace}/${owner.id}/audit-broker-${nonce}.png`}];
    for (const [index,file] of files.entries()) {
      attempted.push(file); evidence.cleanup_paths=attempted.map(f=>({...f})); evidence.upload_attempts++;
      check('UPLOAD_'+index,[200,201].includes((await request('POST',`/storage/v1/object/${file.bucket}/${file.path}`,owner,PNG,{binary:true})).status));
      if(['enforced-diagnostic','enforced-s3','enforced-broker'].includes(plan.phase))await observeRaw(file,'before_broker');
      const own=await get(file,owner); check('OWNER_BYTES_'+index,matches(own));check('OWNER_NO_STORE_'+index,noStore(own));
      evidence['owner_response_'+index]={status:own.status,headers:own.headers,bytes:own.data.length,harmless_fixture_matches:true};
      if(['enforced-diagnostic','enforced-s3','enforced-broker'].includes(plan.phase)){
        await observeRaw(file,'after_broker');await observeRaw(file,'after_broker_unique_nonce',true);
        const sign=await request('POST',`/storage/v1/object/sign/${file.bucket}/${file.path}`,owner,{expiresIn:60});
        if(typeof sign.data?.signedURL==='string')evidence.direct_client_signed_urls_issued++;
        if(['enforced-s3','enforced-broker'].includes(plan.phase))check('SIGNING_DENIED_'+file.bucket,typeof sign.data?.signedURL!=='string' && ([401,403,404].includes(sign.status)||sign.status===400 && [401,403,404].includes(Number(sign.data?.statusCode))));
        evidence.raw_route_observations.push({bucket:file.bucket,label:'signing',status:sign.status,Storage_error:sign.data?.error,Storage_status_code:sign.data?.statusCode,signed_URL_returned:typeof sign.data?.signedURL==='string'});
      }
      const denied=await get(file,foreign);check('FOREIGN_DENIED_'+index,denied.status===404 && noStore(denied));
      const anon=await get(file,null);check('ANONYMOUS_DENIED_'+index,anon.status===401 && noStore(anon));
      const context=await request('POST','/rest/v1/rpc/private_file_download_context',owner,{p_bucket_id:file.bucket,p_object_name:file.path});
      check('INVOKER_METADATA_ONLY_'+index,context.status===200 && context.data?.length===1 && context.data[0].size_bytes===PNG.length
        && !JSON.stringify(context.data).includes('signedURL') && !JSON.stringify(context.data).includes('safe'));
    }
    check('FINANCE_ADMIN_SUBSCRIPTION_PROOF',matches(await get(files[1],admin)));
    check('CURRENT_OWNER_REPEAT_REQUEST',matches(await get(files[0],owner)));
  } catch(error) { failure=error; }
  finally {
    for(const file of attempted) try {
      const removed=await request('DELETE',`/storage/v1/object/${file.bucket}`,owner,{prefixes:[file.path]},{cleanup:true});
      check('DELETE_ACK_'+file.bucket,[200,204].includes(removed.status));
      const absent=await request('POST','/rest/v1/rpc/private_file_download_context',owner,{p_bucket_id:file.bucket,p_object_name:file.path},{cleanup:true});
      check('DELETED_CONTEXT_EMPTY_'+file.bucket,absent.status===200 && Array.isArray(absent.data) && absent.data.length===0);
    } catch(error) { cleanupFailure=error; }
    evidence.storage_cleanup_acknowledged=attempted.length>0 && !cleanupFailure;
  }
  if(cleanupFailure)throw cleanupFailure;if(failure)throw failure;
}
