'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const PROJECT = 'kttkospkblwvguuwnhjj';
const IMAGES = {
  db: 'supabase/postgres:17.6.1.136',
  auth: 'supabase/gotrue:v2.197.0',
  storage: 'supabase/storage-api:v1.96.4',
};
const SCHEMAS = ['auth', 'storage', 'extensions', 'public', 'mushavo_account_deletion',
  'mushavo_email_auth', 'mushavo_file_ingest'];
const EXTENSIONS = ['pgcrypto', 'uuid-ossp', 'pg_stat_statements'];
const AUTH_DATA = ['users', 'identities', 'instances', 'schema_migrations'];
const TABLES = 'TABLE|SEQUENCE|TYPE|DOMAIN|VIEW|MATERIALIZED VIEW|FUNCTION|PROCEDURE|AGGREGATE';
const OBJECTS = 'TABLE DATA|MATERIALIZED VIEW DATA|FK CONSTRAINT|CHECK CONSTRAINT|CONSTRAINT|INDEX ATTACH|INDEX|SEQUENCE OWNED BY|SEQUENCE SET|TABLE ATTACH|DEFAULT ACL|DEFAULT|ACL|POLICY|ROW SECURITY|TRIGGER|RULE|STATISTICS|DOMAIN CONSTRAINT|' + TABLES;
const TOC_NAMESPACE = new RegExp('^(' + OBJECTS + ') (' + SCHEMAS.join('|') + ') (.+)$');

function requireCheck(ok, code) {
  if (!ok) throw new Error(code);
}

function selectRestoreEntries(toc) {
  const kept = [];
  for (const line of toc.split(/\r?\n/)) {
    const entry = line.match(/^\d+;\s+\d+\s+\d+\s+(.+)$/)?.[1];
    if (!entry) continue;
    const schema = entry.match(/^SCHEMA - (\S+) /)?.[1];
    const extension = entry.match(/^EXTENSION - (\S+)(?:\s|$)/)?.[1];
    if (schema && schema !== 'public' && SCHEMAS.includes(schema)) {
      kept.push(line);
      continue;
    }
    if (extension && EXTENSIONS.includes(extension)) {
      kept.push(line);
      continue;
    }
    const schemaGrant = entry.match(/^ACL - SCHEMA (\S+) /)?.[1];
    if (schemaGrant && SCHEMAS.includes(schemaGrant)) {
      kept.push(line);
      continue;
    }
    const match = entry.match(TOC_NAMESPACE);
    if (!match) continue;
    const [, kind, ns, object] = match;
    const objectName = object.split(' ')[0];
    if (kind === 'TABLE DATA' && ns === 'auth' && !AUTH_DATA.includes(objectName)) continue;
    if (kind === 'TABLE DATA' && ns === 'storage' && objectName.startsWith('s3_multipart_')) continue;
    kept.push(line);
  }
  for (const required of ['auth users', 'public budget_workspaces', 'public payment_records',
    'storage buckets', 'storage objects', 'mushavo_account_deletion requests']) {
    requireCheck(kept.some(line => line.includes(' TABLE DATA ' + required + ' ')), 'ARCHIVE_REQUIRED_TABLE_DATA_MISSING');
  }
  return kept.join('\n') + '\n';
}

