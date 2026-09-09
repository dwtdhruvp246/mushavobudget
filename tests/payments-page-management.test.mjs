import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, source, styles] = await Promise.all([
  readFile(new URL("../app.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8")
]);

test("Payments provides search and sort controls without changing the data model", () => {
  assert.match(html, /id="paymentSearch"[^>]*type="search"/);
  assert.match(html, /id="paymentSort"/);
  assert.match(html, /value="due_soonest"/);
  assert.match(source, /paymentItemSearchText\(item\)/);
  assert.match(source, /comparePaymentItems\(left, right, occurrenceChoices\)/);
  assert.match(source, /item\.category[\s\S]*item\.currency[\s\S]*member\?\.name[\s\S]*recurrenceLabel\(item\)/);
  assert.doesNotMatch(source, /from\(["']payment_item_history["']\)/);
});
test("each payment card exposes the agreed responsive action set", () => {
  assert.match(source, /data-record-payment-item="\$\{item\.id\}"/);
  assert.match(source, /data-open-payment-history="\$\{item\.id\}"/);
  assert.match(source, /data-edit-obligation="\$\{item\.id\}"/);
  assert.match(source, /class="payment-more-menu"/);
  assert.match(source, /data-toggle-obligation="\$\{item\.id\}"/);
  assert.match(source, /data-delete-obligation="\$\{item\.id\}"/);
  assert.match(source, /recordDisabled = workspaceReadOnly \|\| isPaused \|\| !occurrence/);
});

test("record payment selects a real outstanding occurrence", () => {
  assert.match(html, /id="recordPaymentPeriod"/);
  assert.match(source, /function recordableOccurrencesForItem\(item\)/);
  assert.match(source, /occurrence\.outstanding > 0\.00005/);
  assert.match(source, /function preferredRecordOccurrence\(choices\)/);
  assert.match(source, /function applyRecordPaymentOccurrence\(occurrence\)/);
  assert.match(source, /state\.recordPaymentOccurrenceChoices\.find/);
});

test("History is scoped to one payment and retains proof and delete actions", () => {
  assert.match(html, /id="paymentHistoryDialog"/);
  assert.match(source, /filter\(\(record\) => record\.payment_item_id === item\.id\)/);
  assert.match(source, /paymentHistoryRecordStatus\(record, item\)/);
  assert.match(source, /data-open-proof="\$\{record\.id\}"/);
  assert.match(source, /data-delete-record="\$\{record\.id\}"/);
  assert.match(source, /if \(openHistoryItemId && \$\("#paymentHistoryDialog"\)\.open\) renderPaymentHistory\(\)/);
});

test("mobile Payments cards and History use compact adaptive grids", () => {
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.payment-search-panel\.mobile-collapsed\s*\{\s*display: none;/);
  assert.match(styles, /\.payments-list-panel \.payment-management-card \.payment-card-actions\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.payment-history-summary\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.payment-history-record-actions\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*\.payment-list-toolbar\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
});
