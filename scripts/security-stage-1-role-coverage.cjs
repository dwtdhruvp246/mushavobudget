"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// S1E44 public catalog metadata is appended below. No setting values/passwords.

function statements(sql) {
  const out = []; let row = []; let i = 0;
  const push = (kind, value) => row.push({ kind, value });
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i); i = end < 0 ? sql.length : end + 1; continue;
    }
    if (sql.startsWith("/*", i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error("UNTERMINATED_COMMENT");
      continue;
    }
    if (c === "\\") {
      const end = sql.indexOf("\n", i); const line = sql.slice(i, end < 0 ? sql.length : end).trim();
      if (row.length || !/^\\(?:un)?restrict [A-Za-z0-9]+$/.test(line)) throw new Error("UNSUPPORTED_PSQL_DIRECTIVE");
      i = end < 0 ? sql.length : end + 1; continue;
    }
    if (c === "'" || ((c === "E" || c === "e") && sql[i + 1] === "'")) {
      const escaped = c !== "'"; if (escaped) i++; i++;
      let closed = false;
      while (i < sql.length) {
        if (escaped && sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      if (!closed) throw new Error("UNTERMINATED_LITERAL");
      push("literal", null); continue;
    }
    if (c === '"') {
      i++; let value = ""; let closed = false;
      while (i < sql.length) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { value += '"'; i += 2; continue; }
          i++; closed = true; break;
        }
        value += sql[i++];
      }
      if (!closed) throw new Error("UNTERMINATED_IDENTIFIER");
      push("identifier", value); continue;
    }
    if (c === "$" && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i))) {
      const tag = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)[0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end < 0) throw new Error("UNTERMINATED_DOLLAR_LITERAL");
      i = end + tag.length; push("literal", null); continue;
    }
    if (c === ";") { if (row.length) out.push(row); row = []; i++; continue; }
    const word = sql.slice(i).match(/^[A-Za-z_][A-Za-z0-9_$]*/);
    if (word) { push("word", word[0].toUpperCase()); i += word[0].length; continue; }
    const number = sql.slice(i).match(/^-?\d+/);
    if (number) { push("number", Number(number[0])); i += number[0].length; continue; }
    if (",.=+-*()[]:".includes(c)) { push("punctuation", c); i++; continue; }
    throw new Error("UNSUPPORTED_SQL_TOKEN");
  }
  if (row.length) throw new Error("INCOMPLETE_SQL_STATEMENT");
  return out;
}

const FLAGS = {
  SUPERUSER: ["superuser", true], NOSUPERUSER: ["superuser", false],
  INHERIT: ["inherit", true], NOINHERIT: ["inherit", false],
  CREATEROLE: ["create_role", true], NOCREATEROLE: ["create_role", false],
  CREATEDB: ["create_database", true], NOCREATEDB: ["create_database", false],
  LOGIN: ["login", true], NOLOGIN: ["login", false],
  REPLICATION: ["replication", true], NOREPLICATION: ["replication", false],
  BYPASSRLS: ["bypass_rls", true], NOBYPASSRLS: ["bypass_rls", false],
};
const ATTRIBUTE_KEYS = ["superuser", "inherit", "create_role", "create_database", "login", "replication", "bypass_rls", "connection_limit"];
const wordIs = (t, word) => t?.kind === "word" && t.value === word;
function identifier(t) { if (t?.kind !== "identifier") throw new Error("EXPECTED_QUOTED_IDENTIFIER"); return t.value; }
function boolean(t) { if (wordIs(t, "TRUE")) return true; if (wordIs(t, "FALSE")) return false; throw new Error("EXPECTED_BOOLEAN"); }

