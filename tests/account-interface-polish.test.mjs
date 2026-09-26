import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const appHtml = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const appStyles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("dashboard and reports keep independent month state", () => {
  assert.match(appSource, /filterMonth:\s*toMonthValue\(new Date\(\)\),\s*reportMonth:\s*toMonthValue\(new Date\(\)\)/s);
  assert.match(appSource, /#reportMonthFilter"\)\.addEventListener[\s\S]*?state\.reportMonth = event\.target\.value;[\s\S]*?renderReports\(\);/);
  assert.doesNotMatch(appSource, /#reportMonthFilter"\)\.addEventListener[\s\S]{0,180}state\.filterMonth = event\.target\.value;/);
  assert.match(appSource, /generateOccurrences\(reportItems, reportRecords, state\.reportMonth\)/);
  assert.match(appSource, /mushavo-report-\$\{state\.reportMonth\}\.csv/);
});

test("dashboard includes earlier unpaid occurrences and paid-by attribution", () => {
  assert.match(appSource, /function previousUnpaidOccurrences[\s\S]*?occurrence\.status !== "paid" && occurrence\.outstanding > 0\.00005/);
  assert.match(appSource, /title: "Previous unpaid"/);
  assert.match(appSource, /const attentionOccurrences = \[\.\.\.previousUnpaid, \.\.\.occurrences\]/);
  assert.match(appSource, /function occurrencePayerLabel/);
  assert.match(appSource, /paid-by-badge/);
});

test("reports, family rows, and subscription plans use the revised responsive layout", () => {
  assert.match(appHtml, /class="report-export-actions"/);
  assert.match(appStyles, /\.report-filter-controls\s*\{[^}]*repeat\(5,/s);
  assert.match(appStyles, /#membersList \.record-card,[\s\S]*?#invitationsList \.record-card\s*\{[^}]*border:\s*2px/s);
  assert.match(appHtml, /class="subscription-ownership-card personal-plan-card"/);
  assert.match(appStyles, /\.subscription-ownership-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(appSource, /class="\$\{feature\.enabled \? "available" : "unavailable"\}"/);
  assert.match(appStyles, /\.workspace-plan-features li\.unavailable::before\s*\{[^}]*content:\s*"×"/s);
  assert.match(appStyles, /\.workspace-plan-card\s*\{[^}]*height:\s*100%/s);
});
