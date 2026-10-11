import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessPrivacyReview, validatePrivacyReview, renderPrivacyReview} from '../scripts/lib/stage-4-privacy-review.mjs';
const inventory = JSON.parse(await readFile(new URL('../docs/security-audit/security-stage-4-privacy-source-inventory.json', import.meta.url), 'utf8'));
const decisions = JSON.parse(await readFile(new URL('../docs/security-audit/security-stage-4-privacy-decisions.json', import.meta.url), 'utf8'));
const storedDraft = await readFile(new URL('../docs/security-audit/SECURITY_STAGE_4_3_PRIVACY_NOTICE_REVIEW_DRAFT.md', import.meta.url), 'utf8');
const clone = v => structuredClone(v);
const codes = result => result.blocked_items.map(r => r.code);
function rejected(name, mutate) {
  test(name, () => { const i = clone(inventory), d = clone(decisions); mutate(i, d); assert.throws(() => assessPrivacyReview(i, d), TypeError); });
}
function adoptedData(row, status = 'OWNER_ADOPTED') {
  Object.assign(row, {status, collection_requirement: 'MIXED', lawful_ground: 'TEST-ONLY ground', retention_criteria: 'TEST-ONLY criteria', expiry_rule: 'TEST-ONLY expiry', access_rule: 'TEST-ONLY scope', decision_ref: 'TEST-ONLY-decision', implementation_scope: status === 'OWNER_ADOPTED' ? 'OWNER' : 'HOSTED', evidence_refs: ['TEST-ONLY-EVIDENCE']});
}
test('current owner facts are distinguished from verified capabilities', () => {
  const r = assessPrivacyReview(inventory, decisions);
  assert.equal(decisions.owner_facts.operator.legal_name, 'Dhruv Parekh');
  assert.equal(decisions.owner_facts.operator.registered_business, false);
  assert.equal(decisions.owner_facts.privacy_contact.email, 'support@mushavobudget.com');
  assert.equal(r.owner_facts_scope, 'OWNER_REPORTED_NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(r.publication_allowed, false); assert.equal(r.hosted_acceptance, false);
});
test('every source data category and provider has an unresolved decision', () => {
  const r = assessPrivacyReview(inventory, decisions);
  assert.equal(r.unresolved_data_ids.length, 14); assert.equal(r.unresolved_provider_ids.length, 10);
  for (const f of inventory.data_flow_categories) assert.ok(codes(r).includes(`DATA_${f.id}`));
  for (const p of inventory.provider_service_components) assert.ok(codes(r).includes(`PROVIDER_${p.id}`));
});
test('unrestricted-age intent preserves child safeguards blocker without inventing minimum age', () => {
  assert.equal(decisions.owner_facts.audience.minimum_account_age, null);
  assert.ok(codes(assessPrivacyReview(inventory, decisions)).includes('CHILDREN'));
  assert.match(renderPrivacyReview(inventory, decisions), /no account age restriction/);
});
test('empty unconfirmed territory list is not a confirmed worldwide release', () => {
  assert.deepEqual(decisions.owner_facts.territories.excluded_countries, []);
  assert.ok(codes(assessPrivacyReview(inventory, decisions)).includes('TERRITORIES'));
  assert.match(storedDraft, /empty list is not approval of all countries/);
});
test('assigned support email alone cannot clear privacy fulfillment', () => {
  assert.ok(codes(assessPrivacyReview(inventory, decisions)).includes('CONTACT_WORKFLOW'));
  assert.ok(codes(assessPrivacyReview(inventory, decisions)).includes('PRIVACY_REQUESTS'));
});
rejected('unknown schema fails closed', (_, d) => { d.schema_version = 2; });
rejected('non-review scope cannot be processed as an adopted policy', (_, d) => { d.scope = 'PUBLIC_NOTICE'; });
rejected('stale inventory pin is rejected', (_, d) => { d.inventory_source_parent_commit = '0'.repeat(40); });
rejected('missing data category is rejected', (i) => { i.data_flow_categories.pop(); });
rejected('duplicate data category is rejected', (i) => { i.data_flow_categories[0] = i.data_flow_categories[1]; });
rejected('unknown provider component is rejected', (i) => { i.provider_service_components[0].id = 'TP99'; });
rejected('missing source data decision is rejected', (_, d) => { d.data_decisions.pop(); });
rejected('duplicate decision cannot conceal uncovered data', (_, d) => { d.data_decisions[0].id = 'DF02'; });
rejected('missing provider decision is rejected', (_, d) => { d.provider_decisions.pop(); });
rejected('missing child requirement is rejected', (_, d) => { d.assurance_decisions = d.assurance_decisions.filter(r => r.id !== 'CHILDREN_SAFEGUARDS'); });
rejected('invalid email cannot become the privacy contact', (_, d) => { d.owner_facts.privacy_contact.email = 'support@example.com\nBcc: hidden'; });
rejected('operator registration contradiction is rejected', (_, d) => { d.owner_facts.operator.registered_business = true; });
rejected('owner statement cannot be silently promoted to verified identity', (_, d) => { d.owner_facts.operator.status = 'VERIFIED'; });
rejected('no restriction cannot silently hide child accounts', (_, d) => { d.owner_facts.audience.children_possible = false; });
rejected('no restriction cannot silently impose age 18', (_, d) => { d.owner_facts.audience.minimum_account_age = 18; });
rejected('string true cannot clear contact workflow', (_, d) => { d.owner_facts.privacy_contact.delivery_and_request_workflow_verified = 'true'; });
rejected('territory status must agree with explicit confirmation', (_, d) => { d.owner_facts.territories.status = 'OWNER_REPORTED'; });
rejected('owner-adopted data decision cannot omit retention criteria', (_, d) => { adoptedData(d.data_decisions[0]); d.data_decisions[0].retention_criteria = null; });
rejected('verified declaration cannot omit evidence', (_, d) => { adoptedData(d.data_decisions[0], 'VERIFIED_DECLARED'); d.data_decisions[0].evidence_refs = []; });
rejected('source-only data metadata cannot be declared hosted implementation', (_, d) => { adoptedData(d.data_decisions[0], 'VERIFIED_DECLARED'); d.data_decisions[0].implementation_scope = 'SOURCE'; });
rejected('unknown collection-choice classification is rejected', (_, d) => { adoptedData(d.data_decisions[0]); d.data_decisions[0].collection_requirement = 'NO_DATA_COLLECTED'; });
rejected('private/token URL is not an audit evidence reference', (_, d) => { d.data_decisions[0].evidence_refs = ['https://example.test/?token=private']; });
rejected('review artifact cannot gain an effective date', (_, d) => { d.public_notice.effective_date = '2026-10-11'; });
rejected('review artifact cannot claim policy adoption', (_, d) => { d.public_notice.adopted = true; });
rejected('review artifact cannot claim publication', (_, d) => { d.public_notice.published = true; });
test('owner adoption alone still blocks category implementation', () => {
  const d = clone(decisions); adoptedData(d.data_decisions[0]);
  assert.ok(codes(assessPrivacyReview(inventory, d)).includes('DATA_DF01'));
});
test('declared hosted completion cannot authorize publication', () => {
  const d = clone(decisions); adoptedData(d.data_decisions[0], 'VERIFIED_DECLARED');
  const r = assessPrivacyReview(inventory, d);
  assert.ok(!codes(r).includes('DATA_DF01')); assert.ok(codes(r).includes('INDEPENDENT_ACCEPTANCE'));
  assert.equal(r.publication_allowed, false); assert.equal(r.hosted_acceptance, false);
});
for (const id of ['CHILDREN_SAFEGUARDS', 'COLLECTION_CHOICES', 'PRIVACY_REQUESTS', 'DELETION_RETENTION_IMPLEMENTATION', 'PUBLIC_LINKS', 'NATIVE_STORE_LABELS']) {
  rejected(`offline checks cannot clear ${id}`, (_, d) => {
    Object.assign(d.assurance_decisions.find(r => r.id === id), {status: 'VERIFIED_DECLARED', evidence_scope: 'LOCAL', evidence_refs: ['TEST-ONLY-EVIDENCE']});
  });
}
test('changing age intent does not implement a hosted age gate', () => {
  const d = clone(decisions);
  Object.assign(d.owner_facts.audience, {age_restriction: 'MINIMUM_AGE_OWNER_INTENT', minimum_account_age: 18, children_possible: false});
  const r = assessPrivacyReview(inventory, d);
  assert.ok(codes(r).includes('CHILDREN_SAFEGUARDS')); assert.equal(r.publication_allowed, false);
});
test('stored draft exactly matches current inventory and decision rendering', () => {
  assert.equal(renderPrivacyReview(inventory, decisions), storedDraft);
});
test('HTML/link/table markup in owner input renders as inert text', () => {
  const d = clone(decisions); d.owner_facts.operator.legal_name = '<script>alert(1)</script>|[secret](https://evil.test)';
  const rendered = renderPrivacyReview(inventory, d);
  assert.ok(!rendered.includes('<script>')); assert.ok(!rendered.includes('[secret]('));
  assert.ok(rendered.includes('&lt;script&gt;')); assert.ok(rendered.includes('\\|'));
});
test('review never adds blanket privacy/security/deletion promises', () => {
  for (const unsupported of ['we collect no usage data', 'we collect no payment data', 'we delete all copies immediately', 'we are fully compliant']) assert.ok(!storedDraft.toLowerCase().includes(unsupported));
  assert.match(storedDraft, /account\-linked analytics/); assert.match(storedDraft, /NOT ADOPTED, NOT PUBLISHED/);
});
test('assessment and rendering do not mutate owner or source records', () => {
  const i = clone(inventory), d = clone(decisions), before = JSON.stringify([i, d]);
  assert.equal(validatePrivacyReview(i, d), true); assessPrivacyReview(i, d); renderPrivacyReview(i, d);
  assert.equal(JSON.stringify([i, d]), before);
});