function parseRoleExport(sql) {
  const created = []; const attributes = new Map(); const memberships = []; const settings = new Map();
  let parameterStatements = 0; let databaseSettingStatements = 0; let unexaminedMetadataStatements = 0;
  for (const t of statements(sql)) {
    if (wordIs(t[0], "SET")) { unexaminedMetadataStatements++; continue; }
    if (wordIs(t[0], "CREATE") && wordIs(t[1], "ROLE") && t.length === 3) { created.push(identifier(t[2])); continue; }
    if (wordIs(t[0], "ALTER") && wordIs(t[1], "ROLE")) {
      const role = identifier(t[2]);
      if (wordIs(t[3], "SET")) { settings.set(role, (settings.get(role) || 0) + 1); continue; }
      if (wordIs(t[3], "IN") && wordIs(t[4], "DATABASE") && t[5]?.kind === "identifier" && wordIs(t[6], "SET")) { databaseSettingStatements++; continue; }
      if (!wordIs(t[3], "WITH") || attributes.has(role)) throw new Error("UNSUPPORTED_OR_DUPLICATED_ROLE_ATTRIBUTES");
      const a = { role, connection_limit: -1 }; let limitSeen = false;
      for (let j = 4; j < t.length; j++) {
        const flag = t[j].kind === "word" ? FLAGS[t[j].value] : undefined;
        if (flag) { if (Object.hasOwn(a, flag[0])) throw new Error("DUPLICATED_ROLE_FLAG"); a[flag[0]] = flag[1]; }
        else if (wordIs(t[j], "CONNECTION") && wordIs(t[j + 1], "LIMIT") && t[j + 2]?.kind === "number" && !limitSeen) {
          a.connection_limit = t[j + 2].value; limitSeen = true; j += 2;
        } else if (wordIs(t[j], "VALID") && wordIs(t[j + 1], "UNTIL") && t[j + 2]?.kind === "literal") {
          unexaminedMetadataStatements++; j += 2;
        } else throw new Error("UNSUPPORTED_ROLE_ATTRIBUTE_OR_PASSWORD");
      }
      if (ATTRIBUTE_KEYS.some(k => !Object.hasOwn(a, k))) throw new Error("MISSING_ROLE_FLAG");
      attributes.set(role, a); continue;
    }
    if ((wordIs(t[0], "GRANT") || wordIs(t[0], "REVOKE")) && t.some((x, i) => wordIs(x, "ON") && wordIs(t[i + 1], "PARAMETER"))) { parameterStatements++; continue; }
    if (wordIs(t[0], "GRANT")) {
      const m = { granted_role: identifier(t[1]), member: identifier(t[3]), admin_option: false, set_option: true };
      if (!wordIs(t[2], "TO") || !wordIs(t[4], "WITH")) throw new Error("UNSUPPORTED_MEMBERSHIP_SHAPE");
      let j = 5; const options = new Set();
      while (j < t.length && !wordIs(t[j], "GRANTED")) {
        const option = t[j].value;
        if (t[j].kind !== "word" || options.has(option)) throw new Error("DUPLICATED_OR_INVALID_MEMBERSHIP_OPTION");
        options.add(option);
        if (option === "ADMIN" && wordIs(t[j + 1], "OPTION")) m.admin_option = true;
        else if (option === "INHERIT") m.inherit_option = boolean(t[j + 1]);
        else if (option === "SET") m.set_option = boolean(t[j + 1]);
        else throw new Error("UNSUPPORTED_MEMBERSHIP_OPTION");
        j += 2;
        if (t[j]?.kind === "punctuation" && t[j].value === ",") { j++; if (wordIs(t[j], "GRANTED")) throw new Error("TRAILING_MEMBERSHIP_COMMA"); }
        else if (!wordIs(t[j], "GRANTED")) throw new Error("MISSING_MEMBERSHIP_COMMA");
      }
      if (!Object.hasOwn(m, "inherit_option") || !wordIs(t[j], "GRANTED") || !wordIs(t[j + 1], "BY") || j + 3 !== t.length) throw new Error("INCOMPLETE_PG17_MEMBERSHIP_OPTIONS_OR_GRANTOR");
      m.grantor = identifier(t[j + 2]); memberships.push(m); continue;
    }
    if ((wordIs(t[0], "COMMENT") && wordIs(t[1], "ON") && wordIs(t[2], "ROLE")) || (wordIs(t[0], "SECURITY") && wordIs(t[1], "LABEL"))) { unexaminedMetadataStatements++; continue; }
    throw new Error("UNSUPPORTED_SQL_STATEMENT");
  }
  return { created, attributes, memberships, settings, parameterStatements, databaseSettingStatements, unexaminedMetadataStatements };
}

