// Offline fixture checks only; never run this project's real native build.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = ["scripts/build-capacitor.mjs", "tests/capacitor-build.test.mjs", "scripts/verify-stage-5-packaging.mjs"];
const syntax = files.map(file => {
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8", cwd: root });
  return { file, pass: !result.error && result.status === 0 };
});
const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", path.join(root, "tests/capacitor-build.test.mjs")], {
  encoding: "utf8", cwd: root, maxBuffer: 1024 * 1024
});
const count = name => {
  const match = result.stdout?.match(new RegExp(`^# ${name} (\\d+)\\s*$`, "m"));
  return match ? Number(match[1]) : null;
};
const tests = count("tests"), pass = count("pass"), fail = count("fail");
const ok = syntax.every(item => item.pass) && !result.error && result.status === 0 &&
  tests === 9 && pass === 9 && fail === 0 && count("skipped") === 0 && count("cancelled") === 0;
console.log(JSON.stringify({
  stage_step: "5.4",
  result: ok ? "OFFLINE_NATIVE_PACKAGING_FIXTURE_SCOPED_PASS" : "OFFLINE_NATIVE_PACKAGING_FIXTURE_FAIL",
  scope: "ACTUAL_BUILDER_IN_TEMPORARY_FIXTURES_WITH_MOCK_ESBUILD_AND_CAPACITOR_MODULES",
  source_parent_commit: "82b30e4197a282c25c427c84052e65bdf0239378",
  node_version: process.version,
  tests, pass, fail, exit_code: ok ? 0 : 1,
  syntax_checks: syntax.filter(item => item.pass).length,
  syntax,
  file_sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex")])),
  real_dependency_bundle_or_native_compile_verified: false,
  root_www_or_existing_native_project_changed: false,
  native_sync_install_sign_upload_run: false,
  hosted_or_device_checks_run: 0,
  native_security_acceptance: false,
  APK_update_deferred: true,
  production_or_accounts_settings_changed: false,
  findings_closed: []
}, null, 2));
if (!ok) {
  // Test fixtures contain no real credentials or user records.
  process.stderr.write(result.stdout || "No TAP output.\n");
  process.stderr.write(result.stderr || "");
  process.stderr.write(result.error ? String(result.error) + "\n" : "");
}
process.exitCode = ok ? 0 : 1;
