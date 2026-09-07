import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ignoreSource = await readFile(new URL("../.assetsignore", import.meta.url), "utf8");
const wranglerSource = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

const privatePaths = [
  "node_modules/",
  "supabase/",
  "tests/",
  "docs/",
  "package.json",
  "package-lock.json"
];

test("Cloudflare uses an explicit static-assets configuration", () => {
  assert.match(wranglerSource, /"name"\s*:\s*"mushavobudget"/);
  assert.match(wranglerSource, /"directory"\s*:\s*"\."/);
});

test("Cloudflare excludes private project paths from static assets", () => {
  const lines = ignoreSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  for (const path of privatePaths) assert.ok(lines.includes(path), `${path} must stay private`);
  assert.ok(lines.includes("*.md"), "deployment documentation must stay private");
  assert.ok(lines.includes("*.sha256"), "source manifests must stay private");
});
