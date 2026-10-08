"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRoleExport, compareSnapshot, privateComponent } = require("../scripts/security-stage-1-role-coverage.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const source = {
  non_system_roles: [
    { role: "budget", superuser: false, inherit: true, create_role: false, create_database: false, login: false, replication: false, bypass_rls: false, connection_limit: -1, setting_count: 1 },
    { role: "member", superuser: false, inherit: false, create_role: false, create_database: false, login: true, replication: false, bypass_rls: false, connection_limit: 7, setting_count: 0 },
  ],
  memberships: [
    { granted_role: "budget", member: "member", grantor: "owner", admin_option: true, inherit_option: false, set_option: false },
    ...["pg_read_all_settings", "pg_read_all_stats", "pg_stat_scan_tables"].map(granted_role => ({ granted_role, member: "pg_monitor", grantor: "owner", admin_option: false, inherit_option: true, set_option: true })),
  ],
};
const golden = String.raw`-- Synthetic PostgreSQL 17 quoted-role export; public dummy values.
\restrict PUBLICDUMMY1
SET standard_conforming_strings = on;
CREATE ROLE "budget";
ALTER ROLE "budget" WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE "member";
ALTER ROLE "member" WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 7;
ALTER ROLE "budget" SET "custom.dummy" TO 'PUBLIC_SENTINEL; GRANT "other" TO "member" WITH INHERIT TRUE GRANTED BY "owner";';
GRANT "budget" TO "member" WITH ADMIN OPTION, INHERIT FALSE, SET FALSE GRANTED BY "owner";
GRANT SET ON PARAMETER "log_statement" TO "member";
\unrestrict PUBLICDUMMY1
`;

test("three builtin-to-builtin omissions explain the difference while exact flags/attributes match", () => {
  const result = compareSnapshot(golden, source);
  assert.equal(result.source_membership_records, 4);
  assert.equal(result.builtin_to_builtin_memberships_excluded_by_pg_dumpall, 3);
  assert.equal(result.parsed_exported_memberships, 1);
  assert.equal(result.exported_grantor_admin_inherit_set_match_s1e44, true);
  assert.equal(result.role_names_and_selected_attributes_match_s1e44, true);
  assert.equal(result.role_wide_setting_counts_match_s1e44, true);
  assert.equal(result.parameter_acl_semantics_verified, false);
  assert.equal(result.omitted_builtin_memberships_recovered, false);
  assert.equal(result.live_source_or_isolated_restore_verified, false);
  assert.equal(JSON.stringify(result).includes("PUBLIC_SENTINEL"), false);
});

test("same statement counts detect grantor, ADMIN, INHERIT and SET changes", () => {
  for (const [before, after] of [
    ['GRANTED BY "owner"', 'GRANTED BY "other_owner"'],
    ['ADMIN OPTION, INHERIT FALSE', 'INHERIT FALSE'],
    ['ADMIN OPTION, INHERIT FALSE', 'ADMIN OPTION, INHERIT TRUE'],
    ['SET FALSE GRANTED', 'SET TRUE GRANTED'],
  ]) {
    const result = compareSnapshot(golden.replaceAll(before, after), source);
    assert.equal(result.parsed_exported_memberships, 1);
    assert.equal(result.exported_grantor_admin_inherit_set_match_s1e44, false);
  }
});

test("same role counts detect changed attributes and connection limits", () => {
  for (const [before, after] of [['NOBYPASSRLS', 'BYPASSRLS'], ['CONNECTION LIMIT 7', 'CONNECTION LIMIT 8'], ['NOLOGIN NOREPLICATION', 'LOGIN NOREPLICATION']]) {
    const result = compareSnapshot(golden.replace(before, after), source);
    assert.equal(result.inventoried_role_definitions, 2);
    assert.equal(result.role_names_and_selected_attributes_match_s1e44, false);
  }
});

test("duplicate and missing grants fail exact equality despite valid statement syntax", () => {
  const grant = 'GRANT "budget" TO "member" WITH ADMIN OPTION, INHERIT FALSE, SET FALSE GRANTED BY "owner";';
  assert.equal(compareSnapshot(golden + grant, source).exported_grantor_admin_inherit_set_match_s1e44, false);
  assert.equal(compareSnapshot(golden.replace(grant, ''), source).exported_grantor_admin_inherit_set_match_s1e44, false);
});

test("literal/comment SQL lookalikes and escaped identifiers never become extra grants", () => {
  const sql = String.raw`/* nested /* GRANT */ comment */
COMMENT ON ROLE "budget" IS E'PUBLIC_DUMMY\'; GRANT "fake" TO "fake";';
ALTER ROLE "budget" SET "custom.dummy" TO $tag$GRANT "fake" TO "fake";$tag$;
GRANT "odd""role" TO "member" WITH INHERIT FALSE GRANTED BY "owner";`;
  const result = parseRoleExport(sql);
  assert.equal(result.memberships.length, 1);
  assert.equal(result.memberships[0].granted_role, 'odd"role');
  assert.equal(result.memberships[0].admin_option, false);
  assert.equal(result.memberships[0].set_option, true);
  assert.equal(result.memberships[0].inherit_option, false);
});

