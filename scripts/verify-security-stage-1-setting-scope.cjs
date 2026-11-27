// Fresh disposable PostgreSQL fixtures only; no hosted credentials/connections.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sql = readFileSync(path.join(__dirname,
  '../supabase/diagnostics/security_stage_1_setting_scope.sql'), 'utf8');

(async () => {
  const db = new PGlite();
  try {
    const database = (await db.query('select current_database() as name')).rows[0].name;
    const quotedDatabase = '"' + database.replaceAll('"', '""') + '"';
    await db.exec(`
      create role fixture_parent;
      create role fixture_child;
      create role fixture_reader;
      create table fixture_write_guard(id integer);
      alter role fixture_parent set fixture.private_one = 'PRIVATE_ROLE_VALUE';
      alter role fixture_parent set fixture.private_two = 'PRIVATE_ROLE_VALUE=WITH_EQUALS';
      alter database ${quotedDatabase} set fixture.database_default = 'PRIVATE_DATABASE_VALUE';
      alter role fixture_child in database ${quotedDatabase} set fixture.combined = 'PRIVATE_COMBINED_VALUE';
      grant set on parameter log_statement to fixture_child with grant option;
      grant alter system on parameter log_statement to fixture_parent;
      grant set on parameter log_statement to public;
    `);
    const run = async () => (await db.exec(sql)).flatMap(x => x.rows || []).filter(x => x.check_name);
    const row = (rows, prefix) => rows.find(x => x.check_name.startsWith(prefix));
    const check = rows => {
      assert.equal(rows.length, 5);
      assert.equal(rows.filter(x => x.status === 'INFO').length, 4);
      assert.equal(row(rows, '05 ').status, 'REVIEW');
      assert.equal(row(rows, '01 ').details.transaction_read_only, 'on');
      assert.equal(row(rows, '01 ').details.transaction_isolation, 'repeatable read');
      assert.equal(row(rows, '01 ').details.current_database, database);
      assert.equal(row(rows, '05 ').details.backup_created_by_this_check, false);
      assert.equal(row(rows, '05 ').details.restore_verified_by_this_check, false);
      assert.equal(JSON.stringify(rows).includes('PRIVATE_'), false);
    };
    const first = await run(); check(first);
    const config = row(first, '02 ').details;
    const parent = config.records.find(x => x.role === 'fixture_parent' && x.scope === 'role_wide');
    assert.equal(parent.database, null);
    assert.equal(parent.setting_count, 2);
    assert.deepEqual(parent.setting_keys, ['fixture.private_one', 'fixture.private_two']);
    assert.equal(parent.role_wide_export_candidate, true);
    assert.equal(parent.database_scoped_requires_reconciliation, false);
    const databaseWide = config.records.find(x => x.database === database && x.scope === 'database_wide');
    assert.equal(databaseWide.role, null);
    assert.equal(databaseWide.role_wide_export_candidate, false);
    assert.equal(databaseWide.database_scoped_requires_reconciliation, true);
    const combined = config.records.find(x => x.role === 'fixture_child' && x.scope === 'role_in_database');
    assert.equal(combined.database, database);
    assert.deepEqual(combined.setting_keys, ['fixture.combined']);
    assert.equal(combined.role_wide_export_candidate, false);
    assert.equal(combined.database_scoped_requires_reconciliation, true);
    const acl = row(first, '03 ').details.parameters.find(x => x.parameter === 'log_statement');
    assert.equal(acl.acl_is_null, false);
    assert(acl.entries.some(x => x.grantee === 'fixture_child' && x.privilege === 'SET' && x.grant_option === true));
    assert(acl.entries.some(x => x.grantee === 'fixture_parent' && x.privilege === 'ALTER SYSTEM' && x.grant_option === false));
    assert(acl.entries.some(x => x.grantee === 'PUBLIC' && x.grantee_resolved === true && x.privilege === 'SET'));
    assert(acl.entries.every(x => x.grantor_resolved && x.grantee_resolved));
    const builtins = row(first, '04 ').details.memberships;
    assert(builtins.some(x => x.member === 'pg_monitor' && x.granted_role === 'pg_read_all_settings'));
    assert(builtins.every(x => x.member.startsWith('pg_') && x.granted_role.startsWith('pg_')));

    // Deliberately unusual catalog entries exercise missing/unknown metadata.
    // This setup mutates only the disposable fixture, never the owner SQL.
    await db.exec(`
      insert into pg_db_role_setting(setdatabase, setrole, setconfig)
        values (0, 0, array['fixture.all=PRIVATE_ALL_SCOPE_VALUE']);
      update pg_db_role_setting set setconfig = array[
        'fixture.private_one=PRIVATE_ROLE_VALUE',
        'fixture.private_two=PRIVATE_ROLE_VALUE=WITH_EQUALS',
        'NO_EQUALS_PRIVATE_VALUE', 'invalid key=PRIVATE_INVALID_KEY_VALUE', null]
        where setdatabase = 0 and setrole = 'fixture_parent'::regrole;
      update pg_parameter_acl set paracl = null where parname = 'log_statement';
    `);
    const second = await run(); check(second);
    const changed = row(second, '02 ').details;
    const global = changed.records.find(x => x.scope === 'all_roles_all_databases');
    assert.equal(global.role, null); assert.equal(global.database, null);
    assert.equal(global.role_wide_export_candidate, false);
    const invalid = changed.records.find(x => x.role === 'fixture_parent' && x.scope === 'role_wide');
    assert.equal(invalid.setting_count, 5);
    assert.equal(invalid.unrecognized_entries, 3);
    assert.equal(changed.incomplete_metadata_records, 1);
    assert.deepEqual(invalid.setting_keys, ['fixture.private_one', 'fixture.private_two']);
    const nullAcl = row(second, '03 ').details.parameters.find(x => x.parameter === 'log_statement');
    assert.equal(nullAcl.acl_is_null, true); assert.deepEqual(nullAcl.entries, []);
    assert.match(row(second, '03 ').details.scope, /not an empty\/effective-default privilege proof/);
    await assert.rejects(db.exec('begin transaction read only; insert into fixture_write_guard values(1);'), /read.only/i);
    await db.exec('rollback;');
    assert.equal((await db.query('select count(*) as n from fixture_write_guard')).rows[0].n, 0);

    // Empty inventories remain explicitly empty; catalog access errors do not.
    await db.exec('delete from pg_db_role_setting; delete from pg_parameter_acl;');
    const empty = await run(); check(empty);
    assert.equal(row(empty, '02 ').details.record_count, 0);
    assert.deepEqual(row(empty, '02 ').details.records, []);
    assert.deepEqual(row(empty, '02 ').details.records_by_scope, {});
    assert.equal(row(empty, '03 ').details.parameter_acl_records, 0);
    assert.deepEqual(row(empty, '03 ').details.parameters, []);
    await db.exec('revoke select on pg_parameter_acl from public; set role fixture_reader;');
    await assert.rejects(run(), /permission denied/i);
    await db.exec('rollback; reset role;');
    console.log('PASS: 4 INFO + 1 REVIEW; role/database/combined/all-scope classification, key-only privacy with equals/malformed/null entries, parameter PUBLIC/grant-option/ALTER SYSTEM metadata and null-ACL scope, builtin category, empty inventories, read-only write denial and unsuppressed catalog access failure. Disposable PostgreSQL only; hosted setting values/backup/restore not proved.');
  } finally { await db.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