function compareSnapshot(sql, source) {
  const p = parseRoleExport(sql);
  const expected = source.memberships.filter(x => !(x.granted_role.startsWith("pg_") && x.member.startsWith("pg_")));
  const keys = ["granted_role", "member", "grantor", "admin_option", "inherit_option", "set_option"];
  const canonical = rows => rows.map(x => JSON.stringify(keys.map(k => x[k]))).sort();
  const roleNames = source.non_system_roles.map(x => x.role).sort();
  const namesMatch = JSON.stringify([...p.created].sort()) === JSON.stringify(roleNames) && p.attributes.size === roleNames.length;
  const attributesMatch = namesMatch && source.non_system_roles.every(x => ATTRIBUTE_KEYS.every(k => p.attributes.get(x.role)?.[k] === x[k]));
  const membershipsMatch = JSON.stringify(canonical(p.memberships)) === JSON.stringify(canonical(expected));
  const settingCountsMatch = source.non_system_roles.every(x => (p.settings.get(x.role) || 0) === x.setting_count) && [...p.settings.keys()].every(x => roleNames.includes(x));
  return {
    inventoried_role_definitions: p.created.length,
    role_names_and_selected_attributes_match_s1e44: attributesMatch,
    source_membership_records: source.memberships.length,
    builtin_to_builtin_memberships_excluded_by_pg_dumpall: source.memberships.length - expected.length,
    expected_exported_memberships: expected.length,
    parsed_exported_memberships: p.memberships.length,
    exported_grantor_admin_inherit_set_match_s1e44: membershipsMatch,
    role_wide_setting_statement_count: [...p.settings.values()].reduce((a, b) => a + b, 0),
    role_wide_setting_counts_match_s1e44: settingCountsMatch,
    database_scoped_setting_statements_in_role_file: p.databaseSettingStatements,
    parameter_acl_statements: p.parameterStatements,
    unexamined_metadata_statements: p.unexaminedMetadataStatements,
    settings_values_and_database_scope_recovery_verified: false,
    parameter_acl_semantics_verified: false,
    omitted_builtin_memberships_recovered: false,
    independent_login_credentials_verified: false,
    live_source_or_isolated_restore_verified: false,
  };
}

function privateComponent(root) {
  const run = "20261008T042143Z-48bbd715d1b24cec870ee95e8113edb2";
  const packageRun = run + ".roles-component-47e6cd53c0884338b318426926349d77";
  const read = name => {
    const f = path.join(root, name); const s = fs.lstatSync(f);
    if (!s.isFile() || s.isSymbolicLink() || s.size < 1 || s.size > 2_000_000) throw new Error("PRIVATE_FILE_TYPE_OR_SIZE_REVIEW");
    const b = fs.readFileSync(f); return { name, file: f, bytes: b.length, sha256: crypto.createHash("sha256").update(b).digest("hex"), buffer: b };
  };
  const role = read(run + ".roles.sql"); const manifest = read(run + ".roles.manifest.json");
  const archive = read(packageRun + ".7z"); const receipt = read(packageRun + ".verification.json");
  const parseJson = b => JSON.parse(b.toString("utf8").replace(/^\uFEFF/, ""));
  const record = parseJson(manifest.buffer); const verified = parseJson(receipt.buffer);
  const summary = record.summary; const encryption = verified.summary;
  if (summary?.stage_step !== "1.2" || summary.result !== "ROLE_EXPORT_NATIVE_COMPLETION_AND_MARKERS_PASS" ||
      summary.project !== "kttkospkblwvguuwnhjj" || path.resolve(summary.file) !== path.resolve(role.file) ||
      summary.bytes !== 6310 || role.bytes !== 6310 || summary.inventoried_role_definitions !== 16 ||
      summary.membership_grant_statements !== 21 || summary.parameter_acl_statements !== 1 ||
      summary.role_password_export_disabled !== true || !/^[a-f0-9]{64}$/i.test(record.file_sha256 || "") ||
      record.file_sha256.toLowerCase() !== role.sha256) throw new Error("ROLE_MANIFEST_BINDING_REVIEW");
  if (encryption?.result !== "ROLES_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS" ||
      encryption.stage_step !== "1.2" || encryption.project !== summary.project ||
      path.resolve(encryption.file) !== path.resolve(archive.file) || archive.bytes !== 1919 || encryption.bytes !== 1919 ||
      encryption.packaged_files !== 2 || encryption.roles_match_private_manifest !== true ||
      encryption.wrong_password_cannot_list_source_filenames !== true || encryption.both_extracted_hashes_match !== true ||
      !/^[a-f0-9]{64}$/i.test(verified.archive_sha256 || "") || verified.archive_sha256.toLowerCase() !== archive.sha256 ||
      !Array.isArray(verified.source_files) || verified.source_files.length !== 2 ||
      [role, manifest].some(x => verified.source_files.filter(v => v.name === x.name && v.bytes === x.bytes && String(v.sha256).toLowerCase() === x.sha256).length !== 1)) throw new Error("ENCRYPTED_RECEIPT_BINDING_REVIEW");
  return { sql: role.buffer.toString("utf8"), role, archive, run };
}

