import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const repair = readFileSync(
  new URL("../supabase/migrations/20260924143000_repair_payment_recurrence_constraints.sql", import.meta.url),
  "utf8"
);
const dispatcher = readFileSync(
  new URL("../supabase/functions/dispatch-push-reminders/index.ts", import.meta.url),
  "utf8"
);

function optionValues(selectId) {
  const select = html.match(new RegExp(`<select id="${selectId}"[^>]*>([\\s\\S]*?)<\\/select>`));
  assert.ok(select, `${selectId} must exist`);
  return [...select[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
}

function constraintValues(source, constraintName, columnName) {
  const constraint = source.match(new RegExp(
    `${constraintName} check \\(\\s*${columnName} in \\(([^)]*)\\)`,
    "s"
  ));
  assert.ok(constraint, `${constraintName} must exist`);
  return [...constraint[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

test("every payment schedule offered by the form is accepted by the schema and repair migration", () => {
  const formSchedules = optionValues("recurrenceType").sort();
  const schemaSchedules = constraintValues(schema, "payment_items_recurrence_type_check", "recurrence_type").sort();
  const repairSchedules = constraintValues(repair, "payment_items_recurrence_type_check", "recurrence_type").sort();
  assert.deepEqual(formSchedules, schemaSchedules);
  assert.deepEqual(formSchedules, repairSchedules);
  assert.ok(formSchedules.includes("custom_days"));
  assert.match(schema, /recurrence_interval between 1 and 3650/);
  assert.match(repair, /recurrence_interval between 1 and 3650/);
});

test("payment scope and payment methods remain aligned with their database checks", () => {
  assert.deepEqual(
    optionValues("paymentScope").sort(),
    constraintValues(schema, "payment_items_visibility_check", "visibility").sort()
  );
  const recordMethods = optionValues("recordMethod").sort();
  const methodChecks = [...schema.matchAll(/payment_method in \(([^)]*)\)/g)]
    .map((match) => [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]).sort());
  assert.ok(methodChecks.length > 0);
  methodChecks.forEach((allowed) => assert.deepEqual(recordMethods, allowed));
});

test("custom day schedules use exact due dates in records and reminder validation", () => {
  assert.match(app, /item\.recurrence_type === "custom_days"[\s\S]*dailyOccurrenceDatesInMonth/);
  assert.match(app, /const periodStart = explicitDueDate \|\| toDateValue/);
  assert.match(dispatcher, /recurrenceType === "custom_days" \? match\[2\]/);
});

test("a recurrence constraint failure is translated before it reaches the payment form", () => {
  assert.match(app, /payment_items_recurrence_type_check/);
  assert.match(app, /payment_items_recurrence_interval_check/);
  assert.match(app, /selected repeat schedule could not be saved/i);
});
