"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { privateDatabaseComponent, databaseTocCoverage } = require("./security-stage-1-setting-coverage.cjs");
const digest = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

function runLocal(root, pgRestore, runner = spawnSync) {
  const component = privateDatabaseComponent(root);
  const exe = fs.lstatSync(pgRestore);
  if (!exe.isFile() || exe.isSymbolicLink() || exe.size < 1) throw new Error("PG_RESTORE_EXECUTABLE_REVIEW");
  const directory = path.join(root, "DatabasePropertiesToc-" + crypto.randomUUID());
  fs.mkdirSync(directory);
  const listingFile = path.join(directory, "full-archive.toc.txt");
  // --list selects PrintTOCSummary, never RestoreArchive. --verbose makes it
  // include all TOC entries, even DATABASE/PROPERTIES hidden by plain --list.
  // No connection/SQL/restore/create/clean flag is supplied. Output is private.
  const native = runner(pgRestore, ["--list", "--verbose", "--file", listingFile, component.dump.file],
    { encoding: "utf8", timeout: 30000, maxBuffer: 1_000_000, shell: false, windowsHide: true });
  const stdout = typeof native.stdout === "string" ? native.stdout : "";
  const stderr = typeof native.stderr === "string" ? native.stderr : "";
  fs.writeFileSync(path.join(directory, "native-messages.txt"), stdout + stderr, { flag: "wx" });
  if (native.error || native.status !== 0) throw new Error("PG_RESTORE_FULL_LIST_NATIVE_COMPLETION_REVIEW");
  const stat = fs.lstatSync(listingFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 4_000_000) throw new Error("FULL_TOC_FILE_TYPE_OR_SIZE_REVIEW");
  const buffer = fs.readFileSync(listingFile); const text = buffer.toString("utf8");
  const entries = text.split(/\r?\n/).filter(x => /^\d+;\s+\d+\s+\d+\s+.+$/.test(x)).length;
  const contextMatch = /^;\s+dbname:\s+postgres\s*$/m.test(text);
  const previous = databaseTocCoverage(component.toc.buffer.toString("utf8"));
  const full = databaseTocCoverage(text);
  for (const file of Object.values(component)) {
    const now = fs.lstatSync(file.file);
    if (!now.isFile() || now.isSymbolicLink() || now.size !== file.bytes || digest(fs.readFileSync(file.file)) !== file.sha256) {
      throw new Error("ORIGINAL_DATABASE_COMPONENT_CHANGED_REVIEW");
    }
  }
  if (digest(fs.readFileSync(listingFile)) !== digest(buffer)) throw new Error("FULL_TOC_CHANGED_DURING_CHECK_REVIEW");
  const messagesPresent = Boolean((stdout + stderr).trim());
  const passed = contextMatch && entries > 0 && full.intended_database_definition_toc_entries === 1 &&
    full.intended_database_properties_entry_present && !messagesPresent;
  const summary = {
    stage_step: "1.2", result: passed ? "DATABASE_DEFINITION_AND_PROPERTIES_FULL_TOC_PRESENT" : "DATABASE_PROPERTIES_FULL_TOC_REVIEW",
    project: "kttkospkblwvguuwnhjj", checked_utc: new Date().toISOString(),
    database_archive_and_three_sources_match_private_receipt: true,
    native_pg_restore_list_verbose_exit_code: 0, native_messages_present_kept_private: messagesPresent,
    full_toc_database_header_matches_intended: contextMatch, full_toc_entries: entries,
    original_selected_toc_database_definition_entries: previous.intended_database_definition_toc_entries,
    original_selected_toc_database_properties_entries: previous.intended_database_properties_toc_entries,
    ...full,
    original_database_component_files_unchanged: true,
    sql_generated_or_executed: false, database_connection_performed: false,
    complete_platform_backup_verified: false, isolated_database_restore_verified: false, raw_artifacts_uploaded: false,
  };
  fs.writeFileSync(path.join(directory, "verification.json"), JSON.stringify({ summary,
    source_archive_sha256: component.archive.sha256, source_dump_sha256: component.dump.sha256,
    original_selected_toc_sha256: component.toc.sha256, full_toc_sha256: digest(buffer) }, null, 2) + "\n", { flag: "wx" });
  return summary;
}

module.exports = { runLocal };
if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error("EXPECTED_PRIVATE_ROOT_AND_PG_RESTORE_PATH");
    const summary = runLocal(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.result === "DATABASE_PROPERTIES_FULL_TOC_REVIEW" ? 2 : 0;
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.message || "") ? error.message : "PRIVATE_FILE_OR_NATIVE_LIST_REVIEW";
    console.log(JSON.stringify({ stage_step: "1.2", result: "DATABASE_PROPERTIES_FULL_TOC_REVIEW", review_code: code,
      sql_generated_or_executed: false, database_connection_performed: false,
      complete_platform_backup_verified: false, isolated_database_restore_verified: false, raw_artifacts_uploaded: false }, null, 2));
    process.exitCode = 2;
  }
}