test("unsupported grant shape, missing grantor/options and contradictory options require review", () => {
  for (const sql of [
    'GRANT "budget" TO "member" GRANTED BY "owner";',
    'GRANT "budget" TO "member" WITH INHERIT TRUE;',
    'GRANT "budget" TO "member" WITH INHERIT TRUE, INHERIT FALSE GRANTED BY "owner";',
    'GRANT "budget", "other" TO "member" WITH INHERIT TRUE GRANTED BY "owner";',
    'GRANT "budget" TO "member" WITH INHERIT TRUE, GRANTED BY "owner";',
  ]) assert.throws(() => parseRoleExport(sql));
});

test("password clauses, unknown statements and incomplete SQL are never executed or accepted", () => {
  assert.throws(() => parseRoleExport(golden.replace('NOBYPASSRLS;', "NOBYPASSRLS PASSWORD 'PUBLIC_DUMMY';")), /UNSUPPORTED_ROLE_ATTRIBUTE_OR_PASSWORD/);
  assert.throws(() => parseRoleExport('SELECT 1;'), /UNSUPPORTED_SQL_STATEMENT/);
  assert.throws(() => parseRoleExport('CREATE ROLE "budget"'), /INCOMPLETE_SQL_STATEMENT/);
  assert.throws(() => parseRoleExport("ALTER ROLE \"budget\" SET \"dummy\" TO 'unfinished;"), /UNTERMINATED_LITERAL/);
  assert.throws(() => parseRoleExport('\\i dangerous.sql\n'), /UNSUPPORTED_PSQL_DIRECTIVE/);
});

test("setting values can change without claiming recovery equality; scoped settings remain separate", () => {
  const sql = golden.replace('PUBLIC_SENTINEL', 'OTHER_PUBLIC_DUMMY') + '\nALTER ROLE "budget" IN DATABASE "postgres" SET "custom.dummy" TO \'value\';';
  const result = compareSnapshot(sql, source);
  assert.equal(result.role_wide_setting_counts_match_s1e44, true);
  assert.equal(result.database_scoped_setting_statements_in_role_file, 1);
  assert.equal(result.settings_values_and_database_scope_recovery_verified, false);
});

function syntheticPrivateFiles(t, sql = golden) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mushavo-role-fixture-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = "20261008T042143Z-48bbd715d1b24cec870ee95e8113edb2";
  const pack = run + ".roles-component-47e6cd53c0884338b318426926349d77";
  const roleName = run + ".roles.sql"; const manifestName = run + ".roles.manifest.json";
  const role = path.join(root, roleName); const manifest = path.join(root, manifestName); const archive = path.join(root, pack + ".7z");
  const hash = b => crypto.createHash("sha256").update(b).digest("hex");
  const data = Buffer.from(sql + "\n--" + "x".repeat(6310 - Buffer.byteLength(sql) - 3));
  fs.writeFileSync(role, data);
  fs.writeFileSync(manifest, JSON.stringify({ summary: { stage_step: "1.2", result: "ROLE_EXPORT_NATIVE_COMPLETION_AND_MARKERS_PASS", project: "kttkospkblwvguuwnhjj", file: role, bytes: 6310, inventoried_role_definitions: 16, membership_grant_statements: 21, parameter_acl_statements: 1, role_password_export_disabled: true }, file_sha256: hash(data) }));
  // Dummy bytes and receipts test binding only; they are never called a real 7z or native export.
  const dummyArchive = Buffer.alloc(1919, 7); fs.writeFileSync(archive, dummyArchive);
  fs.writeFileSync(path.join(root, pack + ".verification.json"), JSON.stringify({ summary: { stage_step: "1.2", result: "ROLES_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS", project: "kttkospkblwvguuwnhjj", file: archive, bytes: 1919, packaged_files: 2, roles_match_private_manifest: true, wrong_password_cannot_list_source_filenames: true, both_extracted_hashes_match: true }, archive_sha256: hash(dummyArchive), source_files: [{ name: roleName, bytes: data.length, sha256: hash(data) }, { name: manifestName, bytes: fs.statSync(manifest).size, sha256: hash(fs.readFileSync(manifest)) }] }));
  return { root, role, archive };
}

test("private receipts reject same-size altered role/archive bytes without exposing hashes", t => {
  const f = syntheticPrivateFiles(t);
  assert.equal(privateComponent(f.root).role.bytes, 6310);
  const bytes = fs.readFileSync(f.archive); bytes[0] ^= 1; fs.writeFileSync(f.archive, bytes);
  assert.throws(() => privateComponent(f.root), /ENCRYPTED_RECEIPT_BINDING_REVIEW/);
  bytes[0] ^= 1; fs.writeFileSync(f.archive, bytes);
  const role = fs.readFileSync(f.role); role[0] ^= 1; fs.writeFileSync(f.role, role);
  assert.throws(() => privateComponent(f.root), /ROLE_MANIFEST_BINDING_REVIEW/);
});

test("CLI reviews unsupported private SQL without printing content, settings values or hashes", t => {
  const f = syntheticPrivateFiles(t, "SELECT 'PUBLIC_DUMMY_PRIVATE_VALUE';");
  const r = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/security-stage-1-role-coverage.cjs"), f.root], { encoding: "utf8" });
  assert.equal(r.status, 2);
  const result = JSON.parse(r.stdout);
  assert.equal(result.review_code, "UNSUPPORTED_SQL_STATEMENT");
  assert.equal(r.stdout.includes("PUBLIC_DUMMY_PRIVATE_VALUE"), false);
  assert.equal(r.stdout.includes("sha256"), false);
  assert.equal(r.stderr, "");
});
