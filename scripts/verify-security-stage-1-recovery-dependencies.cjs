// Disposable PostgreSQL metadata fixtures; no Supabase/network credentials.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sql = readFileSync(path.join(__dirname,
  '../supabase/diagnostics/security_stage_1_recovery_dependencies.sql'), 'utf8');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role fixture_parent nologin;
      create role fixture_child login;
      grant fixture_parent to fixture_child with inherit false, set true;
      alter role fixture_child set fixture.private_value = 'PRIVATE_ROLE_SETTING_SENTINEL';
      create schema fixture_scope authorization fixture_child;
      create table fixture_scope.sample(id integer);
      alter table fixture_scope.sample owner to fixture_child;
      create function fixture_scope.sample_fn() returns text language sql
        as $$select 'PRIVATE_FUNCTION_BODY_SENTINEL'::text$$;
      create publication fixture_publication for table fixture_scope.sample;
      create publication fixture_schema_publication for tables in schema fixture_scope;
    `);
    const run = async () => (await db.exec(sql))
      .flatMap(r => r.rows || []).filter(r => r.check_name);
    const row = (rows, prefix) => rows.find(r => r.check_name.startsWith(prefix));
    const check = rows => {
      assert.equal(rows.length, 7);
      assert.equal(rows.filter(r => r.status === 'INFO').length, 6);
      assert.equal(row(rows, '07 ').status, 'REVIEW');
      assert.equal(row(rows, '01 ').details.transaction_read_only, 'on');
      assert.equal(row(rows, '01 ').details.transaction_isolation, 'repeatable read');
      assert.equal(row(rows, '07 ').details.backup_created_by_this_check, false);
      assert.equal(row(rows, '07 ').details.restore_verified_by_this_check, false);
      assert(!JSON.stringify(rows).includes('PRIVATE_'));
    };
    const first = await run(); check(first);
    const roles = row(first, '02 ').details;
    const child = roles.non_system_roles.find(r => r.role === 'fixture_child');
    assert.equal(child.login, true);
    assert.equal(child.setting_count, 1);
    const membership = roles.memberships.find(m =>
      m.granted_role === 'fixture_parent' && m.member === 'fixture_child');
    assert.equal(membership.inherit_option, false);
    assert.equal(membership.set_option, true);
    const owners = row(first, '03 ').details;
    assert(owners.some(o => o.schema_name === 'fixture_scope' &&
      o.object_kind === 'r' && o.owner === 'fixture_child' && o.object_count === 1));
    const publications = row(first, '06 ').details;
    assert.equal(publications.publication_count, 2);
    const direct = publications.publications.find(p => p.publication === 'fixture_publication');
    const schema = publications.publications.find(p => p.publication === 'fixture_schema_publication');
    assert.equal(direct.direct_relation_mapping_count, 1);
    assert.equal(direct.schema_mapping_count, 0);
    assert.equal(schema.direct_relation_mapping_count, 0);
    assert.equal(schema.schema_mapping_count, 1);
    assert.equal(direct.expanded_table_count, 1);
    assert.equal(row(first, '05 ').details.foreign_tables, 0);
    assert.equal(row(first, '05 ').details.large_objects, 0);

    // Exercise actual catalog metadata and secret-option omission without
    // querying foreign rows or performing any network connection.
    await db.exec(`
      create foreign data wrapper fixture_fdw;
      create server fixture_server foreign data wrapper fixture_fdw
        options (private_token 'PRIVATE_FOREIGN_OPTION_SENTINEL');
      create user mapping for current_user server fixture_server
        options (private_password 'PRIVATE_MAPPING_PASSWORD_SENTINEL');
      create foreign table fixture_scope.remote_sample(id integer) server fixture_server;
      select lo_create(991122);
      create unlogged table fixture_scope.extension_config(id integer);
      alter extension plpgsql add table fixture_scope.extension_config;
      update pg_extension set extconfig = array['fixture_scope.extension_config'::regclass::oid],
        extcondition = array['PRIVATE_EXTENSION_FILTER_SENTINEL'] where extname = 'plpgsql';
      drop publication fixture_publication;
      drop publication fixture_schema_publication;
    `);
    const second = await run(); check(second);
    assert.equal(row(second, '05 ').details.foreign_tables, 1);
    assert.equal(row(second, '05 ').details.foreign_servers, 1);
    assert.equal(row(second, '05 ').details.user_mappings, 1);
    assert.equal(row(second, '05 ').details.large_objects, 1);
    assert.equal(row(second, '06 ').details.publication_count, 0);
    assert.deepEqual(row(second, '06 ').details.publications, []);
    const extension = row(second, '04 ').details.find(e => e.extension === 'plpgsql');
    assert(extension);
    assert.equal(extension.registered_config_table_count, 1);
    assert.equal(extension.registered_config_tables[0].schema, 'fixture_scope');
    assert.equal(extension.registered_config_tables[0].table, 'extension_config');
    assert.equal(extension.registered_config_tables[0].filter_present, true);
    assert.equal(extension.unlogged_relation_member_count, 1);
    const extensionTable = row(second, '05 ').details.extension_tables_in_non_system_schemas
      .find(t => t.table === 'extension_config');
    assert.equal(extensionTable.registered_config_table, true);
    assert.equal(extensionTable.persistence, 'u');
    assert.equal((await db.query('select count(*) as n from fixture_scope.sample')).rows[0].n, 0);
    await assert.rejects(db.exec(
      'begin transaction read only; insert into fixture_scope.sample values(1);'), /read.only/i);
    await db.exec('rollback;');
    console.log('PASS: 6 INFO + 1 REVIEW; read-only context, role membership flags/ownership, extension configuration/member/unlogged scope, direct/schema/expanded publication categories, zero/nonzero foreign and large-object scope, and omission of setting/body/foreign/mapping secrets. Disposable PostgreSQL only; hosted execution/export/restore not proved.');
  } finally { await db.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
