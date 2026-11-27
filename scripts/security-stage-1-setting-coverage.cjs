"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const roleHelper = require("./security-stage-1-role-coverage.cjs");

// S1E52 key/ACL metadata only. No setting values or credentials are embedded.
const EXPECTED_KEYS = {
  anon: ["statement_timeout"],
  authenticated: ["statement_timeout"],
  authenticator: ["session_preload_libraries", "statement_timeout", "lock_timeout"],
  postgres: ["search_path"],
  supabase_admin: ["search_path", "log_statement"],
  supabase_auth_admin: ["search_path", "idle_in_transaction_session_timeout", "log_statement"],
  supabase_read_only_user: ["default_transaction_read_only"],
  supabase_realtime_admin: ["search_path"],
  supabase_storage_admin: ["search_path", "log_statement"],
};
const wordIs = (t, value) => t?.kind === "word" && t.value === value;
const idIs = (t, value) => t?.kind === "identifier" && t.value === value;

function compareRoleSettingCoverage(sql) {
  // Reuse the previously pinned lexer: literals are discarded, never evaluated.
  roleHelper.parseRoleExport(sql);
  const keys = []; const parameterStatements = [];
  let sessionAuthorizationStatements = 0; let databaseScopedSettings = 0;
  for (const t of roleHelper.statements(sql)) {
    if (wordIs(t[0], "SET") && wordIs(t[1], "SESSION") && wordIs(t[2], "AUTHORIZATION")) sessionAuthorizationStatements++;
    if (wordIs(t[0], "ALTER") && wordIs(t[1], "ROLE") && wordIs(t[3], "IN")) databaseScopedSettings++;
    if (wordIs(t[0], "ALTER") && wordIs(t[1], "ROLE") && wordIs(t[3], "SET")) {
      if (t[2]?.kind !== "identifier" || t[4]?.kind !== "identifier" || !wordIs(t[5], "TO") || t.length < 7 ||
          t.slice(6).some((x, i) => i % 2 === 0 ? x.kind !== "literal" : x.kind !== "punctuation" || x.value !== ",") ||
          (t.length - 6) % 2 !== 1) throw new Error("ROLE_SETTING_SHAPE_REVIEW");
      keys.push([t[2].value, t[4].value]);
    }
    if ((wordIs(t[0], "GRANT") || wordIs(t[0], "REVOKE")) && t.some((x, i) => wordIs(x, "ON") && wordIs(t[i + 1], "PARAMETER"))) parameterStatements.push(t);
  }
  const expected = Object.entries(EXPECTED_KEYS).flatMap(([role, list]) => list.map(key => [role, key]));
  const canonical = rows => rows.map(x => JSON.stringify(x)).sort();
  const keysMatch = JSON.stringify(canonical(keys)) === JSON.stringify(canonical(expected));
  const t = parameterStatements[0];
  // PostgreSQL dumps the delta from bootstrap-owner defaults. Match only this
  // observed delta shape; no bootstrap identity, effective ACL or target proof.
  const deltaMatch = parameterStatements.length === 1 && sessionAuthorizationStatements === 0 && t.length === 7 &&
    wordIs(t[0], "GRANT") && wordIs(t[1], "SET") && wordIs(t[2], "ON") && wordIs(t[3], "PARAMETER") &&
    idIs(t[4], "log_min_messages") && wordIs(t[5], "TO") && idIs(t[6], "supabase_realtime_admin");
  return {
    role_wide_setting_statement_count: keys.length,
    role_wide_setting_role_count: new Set(keys.map(x => x[0])).size,
    role_wide_setting_key_names_match_s1e52: keysMatch,
    database_scoped_setting_statements_in_roles_file: databaseScopedSettings,
    parameter_acl_statement_count: parameterStatements.length,
    parameter_grant_delta_shape_matches_s1e52: Boolean(deltaMatch),
    parameter_acl_bootstrap_owner_and_effective_semantics_verified: false,
    settings_values_and_database_scope_recovery_verified: false,
  };
}

function databaseTocCoverage(toc) {
  const bodies = toc.split(/\r?\n/).flatMap(line => {
    const m = line.match(/^\d+;\s+\d+\s+\d+\s+(.+)$/); return m ? [m[1]] : [];
  });
  const database = bodies.filter(x => /^DATABASE - postgres \S+$/.test(x)).length;
  const properties = bodies.filter(x => /^DATABASE PROPERTIES - postgres \S+$/.test(x)).length;
  return {
    intended_database_definition_toc_entries: database,
    intended_database_properties_toc_entries: properties,
    intended_database_properties_entry_present: properties === 1,
    database_properties_contains_required_setting_verified: false,
    database_properties_values_or_recovered_behavior_verified: false,
  };
}