function ordinary(file, directory = false) {
  const info = fs.lstatSync(file);
  requireCheck(!info.isSymbolicLink() && (directory ? info.isDirectory() : info.isFile()), 'LOCAL_PATH_SCOPE');
  return info;
}
function readJson(file) {
  requireCheck(ordinary(file).size <= 4 * 1024 * 1024, 'LOCAL_MANIFEST_SIZE');
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function pathKey(bucket, name) { return bucket + '\0' + name; }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function verifyStoragePayload(payload, expectedCount) {
  ordinary(payload, true);
  const before = readJson(path.join(payload, 'inventory-before.json'));
  const after = readJson(path.join(payload, 'inventory-after.json'));
  const manifest = readJson(path.join(payload, 'manifest.json'));
  const files = manifest.downloaded_files;
  requireCheck(JSON.stringify(canonical(before)) === JSON.stringify(canonical(after)) &&
    before.buckets.length === 4, 'STORAGE_BACKUP_INVENTORY_MISMATCH');
  requireCheck(Array.isArray(files) && files.length === expectedCount && before.objects.length === files.length, 'STORAGE_BACKUP_COUNT_MISMATCH');
  const objects = new Map(before.objects.map(row => [pathKey(row.bucket_id, row.name), row]));
  const names = new Set();
  const entries = files.map(file => {
    const row = objects.get(pathKey(file.bucket_id, file.name));
    requireCheck(row && !names.has(file.local_name) && /^object-\d{6}\.bin$/.test(file.local_name), 'STORAGE_MANIFEST_PATH_MISMATCH');
    names.add(file.local_name);
    objects.delete(pathKey(file.bucket_id, file.name));
    const src = path.join(payload, file.local_name);
    const stat = ordinary(src);
    requireCheck(stat.size === file.bytes && stat.size === row.metadata.size && stat.size <= 64 * 1024 * 1024, 'STORAGE_LOCAL_BYTE_COUNT');
    const bytes = fs.readFileSync(src);
    requireCheck(digest(bytes) === file.sha256, 'STORAGE_LOCAL_HASH_MISMATCH');
    return { bucket: file.bucket_id, name: file.name, localName: file.local_name, hash: file.sha256,
      size: file.bytes, mime: row.metadata.mimetype || 'application/octet-stream', id: row.id };
  });
  return { buckets: before.buckets.map(b => ({ id: b.id, public: b.public })), entries };
}

function makeJwt(role, secret) {
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const claims = Buffer.from(JSON.stringify({ role, iss: 'fr33-isolated-restore',
    exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const unsigned = header + '.' + claims;
  return unsigned + '.' + crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
}

// Runs inside the Storage container. Both fixed destinations are in the loopback-only namespace.
async function serviceChecks(settings) {
  const fs = require('node:fs');
  const crypto = require('node:crypto');
  const delay = require('node:timers/promises').setTimeout;
  function check(ok, code) { if (!ok) throw new Error(code); }
  async function request(port, route, init) {
    return fetch('http://127.0.0.1:' + port + route,
      { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
  }
  async function ready(port, route, code) {
    for (let i = 0; i < 40; i++) {
      try {
        const result = await request(port, route);
        if (result.ok) return;
      } catch {}
      await delay(1500);
    }
    throw new Error(code);
  }
  await ready(9999, '/health', 'ISOLATED_AUTH_NOT_READY');
  await ready(5000, '/status', 'ISOLATED_STORAGE_NOT_READY');
  const serviceHeaders = { Authorization: 'Bearer ' + settings.serviceJwt };
  const user = { email: 'restore-' + settings.id + '@example.invalid',
    password: settings.password, email_confirm: true };
  const adminResult = await request(9999, '/admin/users',
    { method: 'POST', headers: { ...serviceHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
  check(adminResult.ok, 'ISOLATED_AUTH_TEST_ACCOUNT_FAILED');
  const signIn = await request(9999, '/token?grant_type=password',
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password }) });
  check(signIn.ok, 'ISOLATED_AUTH_SIGNIN_FAILED');
  const session = await signIn.json();
  check(typeof session.access_token === 'string' && session.user?.email === user.email, 'ISOLATED_AUTH_SESSION_FAILED');
  let restored = 0;
  for (const entry of settings.entries) {
    const route = [entry.bucket, ...entry.name.split('/')].map(encodeURIComponent).join('/');
    const file = fs.readFileSync('/tmp/fr33-payload/' + entry.localName);
    const upload = await request(5000, '/object/' + route, {
      method: 'POST', headers: { ...serviceHeaders, 'Content-Type': entry.mime, 'x-upsert': 'true' }, body: file
    });
    check(upload.ok, 'ISOLATED_STORAGE_REUPLOAD_FAILED');
    const response = await request(5000, '/object/authenticated/' + route, { headers: serviceHeaders });
    check(response.ok, 'ISOLATED_STORAGE_READBACK_FAILED');
    const bytes = Buffer.from(await response.arrayBuffer());
    check(bytes.length === entry.size && crypto.createHash('sha256').update(bytes).digest('hex') === entry.hash,
      'ISOLATED_STORAGE_READBACK_HASH_MISMATCH');
    const denied = await request(5000, '/object/authenticated/' + route,
      { headers: { Authorization: 'Bearer ' + session.access_token } });
    const storageError = denied.status === 400 ? await denied.json().catch(() => ({})) : {};
    const statusCode = Number(storageError?.statusCode);
    check([403, 404].includes(denied.status) || (denied.status === 400 && [403, 404].includes(statusCode)),
      'ISOLATED_STORAGE_OUTSIDER_BOUNDARY_FAILED');
    restored++;
  }
  return { auth_sign_in: true, storage_objects_verified: restored, storage_outsider_denials: restored };
}

function locateSource(root, completed) {
  ordinary(root, true);
  const candidate = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('FR33-Production-'))
    .map(d => path.join(root, d.name)).filter(dir => {
      try {
        const receipt = readJson(path.join(dir, 'safe-summary.json'));
        return receipt.project === PROJECT && receipt.completed_utc === completed && receipt.exit_code === 0 &&
          receipt.result === 'ENCRYPTED_DATABASE_AND_STORAGE_BACKUPS_VERIFIED_LOCALLY' &&
          receipt.database_encrypted_extraction_verified === true && receipt.storage_encrypted_extraction_verified === true &&
          receipt.storage_inventory_stable === true && receipt.storage_objects === receipt.storage_objects_downloaded;
      } catch { return false; }
    });
  requireCheck(candidate.length === 1, 'VERIFIED_BACKUP_RECEIPT_NOT_FOUND');
  const dir = candidate[0];
  ordinary(dir, true);
  const db = path.join(dir, 'Database');
  ordinary(db, true);
  const storage = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('StorageComponent-'));
  requireCheck(storage.length === 1, 'STORAGE_BACKUP_FOLDER_SCOPE');
  const fileRoot = path.join(dir, storage[0].name);
  ordinary(fileRoot, true);
  const database = path.join(db, 'database-component.7z');
  const objects = path.join(fileRoot, 'storage-component.7z');
  ordinary(database);
  ordinary(objects);
  return { database, objects, count: readJson(path.join(dir, 'safe-summary.json')).storage_objects };
}

async function main([root, completed, docker, zip]) {
  const summary = {
    stage: 3, fr: '3.3', batch: 'isolated-production-restore', result: 'STOPPED_FOR_REVIEW',
    backup_receipt_utc: completed, failure_step: null, failure_code: null, database_restored: false,
    core_database_checks: false, storage_snapshot_matches_database: false, auth_sign_in: false,
    storage_objects_verified: 0, storage_outsider_denials: 0, local_test_resources_removed: false,
    full_platform_recovery_verified: false,
    isolated_live_service_restore_verified: false, exit_code: 2,
  };
  const runId = crypto.randomBytes(8).toString('hex');
  const names = [];
  let step = 'backup_receipt', run, log;
  function command(name, args, code, options = {}) {
    const result = spawnSync(name, args, { encoding: 'utf8', timeout: 240000, maxBuffer: 6 * 1024 * 1024, ...options });
    if (result.status !== 0) {
      if (log && result.stderr) fs.appendFileSync(log, code + '\n' + result.stderr + '\n');
      if (code === 'ISOLATED_SERVICE_CHECKS_FAILED' && /^ISOLATED_[A-Z_]+$/.test(result.stderr?.trim() || '')) {
        throw new Error(result.stderr.trim());
      }
      throw new Error(code);
    }
    return result.stdout;
  }
  function container(args, code, input) {
    return command(docker, ['--context', 'desktop-linux', ...args], code, { input });
  }
  function unwrap(name, folder) {
    fs.mkdirSync(folder);
    command(zip, ['x', '-o' + folder, name], 'ARCHIVE_EXTRACTION_FAILED', { stdio: 'inherit' });
  }
  function create(service, image, network, env, args = []) {
    const name = 'mushavo-fr33-' + runId + '-' + service;
    const containerId = container(['create', '--name', name, '--network', network, '--restart', 'no',
      '--label', 'mushavo.fr33.restore=' + runId,
      ...Object.entries(env).flatMap(([key, value]) => ['-e', key + '=' + value]), image, ...args], 'DOCKER_CREATE_' + service.toUpperCase()).trim();
    names.push(name);
    const info = JSON.parse(container(['inspect', name], 'DOCKER_ISOLATION_INSPECT'))[0].HostConfig;
    requireCheck(info.NetworkMode === network && !info.PublishAllPorts && !Object.keys(info.PortBindings || {}).length &&
      !info.Privileged && !info.Binds?.length, 'DOCKER_ISOLATION_CHECK_FAILED');
    container(['start', name], 'DOCKER_START_' + service.toUpperCase());
    requireCheck(/^[0-9a-f]{64}$/.test(containerId), 'DOCKER_CONTAINER_ID_UNEXPECTED');
    return containerId;
  }
  function dbExec(name, utility, options, code, input) {
    return container(['exec', '-i', name, utility, ...options], code, input);
  }
  function sql(name, database, input, code) {
    return dbExec(name, 'psql', ['-XAtq', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin',
      '-h', '/var/run/postgresql', '-d', database], code, input).trim();
  }
  try {
    const sources = locateSource(root, completed);
    run = fs.mkdtempSync(path.join(root, 'FR33-Restore-'));
    log = path.join(run, 'private-diagnostics.txt');
    step = 'docker_images';
    console.log('STARTED FR.3.3 isolated restore. Preparing the local Supabase images.');
    const context = container(['context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}'], 'DOCKER_CONTEXT_CHECK').trim();
    requireCheck(/^npipe:\/{2,4}\.\/pipe\/dockerDesktopLinuxEngine$/i.test(context), 'EXPECTED_LOCAL_DOCKER_ENGINE');
    for (const image of Object.values(IMAGES)) {
      const available = spawnSync(docker, ['--context', 'desktop-linux', 'image', 'inspect', image], { stdio: 'ignore', timeout: 30000 });
      if (available.status !== 0) {
        console.log('Downloading ' + image + '.');
        command(docker, ['--context', 'desktop-linux', 'pull', image], 'DOCKER_IMAGE_PULL',
          { timeout: 30 * 60 * 1000, stdio: 'inherit' });
      }
    }

    step = 'database_bootstrap';
    console.log('Starting and checking the isolated PostgreSQL container.');
    const password = crypto.randomBytes(32).toString('hex');
    const db = create('db', IMAGES.db, 'none',
      { POSTGRES_PASSWORD: password, POSTGRES_DB: 'postgres', PGPORT: '5432', POSTGRES_PORT: '5432',
        POSTGRES_HOST: '/var/run/postgresql', PGPASSWORD: password, JWT_EXP: '3600' },
      ['postgres', '-c', 'config_file=/etc/postgresql/postgresql.conf', '-c', 'listen_addresses=127.0.0.1',
        '-c', 'cron.launch_active_jobs=off', '-c', 'log_min_messages=fatal']);
    let ready = false;
    for (let i = 0; i < 90; i++) {
      const status = spawnSync(docker, ['--context', 'desktop-linux', 'exec', db, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'supabase_admin', '-d', 'postgres'],
        { encoding: 'utf8', timeout: 5000, stdio: 'ignore' });
      if (status.status === 0) { ready = true; break; }
      await delay(1500);
    }
    requireCheck(ready, 'ISOLATED_POSTGRES_NOT_READY');
    const pg = sql(db, 'postgres', "select current_setting('server_version_num'), rolsuper from pg_roles where rolname=current_user;", 'ISOLATED_SUPERUSER_PROBE');
    requireCheck(/^17\d{4}\|t$/.test(pg), 'ISOLATED_POSTGRES_VERSION_OR_ROLE');
    sql(db, 'postgres', [
      "DO $roles$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_privileged_role') THEN CREATE ROLE supabase_privileged_role NOLOGIN; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_etl_admin') THEN CREATE ROLE supabase_etl_admin NOLOGIN; END IF; END $roles$;",
      "ALTER ROLE supabase_auth_admin LOGIN PASSWORD '" + password + "';",
      "ALTER ROLE supabase_storage_admin LOGIN PASSWORD '" + password + "';",
      "CREATE DATABASE fr33_restore OWNER postgres TEMPLATE template0;",
    ].join('\n'), 'ISOLATED_DATABASE_CREATE');

    step = 'archive_extraction';
    const dbInput = path.join(run, 'db');
    const storageInput = path.join(run, 'storage');
    console.log('Enter the saved database archive passphrase at the local 7-Zip prompt.');
    unwrap(sources.database, dbInput);
    console.log('Enter the saved Storage archive passphrase at the local 7-Zip prompt.');
    unwrap(sources.objects, storageInput);
    const dump = path.join(dbInput, 'production.database.dump');
    ordinary(dump);
    const payload = path.join(storageInput, 'payload');
    const storage = verifyStoragePayload(payload, sources.count);

    step = 'database_restore';
    container(['cp', dump, db + ':/tmp/fr33-private.dump'], 'DATABASE_ARCHIVE_COPY');
    const toc = dbExec(db, 'pg_restore', ['--list', '/tmp/fr33-private.dump'], 'DATABASE_TOC_READ');
    const selection = path.join(run, 'restore-list.txt');
    fs.writeFileSync(selection, selectRestoreEntries(toc), { flag: 'wx' });
    container(['cp', selection, db + ':/tmp/fr33-restore-list.txt'], 'DATABASE_LIST_COPY');
    dbExec(db, 'pg_restore', ['--use-list=/tmp/fr33-restore-list.txt', '--exit-on-error', '--single-transaction',
      '--no-comments', '--no-security-labels', '-U', 'supabase_admin', '-h', '/var/run/postgresql',
      '-d', 'fr33_restore', '/tmp/fr33-private.dump'], 'DATABASE_RESTORE_FAILED');
    summary.database_restored = true;

    step = 'database_verification';
    const result = JSON.parse(sql(db, 'fr33_restore', [
      'SELECT json_build_object(',
      "  'auth_count', (SELECT count(*) FROM auth.users),",
      "  'workspace_count', (SELECT count(*) FROM public.budget_workspaces),",
      "  'payment_count', (SELECT count(*) FROM public.payment_records),",
      "  'request_table', to_regclass('mushavo_account_deletion.requests') IS NOT NULL,",
      "  'payment_rls', (SELECT relrowsecurity FROM pg_class WHERE oid='public.payment_records'::regclass),",
      "  'anonymous_submit_denied', NOT has_function_privilege('anon','public.fr33_submit_account_deletion(text)','execute'),",
      "  'buckets', (SELECT coalesce(json_agg(json_build_object('id', id, 'public', public) ORDER BY id),'[]') FROM storage.buckets),",
      "  'objects', (SELECT coalesce(json_agg(json_build_array(bucket_id,name,id,(metadata->>'size')::bigint) ORDER BY bucket_id,name),'[]') FROM storage.objects));",
    ].join('\n'), 'DATABASE_CORE_READBACK'));
    requireCheck(result.auth_count > 0 && result.workspace_count > 0 && result.payment_count > 0 &&
      result.request_table && result.payment_rls && result.anonymous_submit_denied, 'DATABASE_CORE_CHECK_MISMATCH');
    summary.core_database_checks = true;
    const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    const dbObjects = new Set(result.objects.map(row => JSON.stringify(row)));
    const bucketCheck = JSON.stringify(storage.buckets.sort((a, b) => order(a.id, b.id))) === JSON.stringify(result.buckets);
    requireCheck(bucketCheck && storage.buckets.every(bucket => bucket.public === false) && dbObjects.size === storage.entries.length &&
      storage.entries.every(e => dbObjects.has(JSON.stringify([e.bucket, e.name, e.id, e.size]))), 'BACKUP_STORAGE_DATABASE_METADATA_MISMATCH');
    summary.storage_snapshot_matches_database = true;

    step = 'auth_and_storage_services';
    const jwtSecret = crypto.randomBytes(48).toString('hex');
    const serviceJwt = makeJwt('service_role', jwtSecret);
    const anonJwt = makeJwt('anon', jwtSecret);
    const connection = role => 'postgresql://' + role + ':' + password + '@127.0.0.1:5432/fr33_restore?sslmode=disable';
    const network = 'container:' + db;
    create('auth', IMAGES.auth, network, {
      GOTRUE_API_HOST: '127.0.0.1', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: 'http://127.0.0.1:9999',
      GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: connection('supabase_auth_admin'),
      GOTRUE_SITE_URL: 'http://127.0.0.1:9999', GOTRUE_DISABLE_SIGNUP: 'true',
      GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_AUD: 'authenticated',
      GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true',
    });
    const storageName = create('storage', IMAGES.storage, network, {
      DATABASE_URL: connection('supabase_storage_admin'), AUTH_JWT_SECRET: jwtSecret,
      ANON_KEY: anonJwt, SERVICE_KEY: serviceJwt, STORAGE_PUBLIC_URL: 'http://127.0.0.1:5000',
      STORAGE_BACKEND: 'file', FILE_STORAGE_BACKEND_PATH: '/var/lib/storage',
      GLOBAL_S3_BUCKET: 'fr33-restore', TENANT_ID: 'fr33-restore', REGION: 'local',
      FILE_SIZE_LIMIT: '67108864', ENABLE_IMAGE_TRANSFORMATION: 'false',
    });
    container(['cp', payload, storageName + ':/tmp/fr33-payload'], 'STORAGE_RESTORE_BYTES_COPY');
    step = 'auth_and_storage_readback';
    const probe = 'const run = ' + serviceChecks.toString() +
      "; const fs = require('node:fs'); run(JSON.parse(fs.readFileSync(0,'utf8'))).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'ISOLATED_SERVICE_REQUEST_FAILED');process.exitCode=2;});";
    const serviceOutput = container(['exec', '-i', '-u', '0', storageName, 'node', '-e', probe],
      'ISOLATED_SERVICE_CHECKS_FAILED', JSON.stringify({ id: runId, password, serviceJwt, entries: storage.entries }));
    Object.assign(summary, JSON.parse(serviceOutput.trim()));
    requireCheck(summary.auth_sign_in && summary.storage_objects_verified === sources.count &&
      summary.storage_outsider_denials === sources.count, 'ISOLATED_SERVICE_CHECK_COUNT');
  } catch (error) {
    summary.failure_step = step;
    const message = String(error.message);
    summary.failure_code = /^[A-Z_]+$/.test(message) ? message
      : error instanceof ReferenceError ? 'LOCAL_RESTORE_REFERENCE_ERROR' : 'LOCAL_RESTORE_ERROR';
    if (log && summary.failure_code.startsWith('LOCAL_RESTORE_')) {
      try { fs.appendFileSync(log, String(error.stack || error) + '\n'); } catch {}
    }
  } finally {
    let clean = true;
    for (const name of names.reverse()) {
      try {
        container(['rm', '-f', '-v', name], 'ISOLATED_CONTAINER_REMOVE');
      } catch { clean = false; }
    }
    if (run) {
      try {
        if (summary.failure_step && fs.existsSync(log)) {
          fs.renameSync(log, path.join(root, 'FR33-Restore-Diagnostics-' + runId + '.txt'));
        }
        fs.rmSync(run, { recursive: true, force: true });
      } catch { clean = false; }
    }
    summary.local_test_resources_removed = clean;
    if (!clean && !summary.failure_step) {
      summary.failure_step = 'local_cleanup';
      summary.failure_code = 'ISOLATED_CLEANUP_REVIEW';
    }
    if (!summary.failure_step && clean) {
      summary.result = 'ISOLATED_LIVE_SERVICE_RESTORE_PASS';
      summary.isolated_live_service_restore_verified = true;
      summary.exit_code = 0;
    }
    summary.completed_utc = new Date().toISOString();
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.exit_code;
  }
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { selectRestoreEntries, verifyStoragePayload, serviceChecks, locateSource };
