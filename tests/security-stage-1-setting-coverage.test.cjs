"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { EXPECTED_KEYS, compareRoleSettingCoverage, databaseTocCoverage, privateDatabaseComponent } = require("../scripts/security-stage-1-setting-coverage.cjs");
const quote = x => '"' + x.replaceAll('"', '""') + '"';
function fixture(value = "PRIVATE-SETTING-SENTINEL") {
  return Object.entries(EXPECTED_KEYS).flatMap(([role, keys]) => keys.map(key => `ALTER ROLE ${quote(role)} SET ${quote(key)} TO '${value}';`)).join("\n") +
    '\nGRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";';
}

test("matches all 15 key identities and the one added parameter grant, with full proof false", () => {
  const r = compareRoleSettingCoverage(fixture());
  assert.equal(r.role_wide_setting_statement_count, 15);
  assert.equal(r.role_wide_setting_role_count, 9);
  assert.equal(r.role_wide_setting_key_names_match_s1e52, true);
  assert.equal(r.parameter_grant_delta_shape_matches_s1e52, true);
  assert.equal(r.settings_values_and_database_scope_recovery_verified, false);
  assert.equal(r.parameter_acl_bootstrap_owner_and_effective_semantics_verified, false);
  assert.ok(!JSON.stringify(r).includes("PRIVATE-SETTING-SENTINEL"));
});
test("changing values including SQL lookalikes does not turn key matching into value proof", () => {
  assert.deepEqual(compareRoleSettingCoverage(fixture("DIFFERENT-PRIVATE-VALUE")), compareRoleSettingCoverage(fixture()));
  assert.deepEqual(compareRoleSettingCoverage(fixture("GRANT ALTER SYSTEM; ALTER ROLE fake SET other TO bad;")), compareRoleSettingCoverage(fixture()));
  assert.deepEqual(compareRoleSettingCoverage(fixture().replace("'PRIVATE-SETTING-SENTINEL'", "'one', 'two'")), compareRoleSettingCoverage(fixture()));
});
test("same-count wrong key or role, duplicate key and extra scoped setting are detected", () => {
  for (const text of [fixture().replace('"statement_timeout"', '"other_key"'), fixture().replace('"anon"', '"other_role"'), fixture().replace('"lock_timeout"', '"statement_timeout"')]) {
    assert.equal(compareRoleSettingCoverage(text).role_wide_setting_key_names_match_s1e52, false);
  }
  assert.equal(compareRoleSettingCoverage(fixture() + '\nALTER ROLE "anon" IN DATABASE "postgres" SET "statement_timeout" TO \'private\';').database_scoped_setting_statements_in_roles_file, 1);
});
test("same-count privilege, target, parameter, grant option and session-grantor changes fail delta shape", () => {
  for (const text of [fixture().replace("GRANT SET", "GRANT ALTER SYSTEM"), fixture().replace('TO "supabase_realtime_admin";', 'TO "anon";'),
    fixture().replace('PARAMETER "log_min_messages"', 'PARAMETER "other_parameter"'), fixture().replace('TO "supabase_realtime_admin";', 'TO "supabase_realtime_admin" WITH GRANT OPTION;'),
    'SET SESSION AUTHORIZATION "other_grantor";\n' + fixture()]) assert.equal(compareRoleSettingCoverage(text).parameter_grant_delta_shape_matches_s1e52, false);
});
test("extra/revoked parameter grants fail; comments/literals cannot add grants", () => {
  assert.equal(compareRoleSettingCoverage(fixture() + '\nGRANT SET ON PARAMETER "other_parameter" TO "anon";').parameter_grant_delta_shape_matches_s1e52, false);
  assert.equal(compareRoleSettingCoverage(fixture().replace("GRANT SET", "REVOKE SET").replace('TO "supabase_realtime_admin";', 'FROM "supabase_realtime_admin";')).parameter_grant_delta_shape_matches_s1e52, false);
  assert.deepEqual(compareRoleSettingCoverage(fixture() + '\n/* GRANT ALTER SYSTEM ON PARAMETER fake TO PUBLIC; */'), compareRoleSettingCoverage(fixture()));
});
test("malformed setting tails and incomplete SQL cannot receive a match", () => {
  for (const text of [fixture().replace("TO 'PRIVATE-SETTING-SENTINEL'", "TO 'private',"), fixture().replace("TO 'PRIVATE-SETTING-SENTINEL'", "TO DEFAULT"), fixture().slice(0, -1)]) assert.throws(() => compareRoleSettingCoverage(text));
});
test("TOC checks exact intended database entries; properties presence is not key/value proof", () => {
  const toc = '; comments DATABASE PROPERTIES - postgres owner\n1; 1262 9 DATABASE - postgres owner\n2; 0 0 DATABASE PROPERTIES - postgres owner\n3; 0 0 DATABASE PROPERTIES - different owner\n4; 0 0 COMMENT - DATABASE postgres owner';
  const r = databaseTocCoverage(toc);
  assert.equal(r.intended_database_definition_toc_entries, 1);
  assert.equal(r.intended_database_properties_toc_entries, 1);
  assert.equal(r.intended_database_properties_entry_present, true);
  assert.equal(r.database_properties_contains_required_setting_verified, false);
  assert.equal(r.database_properties_values_or_recovered_behavior_verified, false);
  assert.equal(databaseTocCoverage(toc + '\n5; 0 0 DATABASE PROPERTIES - postgres owner').intended_database_properties_entry_present, false);
  assert.equal(databaseTocCoverage('1; 1262 9 DATABASE - postgres owner').intended_database_properties_entry_present, false);
});
test("private database receipt binding rejects altered same-size TOC and dump bytes", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mushavo-s53-dummy-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1";
  const packageRun = run + ".database-component-8135efd7cfce4f89b01da7296e864731";
  const digest = b => crypto.createHash("sha256").update(b).digest("hex");
  const dump = Buffer.alloc(2109566, 1); const toc = Buffer.from("1; 0 0 DATABASE PROPERTIES - postgres owner\n"); const manifest = Buffer.from(JSON.stringify({ sha256: digest(dump) }));
  const sources = [[run + ".database.dump", dump], [run + ".toc.txt", toc], [run + ".manifest.json", manifest]];
  for (const [name, bytes] of sources) fs.writeFileSync(path.join(root, name), bytes);
  // Synthetic byte buffers prove local receipt binding only, not 7z/PG archive validity.
  const archive = Buffer.alloc(566080, 2); const archiveFile = path.join(root, packageRun + ".7z"); fs.writeFileSync(archiveFile, archive);
  fs.writeFileSync(path.join(root, packageRun + ".verification.json"), JSON.stringify({
    summary: { stage_step: "1.2", project: "kttkospkblwvguuwnhjj", result: "DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS", file: archiveFile, bytes: 566080, packaged_files: 3, dump_matches_private_manifest: true, wrong_password_cannot_list_source_filenames: true, all_three_extracted_hashes_match: true },
    archive_sha256: digest(archive), source_files: sources.map(([name, b]) => ({ name, bytes: b.length, sha256: digest(b) })),
  }));
  assert.equal(privateDatabaseComponent(root).toc.bytes, toc.length);
  for (const [name, bytes] of sources.slice(0, 2)) {
    const changed = Buffer.from(bytes); changed[0] ^= 1; fs.writeFileSync(path.join(root, name), changed);
    assert.throws(() => privateDatabaseComponent(root), /DATABASE_PRIVATE_RECEIPT_BINDING_REVIEW/);
    fs.writeFileSync(path.join(root, name), bytes);
  }
});
test("CLI malformed private receipt prints no contents, value, hash or path", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mushavo-s53-private-SENTINEL-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = "20261008T042143Z-48bbd715d1b24cec870ee95e8113edb2";
  const packageRun = run + ".roles-component-47e6cd53c0884338b318426926349d77";
  for (const name of [run + ".roles.sql", run + ".roles.manifest.json", packageRun + ".7z", packageRun + ".verification.json"]) fs.writeFileSync(path.join(root, name), "PRIVATE-CONTENT-SENTINEL");
  const r = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/security-stage-1-setting-coverage.cjs"), root], { encoding: "utf8" });
  assert.equal(r.status, 2); assert.equal(r.stderr, "");
  assert.equal(JSON.parse(r.stdout).result, "PRIVATE_SETTING_COVERAGE_REVIEW");
  assert.ok(!r.stdout.includes("SENTINEL")); assert.ok(!r.stdout.includes(root));
});
