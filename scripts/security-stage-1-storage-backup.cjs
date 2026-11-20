'use strict';

// Owner-local, read-only Storage component pass. Never import this into app assets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const PROJECT = 'kttkospkblwvguuwnhjj';
const ORIGIN = `https://${PROJECT}.supabase.co`;
const EXPECTED = ['business-documents', 'business-logos', 'payment-proofs', 'subscription-proofs'];
const LIMITS = { page: 100, requests: 1000, entries: 2000, buckets: 100,
  fileBytes: 64 * 1024 * 1024, totalBytes: 1024 * 1024 * 1024, jsonBytes: 2 * 1024 * 1024,
  requestMs: 60000, runMs: 15 * 60000 };
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function safeCode(e) { return /^[A-Z_0-9]+$/.test(e?.code || '') ? e.code : 'LOCAL_OR_NETWORK_FAILURE'; }
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])]));
  return v;
}
function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function hashFile(p) {
  const h = crypto.createHash('sha256'), fd = fs.openSync(p, 'r'), b = Buffer.alloc(65536);
  try { let n; while ((n = fs.readSync(fd, b, 0, b.length, null))) h.update(b.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
}
function ordinary(p, directory = false) {
  const s = fs.lstatSync(p);
  if (s.isSymbolicLink() || (directory ? !s.isDirectory() : !s.isFile())) fail('LOCAL_PATH_REVIEW');
  return s;
}
function segment(v) {
  if (typeof v !== 'string' || !v || v === '.' || v === '..' || /[\/\\\x00-\x1f\x7f]/.test(v)) fail('REMOTE_NAME_REVIEW');
  return encodeURIComponent(v);
}
function objectRoute(bucket, name) {
  return '/object/authenticated/' + segment(bucket) + '/' + name.split('/').map(segment).join('/');
}
function keyHeaders(key) {
  if (typeof key !== 'string' || key.length > 4096 || /[\s\x00-\x1f]/.test(key)) fail('PRIVILEGED_KEY_REQUIRED');
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key)) return { apikey: key };
  const parts = key.split('.');
  if (parts.length !== 3 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) fail('PRIVILEGED_KEY_REQUIRED');
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { fail('PRIVILEGED_KEY_REQUIRED'); }
  // Syntax/scope check only: Supabase authenticates the signature and authority.
  if (claims.role !== 'service_role' || claims.ref !== PROJECT) fail('PRIVILEGED_KEY_REQUIRED');
  return { apikey: key, Authorization: 'Bearer ' + key };
}
function client(key, fetcher = fetch, limits = LIMITS) {
  const headers = keyHeaders(key), deadline = Date.now() + limits.runMs;
  let calls = 0;
  return async function request(route, body) {
    if (++calls > limits.requests || Date.now() >= deadline) fail('PASS_LIMIT_REACHED');
    // Routes are generated here; credentials cannot follow redirects or leave this origin.
    const url = new URL('/storage/v1' + route, ORIGIN);
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/storage/v1/')) fail('ENDPOINT_REVIEW');
    const method = body === undefined ? 'GET' : 'POST';
    if (method === 'POST' && !url.pathname.startsWith('/storage/v1/object/list/')) fail('ENDPOINT_REVIEW');
    let response;
    try {
      response = await fetcher(url, { method, headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
        signal: AbortSignal.timeout(Math.max(1, Math.min(limits.requestMs, deadline - Date.now()))) });
    } catch { fail('NETWORK_OR_TIMEOUT'); }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {});
      fail(response.status === 401 || response.status === 403 ? 'ACCESS_DENIED' : response.status >= 300 && response.status < 400 ? 'REDIRECT_REFUSED' : 'HTTP_READ_FAILED');
    }
    return response;
  };
}
async function boundedJson(response, max) {
  const chunks = []; let size = 0;
  try {
    for await (const chunk of response.body) { size += chunk.length; if (size > max) fail('METADATA_LIMIT_REACHED'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) { if (e.code) throw e; fail('METADATA_READ_FAILED'); }
}
async function inventory(request, limits = LIMITS) {
  const buckets = [], objects = [], seenBuckets = new Set(); let entries = 0;
  for (let offset = 0; ; offset += limits.page) {
    const page = await boundedJson(await request(`/bucket?limit=${limits.page}&offset=${offset}&sortColumn=id&sortOrder=asc`), limits.jsonBytes);
    if (!Array.isArray(page) || page.length > limits.page) fail('METADATA_SHAPE_REVIEW');
    for (const b of page) {
      segment(b?.id);
      if (seenBuckets.has(b.id) || buckets.length >= limits.buckets) fail('PAGINATION_OR_SCOPE_REVIEW');
      seenBuckets.add(b.id); buckets.push(b);
    }
    if (page.length < limits.page) break;
  }
  for (const b of buckets) {
    if (b.type !== undefined && b.type !== 'STANDARD') fail('NONSTANDARD_BUCKET_REVIEW');
    const queue = [''], seen = new Set();
    for (let q = 0; q < queue.length; q++) {
      const prefix = queue[q];
      for (let offset = 0; ; offset += limits.page) {
        const page = await boundedJson(await request('/object/list/' + segment(b.id),
          { prefix, limit: limits.page, offset, sortBy: { column: 'name', order: 'asc' } }), limits.jsonBytes);
        if (!Array.isArray(page) || page.length > limits.page) fail('METADATA_SHAPE_REVIEW');
        for (const o of page) {
          segment(o?.name);
          const name = prefix ? prefix + '/' + o.name : o.name;
          if (++entries > limits.entries || name.split('/').length > 100 || seen.has(name)) fail('PAGINATION_OR_SCOPE_REVIEW');
          seen.add(name);
          if (o.id === null && o.metadata === null) { queue.push(name); continue; }
          if (typeof o.id !== 'string' || !o.id || !o.metadata || !Number.isSafeInteger(o.metadata.size) || o.metadata.size < 0) fail('OBJECT_METADATA_REVIEW');
          // Downloads may change last_accessed_at; it is not a content-change signal.
          const { last_accessed_at, ...stable } = o;
          objects.push({ ...stable, bucket_id: b.id, name });
        }
        if (page.length < limits.page) break;
      }
    }
  }
  buckets.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  objects.sort((a,b) => (a.bucket_id + '/' + a.name).localeCompare(b.bucket_id + '/' + b.name, 'en'));
  return { buckets, objects };
}
async function download(response, destination, expected, limit) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) !== expected)) { await response.body?.cancel(); fail('DOWNLOAD_SIZE_MISMATCH'); }
  const fd = fs.openSync(destination, 'wx', 0o600), hash = crypto.createHash('sha256'); let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > expected || bytes > limit) fail('DOWNLOAD_SIZE_MISMATCH');
      hash.update(chunk);
      let offset = 0; while (offset < chunk.length) offset += fs.writeSync(fd, chunk, offset, chunk.length - offset);
    }
  } catch (e) { if (e.code) throw e; fail('DOWNLOAD_READ_FAILED'); }
  finally { fs.closeSync(fd); }
  if (bytes !== expected) fail('DOWNLOAD_SIZE_MISMATCH');
  const sha256 = hash.digest('hex');
  if (hashFile(destination) !== sha256) fail('LOCAL_HASH_MISMATCH');
  return { bytes, sha256 };
}
function writeJson(p,v) { fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', { flag:'wx', mode:0o600 }); }
function packageFiles(run, sevenZip, runner = spawnSync) {
  ordinary(sevenZip);
  const payload = path.join(run, 'payload'), partial = path.join(run, 'storage-component.partial.7z');
  const extracted = path.join(run, 'verified-files'), final = path.join(run, 'storage-component.7z');
  const names = fs.readdirSync(payload).sort(), records = names.map(name => {
    const file = path.join(payload,name); return { name, bytes: ordinary(file).size, sha256:hashFile(file) };
  });
  function native(args, capture = false) {
    const r = runner(sevenZip, args, { cwd:run, shell:false, stdio: capture ? ['ignore','pipe','pipe'] : 'inherit',
      timeout:15*60000, maxBuffer:1024*1024, encoding:'utf8' });
    if (r.error || r.signal) fail('ARCHIVE_TOOL_FAILED'); return r;
  }
  console.log('1.2 — Enter your privately saved, nonblank backup passphrase at the native 7-Zip prompts.');
  if (native(['a','-t7z','-mhe=on','-p',partial,'payload']).status !== 0) fail('ARCHIVE_CREATE_FAILED');
  const negative = native(['l','-slt','-p'+crypto.randomBytes(32).toString('hex'),partial],true);
  if (negative.status !== 2 || records.some(r => String(negative.stdout || '').includes(r.name))) fail('ENCRYPTED_HEADER_CHECK_FAILED');
  fs.mkdirSync(extracted);
  if (native(['x','-o'+extracted,partial]).status !== 0) fail('ARCHIVE_EXTRACT_FAILED');
  if (fs.readdirSync(extracted).length !== 1) fail('EXTRACTED_SCOPE_MISMATCH');
  ordinary(path.join(extracted,'payload'),true);
  if (!same(fs.readdirSync(path.join(extracted,'payload')).sort(),names)) fail('EXTRACTED_SCOPE_MISMATCH');
  for (const r of records) {
    const source = path.join(payload,r.name), copy = path.join(extracted,'payload',r.name);
    if (ordinary(source).size !== r.bytes || ordinary(copy).size !== r.bytes || hashFile(source) !== r.sha256 || hashFile(copy) !== r.sha256) fail('EXTRACTED_HASH_MISMATCH');
  }
  fs.renameSync(partial,final);
  return { file:final,bytes:ordinary(final).size,sha256:hashFile(final),source_files:records };
}
async function runPass(root, key, sevenZip, options = {}) {
  root = path.resolve(root); ordinary(root,true);
  const run = path.join(root,'StorageComponent-'+crypto.randomUUID()); fs.mkdirSync(run);
  const payload = path.join(run,'payload'); fs.mkdirSync(payload);
  const limits = { ...LIMITS, ...options.limits }, records = [], problems = [];
  let before = null, after = null, archive = null;
  const summary = { stage_step:'1.2', work_item:'1.2.2', project:PROJECT,
    result:'STORAGE_COMPONENT_REVIEW', run_directory:run, bucket_count:0, object_count:0,
    downloaded_objects:0, downloaded_bytes:0, failed_objects:0, inventory_before_and_after_complete:false,
    expected_baseline_buckets_present:false, before_after_inventory_equal:false,
    all_downloaded_sizes_and_local_hashes_match:false, encrypted_package_and_extracted_hashes_verified:false,
    snapshot_is_atomic:false, historical_versions_and_deleted_objects_covered:false,
    database_and_storage_same_point_in_time:false, offsite_copy_verified:false,
    complete_platform_backup_verified:false, isolated_restore_verified:false, problem_codes:[] };
  try {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') fail('TLS_CONFIGURATION_REVIEW');
    const request = client(key,options.fetcher,limits);
    before = await inventory(request,limits); writeJson(path.join(payload,'inventory-before.json'),before);
    summary.bucket_count = before.buckets.length; summary.object_count = before.objects.length;
    summary.expected_baseline_buckets_present = EXPECTED.every(id => before.buckets.some(b => b.id === id));
    if (!summary.expected_baseline_buckets_present) problems.push('BASELINE_BUCKET_SCOPE_CHANGED');
    const total = before.objects.reduce((n,o) => n + o.metadata.size,0);
    if (!Number.isSafeInteger(total) || total > limits.totalBytes || before.objects.some(o => o.metadata.size > limits.fileBytes)) fail('DOWNLOAD_CAPACITY_LIMIT');
    if (fs.statfsSync(root).bavail * fs.statfsSync(root).bsize < total * 4 + 128*1024*1024) fail('LOCAL_CAPACITY_REVIEW');
    for (let i=0;i<before.objects.length;i++) {
      const o = before.objects[i], name = `object-${String(i+1).padStart(6,'0')}.bin`, part = path.join(payload,name+'.partial');
      try {
        const r = await download(await request(objectRoute(o.bucket_id,o.name)),part,o.metadata.size,limits.fileBytes);
        fs.renameSync(part,path.join(payload,name)); records.push({ bucket_id:o.bucket_id,name:o.name,local_name:name,...r });
        summary.downloaded_objects++; summary.downloaded_bytes += r.bytes;
      } catch(e) { summary.failed_objects++; problems.push(safeCode(e)); }
    }
    after = await inventory(request,limits); writeJson(path.join(payload,'inventory-after.json'),after);
    summary.inventory_before_and_after_complete = true;
    summary.before_after_inventory_equal = same(before,after);
    if (!summary.before_after_inventory_equal) problems.push('SOURCE_INVENTORY_CHANGED');
    summary.all_downloaded_sizes_and_local_hashes_match = summary.failed_objects === 0 && records.length === before.objects.length;
  } catch(e) { problems.push(safeCode(e)); }
  key = undefined;
  summary.problem_codes = [...new Set(problems)].sort();
  writeJson(path.join(payload,'manifest.json'), { download_phase_summary:summary, downloaded_files:records });
  try {
    if (!before) fail('ARCHIVE_NOT_ATTEMPTED_NO_COMPLETE_INVENTORY');
    for (const r of records) if (ordinary(path.join(payload,r.local_name)).size !== r.bytes || hashFile(path.join(payload,r.local_name)) !== r.sha256) fail('LOCAL_HASH_MISMATCH');
    archive = (options.packager || packageFiles)(run,sevenZip);
    for (const r of records) {
      const packaged = archive.source_files.find(f => f.name === r.local_name);
      if (!packaged || packaged.bytes !== r.bytes || packaged.sha256 !== r.sha256 || hashFile(path.join(payload,r.local_name)) !== r.sha256) fail('LOCAL_HASH_MISMATCH');
    }
    summary.encrypted_package_and_extracted_hashes_verified = true;
  }
  catch(e) { summary.problem_codes = [...new Set([...summary.problem_codes,safeCode(e)])].sort(); }
  if (summary.inventory_before_and_after_complete && summary.expected_baseline_buckets_present && summary.before_after_inventory_equal &&
      summary.all_downloaded_sizes_and_local_hashes_match && summary.encrypted_package_and_extracted_hashes_verified && !summary.problem_codes.length)
    summary.result = 'STORAGE_CURRENT_COMPONENT_LOCAL_PASS';
  summary.completed_utc = new Date().toISOString();
  writeJson(path.join(run,'verification.json'), { summary, archive, downloaded_files:records });
  return summary;
}
module.exports = { PROJECT, ORIGIN, LIMITS, keyHeaders, objectRoute, client, inventory, download, packageFiles, runPass };
if (require.main === module) {
  const key = process.env.MUSHAVO_STORAGE_BACKUP_KEY;
  delete process.env.MUSHAVO_STORAGE_BACKUP_KEY; // 7-Zip never inherits the API credential.
  runPass(process.argv[2],key,process.argv[3]).then(s => { console.log(JSON.stringify(s,null,2)); process.exitCode = s.result === 'STORAGE_CURRENT_COMPONENT_LOCAL_PASS' ? 0 : 2; })
    .catch(() => { console.log(JSON.stringify({stage_step:'1.2',work_item:'1.2.2',result:'STORAGE_PASS_BLOCKED',problem_codes:['PRIVATE_LOCAL_RUN_FAILED'],complete_platform_backup_verified:false})); process.exitCode = 2; });
}
