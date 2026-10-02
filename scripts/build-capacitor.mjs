import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
for (const asset of assets) await cp(path.join(projectRoot, asset), path.join(outputDirectory, asset), { recursive: true });
await build({
  stdin: { contents: `import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
window.MushavoNativeWorkspace = { Preferences, App };`, resolveDir: projectRoot, loader: "js" },
  bundle: true, platform: "browser", format: "iife", outfile: path.join(outputDirectory, "native-workspace.js")
});
for (const file of htmlFiles) {
  let html = await readFile(path.join(projectRoot, file), "utf8");
  if (html.includes("workspace-preference.js")) {
    html = html.replace('    <script src="/workspace-preference.js', '    <script src="/native-workspace.js"></script>\n    <script src="/workspace-preference.js');
  }
  await writeFile(path.join(outputDirectory, file), html);
}
// Capacitor always starts at index.html. The public homepage remains in the web release.
await cp(path.join(outputDirectory, "app-entry.html"), path.join(outputDirectory, "index.html"));
console.log("Built www with the session-aware launcher, native workspace preferences and app-resume integration.");
