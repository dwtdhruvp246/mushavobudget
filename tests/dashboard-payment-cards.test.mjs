import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [source, styles] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8")
]);

test("expanded dashboard payment cards retain a full-width block layout", () => {
  assert.match(styles, /\.record-card\.occurrence-card\s*\{[\s\S]*?display: block;[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;[\s\S]*?box-sizing: border-box;/);
});

test("dashboard payment accents use payment completion and the actual reminder window", () => {
  assert.match(source, /function occurrenceCardStateClass\(occurrence\)/);
  assert.match(source, /occurrence\.status === "paid" \|\| occurrence\.outstanding <= 0\.00005/);
  assert.match(source, /dueDay - todayDay <= reminderDays/);
  assert.match(source, /payment-reminder-active/);
  assert.match(source, /payment-complete/);
});

test("status accents are inset one-pixel shadows that do not consume card space", () => {
  assert.match(styles, /\.record-card\.payment-reminder-active\s*\{[\s\S]*?inset 0 0 0 1px rgba\(220, 38, 38, 0\.72\)/);
  assert.match(styles, /\.record-card\.payment-complete\s*\{[\s\S]*?inset 0 0 0 1px rgba\(16, 185, 129, 0\.78\)/);
  assert.doesNotMatch(styles, /\.record-card\.payment-(?:reminder-active|complete)\s*\{[^}]*border-width:/);
});

test("desktop dashboard columns share the available content width", () => {
  assert.match(styles, /@media \(min-width: 1181px\)\s*\{\s*\[data-family-panel="dashboard"\] > \.content-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?\.content-grid\s*\{\s*grid-template-columns: 1fr;/);
});

test("narrow desktop ledgers use their container width instead of the viewport", () => {
  assert.match(styles, /@media \(min-width: 681px\)\s*\{\s*@container record-list \(max-width: 620px\)/);
  assert.match(styles, /grid-template-areas:\s*"date copy chevron"\s*"date amount chevron";/);
  assert.match(styles, /\.occurrence-summary-button > \.date-chip\s*\{\s*grid-area: date;/);
  assert.match(styles, /\.occurrence-summary-button \.occurrence-amount\s*\{[\s\S]*?grid-area: amount;[\s\S]*?justify-self: start;/);
});

test("expanded narrow desktop cards wrap facts and keep both actions inside", () => {
  assert.match(styles, /@container record-list \(max-width: 620px\)[\s\S]*?\.occurrence-facts\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /@container record-list \(max-width: 620px\)[\s\S]*?\.occurrence-facts dd\s*\{[\s\S]*?white-space: normal;[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(styles, /@container record-list \(max-width: 620px\)[\s\S]*?\.occurrence-detail-footer \.row-actions\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?width: 100%;/);
});
