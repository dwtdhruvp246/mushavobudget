'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const hash = require('node:crypto').createHash;
const { selectRestoreEntries, verifyStoragePayload, serviceChecks, locateSource } = require('../scripts/fr33-isolated-restore.cjs');

const supported = [
  'SCHEMA - auth supabase_admin', 'SCHEMA - public pg_database_owner',
  'ACL - SCHEMA auth supabase_admin', 'EXTENSION - uuid-ossp',
  'TABLE DATA auth users supabase_auth_admin', 'TABLE DATA public budget_workspaces postgres',
  'TABLE DATA public payment_records postgres', 'ROW SECURITY public payment_records postgres',
  'TABLE DATA storage buckets supabase_storage_admin', 'TABLE DATA storage objects supabase_storage_admin',
  'TABLE DATA mushavo_account_deletion requests postgres',
];
const excluded = [
  'TABLE DATA auth sessions supabase_auth_admin', 'TABLE DATA auth refresh_tokens supabase_auth_admin',
  'TABLE DATA cron job postgres', 'EXTENSION - pg_cron', 'TABLE DATA vault secrets postgres',
  'TABLE DATA net http_request_queue postgres', 'SUBSCRIPTION - sample postgres',
  'EVENT TRIGGER - job postgres', 'FOREIGN TABLE public example postgres',
  'TABLE DATA storage s3_multipart_uploads supabase_storage_admin',
];
const toc = entries => entries.map((s, i) => i + '; 7413 123 ' + s).join('\r\n');
test('TOC includes application and protected table data but leaves out backup credentials and scheduled entries', () => {
  const list = selectRestoreEntries(toc([...supported, ...excluded]));
  for (const s of supported.filter(s => !s.startsWith('SCHEMA - public'))) assert.ok(list.includes(s));
  for (const s of excluded) assert.ok(!list.includes(s));
});
test('TOC refuses missing essential table data', () => {
  assert.throws(() => selectRestoreEntries(toc(supported.filter(s => !s.includes('TABLE DATA storage objects')))),
    /ARCHIVE_REQUIRED_TABLE_DATA_MISSING/);
});
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fr33-restore-fixture-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = Buffer.from('abc');
  const sha256 = hash('sha256').update(files).digest('hex');
  const buckets = ['a', 'b', 'c', 'd'].map(id => ({ id, public: false }));
  const object = { id: 'fixture', name: 'local/logo.png', bucket_id: 'a', metadata: { size: 3, mimetype: 'image/png' } };
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  write('inventory-before.json', { buckets, objects: [object] });
  write('inventory-after.json', { objects: [object], buckets });
  write('manifest.json', { downloaded_files: [{ bucket_id: 'a', name: object.name,
    local_name: 'object-000001.bin', sha256, bytes: 3 }] });
  fs.writeFileSync(path.join(dir, 'object-000001.bin'), files);
  return { dir, write };
}
test('recovered Storage bytes match the encrypted manifest despite JSON key ordering', t => {
  const { dir } = fixture(t);
  const result = verifyStoragePayload(dir, 1);
  assert.equal(result.buckets.length, 4);
  assert.equal(result.entries[0].name, 'local/logo.png');
  fs.writeFileSync(path.join(dir, 'object-000001.bin'), 'abd');
  assert.throws(() => verifyStoragePayload(dir, 1), /STORAGE_LOCAL_HASH_MISMATCH/);
});
test('restored payload refuses object path escapes and count mismatches', t => {
  const { dir, write } = fixture(t);
  assert.throws(() => verifyStoragePayload(dir, 2), /STORAGE_BACKUP_COUNT_MISMATCH/);
  write('manifest.json', { downloaded_files: [{ bucket_id: 'a', name: 'local/logo.png', local_name: '../file.bin' }] });
  assert.throws(() => verifyStoragePayload(dir, 1), /STORAGE_MANIFEST_PATH_MISMATCH/);
});
test('locates only a verified receipt for the selected production backup', t => {
  const { dir, write } = fixture(t);
  const src = path.join(dir, 'FR33-Production-Synthetic');
  fs.mkdirSync(path.join(src, 'Database'), { recursive: true });
  fs.mkdirSync(path.join(src, 'StorageComponent-fixture'));
  fs.copyFileSync(path.join(dir, 'object-000001.bin'), path.join(src, 'Database', 'database-component.7z'));
  fs.copyFileSync(path.join(dir, 'object-000001.bin'), path.join(src, 'StorageComponent-fixture', 'storage-component.7z'));
  const completed = '2026-11-23T13:34:08.6568199Z';
  write('FR33-Production-Synthetic/safe-summary.json', {
    project: 'kttkospkblwvguuwnhjj', completed_utc: completed, exit_code: 0,
    result: 'ENCRYPTED_DATABASE_AND_STORAGE_BACKUPS_VERIFIED_LOCALLY',
    database_encrypted_extraction_verified: true, storage_encrypted_extraction_verified: true,
    storage_inventory_stable: true, storage_objects: 1, storage_objects_downloaded: 1,
  });
  assert.equal(locateSource(dir, completed).count, 1);
  assert.throws(() => locateSource(dir, 'unrelated'), /VERIFIED_BACKUP_RECEIPT_NOT_FOUND/);
});
test('service checks use only fixed loopback endpoints, verify bytes, and require outsider denial', async t => {
  const bytes = Buffer.from('abc');
  const requests = [];
  const secret = { id: 'synthetic', password: 'synthetic', serviceJwt: 'fixture-service',
    entries: [{ bucket: 'a', name: 'private dir/file.png', localName: 'object-000001.bin', mime: 'image/png',
      size: 3, hash: hash('sha256').update(bytes).digest('hex') }] };
  let outsiderStatus = 404;
  const originalRead = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (name, ...args) => name === '/tmp/fr33-payload/object-000001.bin' ? bytes : originalRead(name, ...args));
  t.mock.method(global, 'fetch', async (url, options) => {
    const u = new URL(url);
    requests.push(u);
    assert.equal(u.hostname, '127.0.0.1');
    assert.equal(options.redirect, 'error');
    if (u.pathname === '/token') return Response.json({ access_token: 'fixture-outsider', user: { email: 'restore-synthetic@example.invalid' } });
    if (u.pathname.startsWith('/object/authenticated/')) {
      return options.headers.Authorization === 'Bearer fixture-outsider'
        ? new Response('abc', { status: outsiderStatus }) : new Response('abc');
    }
    return new Response('{}');
  });
  assert.deepEqual(await serviceChecks(secret), { auth_sign_in: true, storage_objects_verified: 1, storage_outsider_denials: 1 });
  assert.ok(requests.some(u => u.pathname.endsWith('/a/private%20dir/file.png')));
  outsiderStatus = 200;
  await assert.rejects(serviceChecks(secret), /ISOLATED_STORAGE_OUTSIDER_BOUNDARY_FAILED/);
});

