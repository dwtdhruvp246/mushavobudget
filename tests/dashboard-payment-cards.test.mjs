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
