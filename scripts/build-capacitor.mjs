import { cp, lstat, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "www");
// Validate dependencies before replacing an existing mobile build.
let build;
try {
  ({ build } = await import("esbuild"));
  await Promise.all([import("@capacitor/core"), import("@capacitor/preferences"), import("@capacitor/app")]);
} catch (_) {
  throw new Error("Install esbuild and @capacitor/preferences / @capacitor/app matching your @capacitor/core major. See docs/LAST_WORKSPACE.md.");
}
const htmlFiles = ["about.html", "app-entry.html", "app.html", "business.html", "contact.html", "index.html", "offline.html", "pricing.html", "signup.html"];
const assets = ["workspace-preference.js", "app-entry.js", "app.js", "admin-plans.js", "business.js", "config.js", "push-notifications.js", "pwa-install.js", "pwa.js", "site.js", "sw.js", "business.css", "pwa-install.css", "pwa-shell.css", "pwa-update.css", "site.css", "styles.css", "manifest.webmanifest", "assets"];
// A partial checkout must not silently produce an incomplete native app.
for (const source of [...htmlFiles, ...assets]) {
  const info = await lstat(path.join(projectRoot, source));
  if (source === "assets" ? !info.isDirectory() : !info.isFile()) {
    throw new Error(`Required native source has the wrong file type: ${source}`);
  }
}
const currentOutput = await lstat(outputDirectory).catch(error => {
  if (error.code === "ENOENT") return null;
  throw error;
});
if (currentOutput && !currentOutput.isDirectory()) {
  throw new Error("Existing www must be a directory, not a file or symbolic link.");
}

// Finish copying/bundling before replacing an existing build. Both temporary
// directories are siblings of www so promotion stays on the same filesystem.
const stagingDirectory = await mkdtemp(path.join(projectRoot, ".capacitor-build-"));
const previousDirectory = `${stagingDirectory}-previous`;
let previousMoved = false;
let promoted = false;
try {
  for (const asset of assets) await cp(path.join(projectRoot, asset), path.join(stagingDirectory, asset), { recursive: true });
  await build({
    stdin: { contents: `import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
window.MushavoNativeWorkspace = { Preferences, App };`, resolveDir: projectRoot, loader: "js" },
    bundle: true, platform: "browser", format: "iife", outfile: path.join(stagingDirectory, "native-workspace.js")
  });
  for (const file of htmlFiles) {
    let html = await readFile(path.join(projectRoot, file), "utf8");
    // Retain the existing wrapper's browser-only install UI suppression and
    // public-site link without changing the source web/PWA pages.
    html = html
      .replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi, "")
      .replace(/<link\b[^>]*\bhref=["']\/?pwa-install\.css[^>]*>/gi, "")
      .replace(/<script\b[^>]*\bsrc=["']\/?pwa-install\.js[^>]*>\s*<\/script>/gi, "")
      .replace('href="index.html">Return to the Mushavo Budget website',
        'href="https://mushavobudget.com/" target="_blank" rel="noopener noreferrer">Return to the Mushavo Budget website');
    if (html.includes("workspace-preference.js")) {
      html = html.replace(/(<script\b[^>]*\bsrc=["']\/?workspace-preference\.js[^>]*>)/i,
        '<script src="/native-workspace.js"></script>\n    $1');
    }
    await writeFile(path.join(stagingDirectory, file), html);
  }
  // Capacitor starts at index.html; the public web homepage remains unchanged.
  await cp(path.join(stagingDirectory, "app-entry.html"), path.join(stagingDirectory, "index.html"));
  if (currentOutput) {
    await rename(outputDirectory, previousDirectory);
    previousMoved = true;
  }
  try {
    await rename(stagingDirectory, outputDirectory);
    promoted = true;
  } catch (error) {
    if (previousMoved) await rename(previousDirectory, outputDirectory);
    throw error;
  }
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
  if (promoted && previousMoved) {
    await rm(previousDirectory, { recursive: true, force: true }).catch(() => {
      console.warn(`New www is ready; the previous bundle is retained at ${previousDirectory}.`);
    });
  }
}
console.log("Built www with the session-aware launcher, native workspace preferences and app-resume integration.");