function fakeTools() {
  const fs = require('node:fs');
  const path = require('node:path');
  const assert = require('node:assert/strict');
  const child = require('node:child_process');
  const fixture = process.env.FR33_RESTORE_FIXTURE;
  const audit = process.env.FR33_RESTORE_AUDIT;
  const mode = process.env.FR33_RESTORE_MODE;
  const report = value => fs.appendFileSync(audit, value + '\n');
  const containers = new Map();
  const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
  const realSpawn = child.spawnSync;

  child.spawnSync = (command, args, options) => {
    if (command === 'fixture-7zip') {
      report('extract');
      const output = args[1].slice(2);
      assert.equal(args[0], 'x');
      if (args[2].endsWith('database-component.7z')) {
        fs.writeFileSync(path.join(output, 'production.database.dump'), 'fixture');
      } else {
        fs.cpSync(fixture, path.join(output, 'payload'), { recursive: true });
      }
      return ok();
    }
    if (command !== 'fixture-docker') return realSpawn(command, args, options);
    assert.deepEqual(args.slice(0, 2), ['--context', 'desktop-linux']);
    const [action, first, second] = args.slice(2);
    if (action === 'context') return ok('npipe:////./pipe/dockerDesktopLinuxEngine\n');
    if (action === 'image') return ok();
    if (action === 'create') {
      const arg = flag => args[args.indexOf(flag) + 1];
      const name = arg('--name');
      const network = arg('--network');
      const service = name.split('-').at(-1);
      const id = ({ db: 'a', auth: 'b', storage: 'c' })[service].repeat(64);
      assert.match(name, /^mushavo-fr33-[a-f0-9]{16}-(db|auth|storage)$/);
      assert.equal(arg('--label'), 'mushavo.fr33.restore=' + name.split('-')[2]);
      assert.equal(network, service === 'db' ? 'none' : 'container:' + 'a'.repeat(64));
      assert.ok(!args.includes('--publish') && !args.includes('--privileged'));
      containers.set(name, { id, network, service });
      report('create ' + service);
      return ok(id + '\n');
    }
    if (action === 'inspect') {
      assert.ok(containers.has(first));
      const entry = containers.get(first);
      return ok(JSON.stringify([{ HostConfig: { NetworkMode: mode === 'bridge' ? 'bridge' : entry.network } }]));
    }
    if (action === 'start') {
      assert.ok(containers.has(first));
      report('start ' + containers.get(first).service);
      return ok();
    }
    if (action === 'cp') {
      assert.ok(fs.existsSync(first));
      return ok();
    }
    if (action === 'exec') {
      const utility = args.find(arg => ['pg_isready', 'psql', 'pg_restore', 'node'].includes(arg));
      if (utility === 'pg_isready') return ok();
      if (utility === 'psql') {
        if (options.input.includes('server_version_num')) return ok('170006|t\n');
        if (options.input.includes('CREATE DATABASE')) return ok();
        const buckets = ['a', 'b', 'c', 'd'].map(id => ({ id, public: false }));
        return ok(JSON.stringify({ auth_count: 1, workspace_count: 1, payment_count: 1,
          request_table: true, payment_rls: true, anonymous_submit_denied: true, buckets,
          objects: [['a', 'local/logo.png', 'fixture', 3]] }));
      }
      if (utility === 'pg_restore') {
        if (args.includes('--list')) return ok(process.env.FR33_RESTORE_TOC);
        assert.ok(args.includes('--single-transaction') && args.includes('--exit-on-error'));
        report('restore');
        return ok();
      }
      if (utility === 'node') {
        assert.equal(JSON.parse(options.input).entries.length, 1);
        report('service');
        return ok(JSON.stringify({ auth_sign_in: true, storage_objects_verified: 1, storage_outsider_denials: 1 }));
      }
    }
    if (action === 'rm') {
      assert.equal(first, '-f');
      assert.equal(second, '-v');
      const name = args.at(-1);
      assert.ok(containers.has(name));
      report('remove ' + containers.get(name).service);
      containers.delete(name);
      return ok();
    }
    throw new Error('unexpected fake Docker operation');
  };
}