function privateDatabaseComponent(root) {
  const run = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1";
  const packageRun = run + ".database-component-8135efd7cfce4f89b01da7296e864731";
  const read = name => {
    const file = path.join(root, name); const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 4_000_000) throw new Error("DATABASE_FILE_TYPE_OR_SIZE_REVIEW");
    const buffer = fs.readFileSync(file);
    return { name, file, bytes: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), buffer };
  };
  const dump = read(run + ".database.dump"); const toc = read(run + ".toc.txt"); const manifest = read(run + ".manifest.json");
  const archive = read(packageRun + ".7z"); const receipt = read(packageRun + ".verification.json");
  const parseJson = x => JSON.parse(x.buffer.toString("utf8").replace(/^\uFEFF/, ""));
  const record = parseJson(receipt); const m = parseJson(manifest); const s = record.summary;
  if (s?.stage_step !== "1.2" || s.project !== "kttkospkblwvguuwnhjj" ||
      s.result !== "DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS" ||
      path.resolve(s.file) !== path.resolve(archive.file) || s.bytes !== 566080 || archive.bytes !== 566080 ||
      s.packaged_files !== 3 || s.dump_matches_private_manifest !== true ||
      s.wrong_password_cannot_list_source_filenames !== true || s.all_three_extracted_hashes_match !== true ||
      !/^[a-f0-9]{64}$/i.test(record.archive_sha256 || "") || record.archive_sha256.toLowerCase() !== archive.sha256 ||
      !Array.isArray(record.source_files) || record.source_files.length !== 3 ||
      [dump, toc, manifest].some(x => record.source_files.filter(v => v.name === x.name && v.bytes === x.bytes && String(v.sha256).toLowerCase() === x.sha256).length !== 1) ||
      !/^[a-f0-9]{64}$/i.test(m.sha256 || "") || m.sha256.toLowerCase() !== dump.sha256 || dump.bytes !== 2109566) throw new Error("DATABASE_PRIVATE_RECEIPT_BINDING_REVIEW");
  return { dump, toc, manifest, archive, receipt };
}

function runLocal(root) {
  const roleRun = "20261008T042143Z-48bbd715d1b24cec870ee95e8113edb2";
  const roleControls = [roleRun + ".roles.manifest.json", roleRun + ".roles-component-47e6cd53c0884338b318426926349d77.verification.json"].map(name => {
    const file = path.join(root, name); const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 2_000_000) throw new Error("ROLE_CONTROL_FILE_TYPE_OR_SIZE_REVIEW");
    const buffer = fs.readFileSync(file);
    return { file, bytes: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
  });
  const role = roleHelper.privateComponent(root); const database = privateDatabaseComponent(root);
  const comparison = compareRoleSettingCoverage(role.sql); const coverage = databaseTocCoverage(database.toc.buffer.toString("utf8"));
  const passed = comparison.role_wide_setting_key_names_match_s1e52 && comparison.parameter_grant_delta_shape_matches_s1e52 &&
    comparison.database_scoped_setting_statements_in_roles_file === 0 && coverage.intended_database_definition_toc_entries === 1 &&
    coverage.intended_database_properties_entry_present;
  for (const file of [role.role, role.archive, ...roleControls, ...Object.values(database)]) {
    const stat = fs.lstatSync(file.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes ||
        crypto.createHash("sha256").update(fs.readFileSync(file.file)).digest("hex") !== file.sha256) throw new Error("PRIVATE_FILES_CHANGED_DURING_CHECK_REVIEW");
  }
  const summary = {
    stage_step: "1.2", result: passed ? "PRIVATE_SETTING_KEYS_PARAMETER_DELTA_AND_DATABASE_TOC_COVERAGE_PASS" : "PRIVATE_SETTING_COVERAGE_REVIEW",
    project: "kttkospkblwvguuwnhjj", checked_utc: new Date().toISOString(), source_metadata_checked_utc: "2026-10-08T05:28:30.392498+00:00",
    database_and_roles_originals_match_private_receipts: true, ...comparison, ...coverage,
    live_source_drift_or_destination_recovery_verified: false, complete_platform_backup_verified: false,
    isolated_database_restore_verified: false, raw_artifacts_uploaded: false,
  };
  fs.writeFileSync(path.join(root, "SettingCoverage-" + crypto.randomUUID() + ".verification.json"),
    JSON.stringify({ summary, database_archive_sha256: database.archive.sha256, database_toc_sha256: database.toc.sha256,
      roles_archive_sha256: role.archive.sha256, roles_file_sha256: role.role.sha256 }, null, 2) + "\n", { flag: "wx" });
  return summary;
}

module.exports = { EXPECTED_KEYS, compareRoleSettingCoverage, databaseTocCoverage, privateDatabaseComponent, runLocal };
if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("EXPECTED_PRIVATE_BACKUP_ROOT");
    const summary = runLocal(path.resolve(process.argv[2]));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.result === "PRIVATE_SETTING_COVERAGE_REVIEW" ? 2 : 0;
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.message || "") ? error.message : "PRIVATE_FILE_OR_FORMAT_REVIEW";
    console.log(JSON.stringify({ stage_step: "1.2", result: "PRIVATE_SETTING_COVERAGE_REVIEW", review_code: code,
      complete_platform_backup_verified: false, isolated_database_restore_verified: false, raw_artifacts_uploaded: false }, null, 2));
    process.exitCode = 2;
  }
}
