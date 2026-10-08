"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { runLocal } = require("../scripts/security-stage-1-database-properties-toc.cjs");
const fullToc = ';\n;     dbname: postgres\n1; 0 0 DATABASE - postgres owner\n2; 0 0 DATABASE PROPERTIES - postgres owner\n3; 0 0 TABLE DATA public dummy owner\n; depends on: 1\n';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mushavo-s55-dummy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1";
  const packageRun = run + ".database-component-8135efd7cfce4f89b01da7296e864731";
  const digest = b => crypto.createHash("sha256").update(b).digest("hex");
  // Dummy buffers prove receipt/call/error handling only, not real PG/7z validity.
  const dump = Buffer.alloc(2109566, 1); const toc = Buffer.from('; Selected TOC Entries:\n3; 0 0 TABLE DATA public dummy owner\n');
  const manifest = Buffer.from(JSON.stringify({ sha256: digest(dump) }));
  const sources = [[run + ".database.dump", dump], [run + ".toc.txt", toc], [run + ".manifest.json", manifest]];
  for (const [name, buffer] of sources) fs.writeFileSync(path.join(root, name), buffer);
  const archive = Buffer.alloc(566080, 2); const archiveFile = path.join(root, packageRun + ".7z"); fs.writeFileSync(archiveFile, archive);
  fs.writeFileSync(path.join(root, packageRun + ".verification.json"), JSON.stringify({
    summary: { stage_step: "1.2", project: "kttkospkblwvguuwnhjj", result: "DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS", file: archiveFile, bytes: 566080, packaged_files: 3, dump_matches_private_manifest: true, wrong_password_cannot_list_source_filenames: true, all_three_extracted_hashes_match: true },
    archive_sha256: digest(archive), source_files: sources.map(([name, b]) => ({ name, bytes: b.length, sha256: digest(b) })),
  }));
  const exe = path.join(root, "pg_restore.exe"); fs.writeFileSync(exe, "Dummy executable; runner substituted in tests only.");
  const runner = (text = fullToc, overrides = {}) => (_exe, args, options) => {
    assert.equal(_exe, exe); assert.equal(options.shell, false);
    assert.deepEqual(args.slice(0, 3), ["--list", "--verbose", "--file"]);
    assert.equal(args.length, 5); assert.equal(args[4], path.join(root, run + ".database.dump"));
    assert.ok(args[3].startsWith(path.join(root, "DatabasePropertiesToc-")));
    fs.writeFileSync(args[3], text);
    return { status: 0, stdout: "", stderr: "", ...overrides };
  };
  return { root, run, exe, runner };
}
test("full TOC reveals entries hidden in selected TOC, while property content/recovery stays false", t => {
  const f = fixture(t); const r = runLocal(f.root, f.exe, f.runner());
  assert.equal(r.result, "DATABASE_DEFINITION_AND_PROPERTIES_FULL_TOC_PRESENT");
  assert.equal(r.original_selected_toc_database_definition_entries, 0);
  assert.equal(r.original_selected_toc_database_properties_entries, 0);
  assert.equal(r.intended_database_definition_toc_entries, 1);
  assert.equal(r.intended_database_properties_toc_entries, 1);
  assert.equal(r.database_properties_contains_required_setting_verified, false);
  assert.equal(r.database_properties_values_or_recovered_behavior_verified, false);
  assert.equal(r.sql_generated_or_executed, false); assert.equal(r.database_connection_performed, false);
});
test("missing/duplicate/wrong database entries or header remain REVIEW", t => {
  const f = fixture(t);
  for (const text of [fullToc.replace('2; 0 0 DATABASE PROPERTIES - postgres owner\n', ''), fullToc + '4; 0 0 DATABASE PROPERTIES - postgres owner\n', fullToc.replaceAll('postgres', 'different'), fullToc.replace('dbname: postgres', 'dbname: different')]) {
    assert.equal(runLocal(f.root, f.exe, f.runner(text)).result, "DATABASE_PROPERTIES_FULL_TOC_REVIEW");
  }
});
test("native failure or timeout cannot pass even if a complete listing file exists", t => {
  const f = fixture(t);
  for (const result of [{ status: 1 }, { status: null, error: new Error("PRIVATE native error") }]) {
    assert.throws(() => runLocal(f.root, f.exe, f.runner(fullToc, result)), /PG_RESTORE_FULL_LIST_NATIVE_COMPLETION_REVIEW/);
  }
});
test("native messages stay private and prevent unreviewed PASS", t => {
  const f = fixture(t); const r = runLocal(f.root, f.exe, f.runner(fullToc, { stderr: "PRIVATE-DIAGNOSTIC-SENTINEL" }));
  assert.equal(r.result, "DATABASE_PROPERTIES_FULL_TOC_REVIEW"); assert.equal(r.native_messages_present_kept_private, true);
  assert.ok(!JSON.stringify(r).includes("SENTINEL")); assert.ok(!JSON.stringify(r).includes(f.root));
  const directory = fs.readdirSync(f.root).find(x => x.startsWith("DatabasePropertiesToc-"));
  assert.equal(fs.readFileSync(path.join(f.root, directory, "native-messages.txt"), "utf8"), "PRIVATE-DIAGNOSTIC-SENTINEL");
});
test("original archive component changes during native listing are rejected", t => {
  const f = fixture(t); const delegate = f.runner();
  const runner = (...args) => {
    const r = delegate(...args); const file = path.join(f.root, f.run + ".toc.txt");
    const bytes = fs.readFileSync(file); bytes[0] ^= 1; fs.writeFileSync(file, bytes); return r;
  };
  assert.throws(() => runLocal(f.root, f.exe, runner), /ORIGINAL_DATABASE_COMPONENT_CHANGED_REVIEW/);
});
test("invalid native listing and redirected executable are rejected", t => {
  const f = fixture(t);
  assert.throws(() => runLocal(f.root, f.exe, f.runner("")), /FULL_TOC_FILE_TYPE_OR_SIZE_REVIEW/);
  const link = path.join(f.root, "redirected-pg_restore.exe"); fs.symlinkSync(f.exe, link);
  assert.throws(() => runLocal(f.root, link, f.runner()), /PG_RESTORE_EXECUTABLE_REVIEW/);
});
test("CLI malformed private input prints no artifact content/path/hash or native error", t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, f.run + ".manifest.json"), "PRIVATE-ARTIFACT-SENTINEL");
  const r = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/security-stage-1-database-properties-toc.cjs"), f.root, f.exe], { encoding: "utf8" });
  assert.equal(r.status, 2); assert.equal(r.stderr, "");
  assert.equal(JSON.parse(r.stdout).result, "DATABASE_PROPERTIES_FULL_TOC_REVIEW");
  assert.ok(!r.stdout.includes("SENTINEL")); assert.ok(!r.stdout.includes(f.root));
});