function runWithFakeTools(t, mode) {
  const { dir } = fixture(t);
  const root = path.join(dir, 'private');
  const src = path.join(root, 'FR33-Production-fixture');
  fs.mkdirSync(path.join(src, 'Database'), { recursive: true });
  fs.mkdirSync(path.join(src, 'StorageComponent-fixture'));
  fs.writeFileSync(path.join(src, 'Database', 'database-component.7z'), 'fixture');
  fs.writeFileSync(path.join(src, 'StorageComponent-fixture', 'storage-component.7z'), 'fixture');
  const completed = '2026-11-23T13:34:08.6568199Z';
  fs.writeFileSync(path.join(src, 'safe-summary.json'), JSON.stringify({
    project: 'kttkospkblwvguuwnhjj', completed_utc: completed, exit_code: 0,
    result: 'ENCRYPTED_DATABASE_AND_STORAGE_BACKUPS_VERIFIED_LOCALLY',
    database_encrypted_extraction_verified: true, storage_encrypted_extraction_verified: true,
    storage_inventory_stable: true, storage_objects: 1, storage_objects_downloaded: 1,
  }));
  const preload = path.join(dir, 'docker-fixture.cjs');
  const audit = path.join(dir, 'audit.txt');
  const payload = path.join(dir, 'synthetic-payload');
  fs.mkdirSync(payload);
  for (const file of ['inventory-before.json', 'inventory-after.json', 'manifest.json', 'object-000001.bin']) {
    fs.copyFileSync(path.join(dir, file), path.join(payload, file));
  }
  fs.writeFileSync(preload, '(' + fakeTools.toString() + ')();\n');
  const { spawnSync } = require('node:child_process');
  const script = require.resolve('../scripts/fr33-isolated-restore.cjs');
  const result = spawnSync(process.execPath, ['--require', preload, script, root, completed, 'fixture-docker', 'fixture-7zip'], {
    encoding: 'utf8', timeout: 10000, env: { ...process.env, FR33_RESTORE_FIXTURE: payload,
      FR33_RESTORE_AUDIT: audit, FR33_RESTORE_MODE: mode, FR33_RESTORE_TOC: toc(supported) },
  });
  const summary = JSON.parse(result.stdout.slice(result.stdout.indexOf('{\n')));
  const operations = fs.existsSync(audit) ? fs.readFileSync(audit, 'utf8').trim().split('\n') : [];
  return { summary, status: result.status, operations };
}

test('complete runner bootstraps the isolated database, extracts archives, and cleans up all three containers', t => {
  const { summary, status, operations } = runWithFakeTools(t, 'safe');
  assert.equal(summary.failure_code, null);
  assert.equal(status, 0);
  assert.equal(summary.isolated_live_service_restore_verified, true);
  assert.deepEqual(operations, ['create db', 'start db', 'extract', 'extract', 'restore',
    'create auth', 'start auth', 'create storage', 'start storage', 'service',
    'remove storage', 'remove auth', 'remove db']);
});

test('unexpected Docker network stops before opening archives and removes the disposable container', t => {
  const { summary, status, operations } = runWithFakeTools(t, 'bridge');
  assert.equal(status, 2);
  assert.equal(summary.failure_code, 'DOCKER_ISOLATION_CHECK_FAILED');
  assert.equal(summary.local_test_resources_removed, true);
  assert.deepEqual(operations, ['create db', 'remove db']);
});

