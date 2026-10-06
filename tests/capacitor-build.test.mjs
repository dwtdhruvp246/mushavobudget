import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));

// These filesystem regressions substitute only the external bundler/plugins.
// An actual pinned-package bundle is checked separately in the Stage 0 audit.
async function fixture(t, { bundleFails = false, dependencies = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mushavo-capacitor-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const entry of await readdir(repository, { withFileTypes: true })) {
    if (entry.isFile() && /\.(html|css|js|webmanifest)$/.test(entry.name)) {
      await cp(path.join(repository, entry.name), path.join(root, entry.name));
    }
  }
  await cp(path.join(repository, "assets"), path.join(root, "assets"), { recursive: true });
  await mkdir(path.join(root, "scripts"));
  await cp(path.join(repository, "scripts/build-capacitor.mjs"), path.join(root, "scripts/build-capacitor.mjs"));
  await mkdir(path.join(root, "www"));
  await writeFile(path.join(root, "www/previous-build.txt"), "previous complete build");
  const modules = dependencies ? ["esbuild", "@capacitor/core", "@capacitor/app", "@capacitor/preferences"] : [];
  for (const name of modules) {
    const directory = path.join(root, "node_modules", name);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ name, type: "module", exports: "./index.js" }));
    await writeFile(path.join(directory, "index.js"), name === "esbuild"
      ? `import { writeFile } from 'node:fs/promises';
export async function build(options) {
  ${bundleFails ? "throw new Error('TEST_BUNDLER_FAILURE');" : "await writeFile(options.outfile, 'window.MushavoNativeWorkspace = {};');"}
}`
      : "export const fixture = true;");
  }
  return root;
}

async function run(root) {
  return execute(process.execPath, [path.join(root, "scripts/build-capacitor.mjs")], { cwd: root });
}

async function previousIsIntact(root) {
  assert.equal(await readFile(path.join(root, "www/previous-build.txt"), "utf8"), "previous complete build");
  assert.deepEqual((await readdir(root)).filter(name => name.startsWith(".capacitor-build-")), []);
}

test("native bundle includes Business and the workspace launcher, hides browser install UI, and leaves web sources intact", async t => {
  const root = await fixture(t);
  const source = await readFile(path.join(root, "app.html"), "utf8");
  await run(root);
  const output = path.join(root, "www");
  assert.match(await readFile(path.join(output, "index.html"), "utf8"), /Opening Mushavo Budget/);
  for (const file of ["app.html", "business.html", "app-entry.html", "index.html"]) {
    const html = await readFile(path.join(output, file), "utf8");
    assert.ok(html.indexOf("/native-workspace.js") >= 0);
    assert.ok(html.indexOf("/native-workspace.js") < html.indexOf("/workspace-preference.js"));
  }
  for (const file of (await readdir(output)).filter(name => name.endsWith(".html"))) {
    const html = await readFile(path.join(output, file), "utf8");
    assert.doesNotMatch(html, /<link[^>]+rel=["']manifest["']|<script[^>]+src=["']\/?pwa-install\.js|<link[^>]+href=["']\/?pwa-install\.css/i);
    // Every packaged local script, stylesheet and image reference must resolve.
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const resource = match[1].split(/[?#]/)[0];
      if (!/\.(js|css|png|svg|jpg|jpeg|webp|ico)$/.test(resource) || /^(?:[a-z]+:)?\/\//i.test(resource)) continue;
      await readFile(path.join(output, resource.replace(/^\//, "")));
    }
  }
  assert.match(await readFile(path.join(output, "app.html"), "utf8"), /href="https:\/\/mushavobudget\.com\/" target="_blank" rel="noopener noreferrer">Return to the Mushavo Budget website/);
  for (const file of ["business.js", "business.css", "app-entry.js", "workspace-preference.js", "native-workspace.js", "admin-plans.js"]) {
    assert.ok((await readFile(path.join(output, file))).length > 0);
  }
  assert.equal(await readFile(path.join(root, "app.html"), "utf8"), source);
  await assert.rejects(readFile(path.join(output, "previous-build.txt")), { code: "ENOENT" });
  await run(root);
  assert.equal(await readFile(path.join(root, "app.html"), "utf8"), source);
  assert.deepEqual((await readdir(root)).filter(name => name.startsWith(".capacitor-build-")), []);
});

test("native build dependency failure preserves the previous bundle", async t => {
  const root = await fixture(t, { dependencies: false });
  await assert.rejects(run(root), error => /Install esbuild/.test(error.stderr));
  await previousIsIntact(root);
});

test("native build rejects a missing Business asset without deleting the previous bundle", async t => {
  const root = await fixture(t);
  await rm(path.join(root, "business.js"));
  await assert.rejects(run(root), error => /business\.js/.test(error.stderr));
  await previousIsIntact(root);
});

test("native bundler failure preserves the previous bundle and cleans incomplete output", async t => {
  const root = await fixture(t, { bundleFails: true });
  await assert.rejects(run(root), error => /TEST_BUNDLER_FAILURE/.test(error.stderr));
  await previousIsIntact(root);
});

test("native bundle promotion failure restores the previous output directory", async t => {
  const root = await fixture(t);
  const preload = path.join(root, "fail-promotion.mjs");
  await writeFile(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
const rename = fs.promises.rename;
fs.promises.rename = async (source, destination) => {
  if (path.basename(source).startsWith('.capacitor-build-') && !source.endsWith('-previous') && path.basename(destination) === 'www') {
    throw Object.assign(new Error('TEST_PROMOTION_DENIED'), {code: 'EACCES'});
  }
  return rename(source, destination);
};
syncBuiltinESMExports();`);
  await assert.rejects(execute(process.execPath, ["--import", preload, path.join(root, "scripts/build-capacitor.mjs")], { cwd: root }),
    error => /TEST_PROMOTION_DENIED/.test(error.stderr));
  await previousIsIntact(root);
});