function runLocal(root) {
  const component = privateComponent(root); const comparison = compareSnapshot(component.sql, SOURCE_SNAPSHOT);
  const passed = comparison.role_names_and_selected_attributes_match_s1e44 && comparison.exported_grantor_admin_inherit_set_match_s1e44;
  const summary = {
    stage_step: "1.2", result: passed ? "PRIVATE_ROLE_ATTRIBUTES_AND_EXPORTED_MEMBERSHIPS_MATCH_S1E44" : "PRIVATE_ROLE_COVERAGE_REVIEW",
    project: "kttkospkblwvguuwnhjj", checked_utc: new Date().toISOString(), source_metadata_checked_utc: "2026-10-08T04:04:45.322523Z",
    archive_and_role_files_match_private_receipts: true, ...comparison,
    complete_platform_backup_verified: false, isolated_database_restore_verified: false, raw_artifacts_uploaded: false,
  };
  const file = path.join(root, component.run + ".role-coverage-" + crypto.randomUUID() + ".verification.json");
  fs.writeFileSync(file, JSON.stringify({ summary, role_sha256: component.role.sha256, archive_sha256: component.archive.sha256 }, null, 2) + "\n", { flag: "wx" });
  return summary;
}

const SOURCE_SNAPSHOT = {
  "scope": "Role metadata only; no passwords/settings values. Managed-role classification and private recoverable export remain required; do not restore platform roles blindly.",
  "memberships": [
    {
      "member": "authenticator",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "anon",
      "inherit_option": false
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "anon",
      "inherit_option": true
    },
    {
      "member": "supabase_realtime_admin",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "anon",
      "inherit_option": false
    },
    {
      "member": "authenticator",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "authenticated",
      "inherit_option": false
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "authenticated",
      "inherit_option": true
    },
    {
      "member": "supabase_realtime_admin",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "authenticated",
      "inherit_option": false
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "authenticator",
      "inherit_option": true
    },
    {
      "member": "supabase_storage_admin",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "authenticator",
      "inherit_option": false
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "pg_create_subscription",
      "inherit_option": true
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "pg_monitor",
      "inherit_option": true
    },
    {
      "member": "supabase_etl_admin",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "pg_monitor",
      "inherit_option": true
    },
    {
      "member": "supabase_read_only_user",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "pg_monitor",
      "inherit_option": true
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "pg_read_all_data",
      "inherit_option": true
    },
    {
      "member": "supabase_etl_admin",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "pg_read_all_data",
      "inherit_option": true
    },
    {
      "member": "supabase_read_only_user",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "pg_read_all_data",
      "inherit_option": true
    },
    {
      "member": "pg_monitor",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "pg_read_all_settings",
      "inherit_option": true
    },
    {
      "member": "pg_monitor",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "pg_read_all_stats",
      "inherit_option": true
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "pg_signal_backend",
      "inherit_option": true
    },
    {
      "member": "pg_monitor",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "pg_stat_scan_tables",
      "inherit_option": true
    },
    {
      "member": "authenticator",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "service_role",
      "inherit_option": false
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": true,
      "granted_role": "service_role",
      "inherit_option": true
    },
    {
      "member": "supabase_realtime_admin",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "service_role",
      "inherit_option": false
    },
    {
      "member": "postgres",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "supabase_privileged_role",
      "inherit_option": true
    },
    {
      "member": "supabase_etl_admin",
      "grantor": "supabase_admin",
      "set_option": true,
      "admin_option": false,
      "granted_role": "supabase_privileged_role",
      "inherit_option": true
    }
  ],
  "non_system_roles": [
    {
      "role": "anon",
      "login": false,
      "inherit": true,
      "superuser": false,
      "bypass_rls": false,
      "create_role": false,
      "replication": false,
      "setting_count": 1,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "authenticated",
      "login": false,
      "inherit": true,
      "superuser": false,
      "bypass_rls": false,
      "create_role": false,
      "replication": false,
      "setting_count": 1,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "authenticator",
      "login": true,
      "inherit": false,
      "superuser": false,
      "bypass_rls": false,
      "create_role": false,
      "replication": false,
      "setting_count": 3,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "dashboard_user",
      "login": false,
      "inherit": true,
      "superuser": false,
      "bypass_rls": false,
      "create_role": true,
      "replication": true,
      "setting_count": 0,
      "create_database": true,
      "connection_limit": -1
    },
    {
      "role": "pgbouncer",
      "login": true,
      "inherit": true,
      "superuser": false,
      "bypass_rls": false,
      "create_role": false,
      "replication": false,
      "setting_count": 0,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "postgres",
      "login": true,
      "inherit": true,
      "superuser": false,
      "bypass_rls": true,
      "create_role": true,
      "replication": true,
      "setting_count": 1,
      "create_database": true,
      "connection_limit": -1
    },
    {
      "role": "service_role",
      "login": false,
      "inherit": true,
      "superuser": false,
      "bypass_rls": true,
      "create_role": false,
      "replication": false,
      "setting_count": 0,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_admin",
      "login": true,
      "inherit": true,
      "superuser": true,
      "bypass_rls": true,
      "create_role": true,
      "replication": true,
      "setting_count": 2,
      "create_database": true,
      "connection_limit": -1
    },
    {
      "role": "supabase_auth_admin",
      "login": true,
      "inherit": false,
      "superuser": false,
      "bypass_rls": false,
      "create_role": true,
      "replication": false,
      "setting_count": 3,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_etl_admin",
      "login": true,
      "inherit": true,
      "superuser": false,
      "bypass_rls": true,
      "create_role": false,
      "replication": true,
      "setting_count": 0,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_functions_admin",
      "login": true,
      "inherit": false,
      "superuser": false,
      "bypass_rls": false,
      "create_role": true,
      "replication": false,
      "setting_count": 0,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_privileged_role",
      "login": false,
      "inherit": true,
      "superuser": false,
      "bypass_rls": false,
      "create_role": false,
      "replication": false,
      "setting_count": 0,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_read_only_user",
      "login": true,
      "inherit": true,
      "superuser": false,
      "bypass_rls": true,
      "create_role": false,
      "replication": false,
      "setting_count": 1,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_realtime_admin",
      "login": false,
      "inherit": false,
      "superuser": false,
      "bypass_rls": false,
      "create_role": false,
      "replication": false,
      "setting_count": 1,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_replication_admin",
      "login": true,
      "inherit": true,
      "superuser": false,
      "bypass_rls": false,
      "create_role": false,
      "replication": true,
      "setting_count": 0,
      "create_database": false,
      "connection_limit": -1
    },
    {
      "role": "supabase_storage_admin",
      "login": true,
      "inherit": false,
      "superuser": false,
      "bypass_rls": false,
      "create_role": true,
      "replication": false,
      "setting_count": 2,
      "create_database": false,
      "connection_limit": -1
    }
  ],
  "role_database_setting_records": 10,
  "configuration_parameter_acl_records": 1
};

module.exports = { statements, parseRoleExport, compareSnapshot, privateComponent, runLocal };
if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("EXPECTED_PRIVATE_BACKUP_ROOT");
    const summary = runLocal(path.resolve(process.argv[2]));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.result === "PRIVATE_ROLE_COVERAGE_REVIEW" ? 2 : 0;
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.message || "") ? error.message : "PRIVATE_FILE_OR_FORMAT_REVIEW";
    console.log(JSON.stringify({ stage_step: "1.2", result: "PRIVATE_ROLE_COVERAGE_REVIEW", review_code: code, complete_platform_backup_verified: false, isolated_database_restore_verified: false, raw_artifacts_uploaded: false }, null, 2));
    process.exitCode = 2;
  }
}
