import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const monitoringSource = await readFile(
  new URL("../supabase/pwa-stage-13-monitoring.sql", import.meta.url),
  "utf8"
);
const deploymentSource = await readFile(
  new URL("../PWA_STAGE_13_DEPLOYMENT.md", import.meta.url),
  "utf8"
);
const workflowSource = await readFile(
  new URL("../.github/workflows/pages.yml", import.meta.url),
  "utf8"
);
const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const appPage = await readFile(new URL("../app.html", import.meta.url), "utf8");
const pwaSource = await readFile(new URL("../pwa.js", import.meta.url), "utf8");

test("production deployment waits for the complete automated release suite", () => {
  const globalPermissions = workflowSource.slice(0, workflowSource.indexOf("jobs:"));
  assert.match(workflowSource, /pull_request:\s*\n\s*branches: \["main"\]/);
  assert.match(workflowSource, /test:\s*[\s\S]*node --test tests\/\*\.test\.mjs/);
  assert.match(workflowSource, /deploy:\s*\n\s*needs: test/);
  assert.match(workflowSource, /if: github\.event_name != 'pull_request'/);
  assert.match(workflowSource, /deploy:[\s\S]*permissions:\s*\n\s*contents: read\s*\n\s*pages: write\s*\n\s*id-token: write/);
  assert.doesNotMatch(globalPermissions, /pages: write|id-token: write/);
  assert.match(workflowSource, /group: "pages-\$\{\{ github\.ref \}\}"/);
});

test("monitoring covers the required aggregate operational signals", () => {
  for (const signal of [
    "Cron configuration",
    "Latest Cron run",
    "Due queue age",
    "Retry and failed jobs",
    "Expired processing claims",
    "Duplicate prevention",
    "Subscription health",
    "Notification adoption"
  ]) {
    assert.match(monitoringSource, new RegExp(signal));
  }
  assert.match(monitoringSource, /cron\.job_run_details/);
  assert.match(monitoringSource, /notification_outbox/);
  assert.match(monitoringSource, /push_subscriptions/);
});

test("monitoring never returns sensitive subscription or notification fields", () => {
  const finalSelect = monitoringSource.slice(monitoringSource.lastIndexOf("select check_name"));
  assert.doesNotMatch(finalSelect, /endpoint|p256dh|\bauth\b|user_id|title|body|target_url|idempotency_key|decrypted_secret/i);
  assert.doesNotMatch(monitoringSource, /vault\.(?:secrets|decrypted_secrets)/i);
});

test("the rollback guide stops Cron before any optional destructive cleanup", () => {
  assert.match(deploymentSource, /rollback-push-dispatcher\.sql/);
  assert.match(deploymentSource, /keeps outbox history/i);
  assert.match(deploymentSource, /Restore automatic reminders/);
  assert.match(deploymentSource, /cron-push-reminders\.sql/);
});

test("the manual matrix covers mobile, authentication, privacy, updates and offline recovery", () => {
  for (const requirement of [
    "Android Chrome",
    "iPhone/iPad Safari",
    "Authentication and privacy",
    "Updates, offline and recovery",
    "same device",
    "detailed previews",
    "signed out"
  ]) {
    assert.match(deploymentSource, new RegExp(requirement, "i"));
  }
});

test("all current web release markers agree", () => {
  assert.match(pwaSource, /const RELEASE = "4\.5\.0"/);
  assert.match(appPage, /app\.js\?v=66/);
  assert.match(appPage, /styles\.css\?v=53/);
  assert.match(appPage, /pwa\.js\?v=17/);
  assert.match(appPage, /Version 4\.5\.0/g);
  assert.match(workerSource, /pwa-shell-v22/);
  assert.match(workerSource, /"\/pwa\.js\?v=17"/);
});
