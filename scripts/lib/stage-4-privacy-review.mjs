// Offline review contract and draft renderer. No SDK, network, publication or provider adapter.
const flowIds = Array.from({length: 14}, (_, n) => `DF${String(n + 1).padStart(2, '0')}`);
const providerIds = Array.from({length: 10}, (_, n) => `TP${String(n + 1).padStart(2, '0')}`);
const requirements = [
  ['OPERATOR_DISCLOSURE', 'PR-R01', 'OWNER_AND_QUALIFIED_REVIEW'],
  ['REGIONAL_OBLIGATIONS', 'PR-R01', 'QUALIFIED_REVIEW'],
  ['CHILDREN_SAFEGUARDS', 'PR-R01', 'HOSTED_AND_QUALIFIED_REVIEW'],
  ['COLLECTION_CHOICES', 'PR-R04', 'HOSTED'],
  ['PRIVACY_REQUESTS', 'PR-R05', 'OWNER_AND_HOSTED'],
  ['DELETION_RETENTION_IMPLEMENTATION', 'PR-R03', 'HOSTED'],
  ['PUBLIC_LINKS', 'PR-R05', 'HOSTED'],
  ['NATIVE_STORE_LABELS', 'PR-R06', 'DEVICE_AND_OWNER'],
];
const invalid = field => { throw new TypeError(`Invalid privacy review field: ${field}`); };
const object = (v, field) => { if (!v || typeof v !== 'object' || Array.isArray(v)) invalid(field); };
const text = (v, field) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 4096 || /[\u0000-\u001f\u007f]/u.test(v)) invalid(field);
};
const bool = (v, field) => { if (typeof v !== 'boolean') invalid(field); };
const choice = (v, values, field) => { if (!values.includes(v)) invalid(field); };
const nullableText = (v, field) => { if (v !== null) text(v, field); };
const strings = (v, field, nonempty = true) => {
  if (!Array.isArray(v) || (nonempty && !v.length)) invalid(field);
  for (const item of v) text(item, field);
};
const refs = (v, field) => {
  strings(v, field, false);
  for (const ref of v) if (!/^[A-Za-z0-9_.][A-Za-z0-9_./#-]*$/u.test(ref) || ref.includes('..')) invalid(field);
};
function exactIds(rows, expected, field) {
  if (!Array.isArray(rows) || rows.length !== expected.length) invalid(field);
  const actual = [];
  for (const row of rows) { object(row, field); actual.push(row.id); }
  if (new Set(actual).size !== expected.length || expected.some(id => !actual.includes(id))) invalid(field);
}
function completion(row, scopeField, requiredScope, field) {
  choice(row.status, ['UNRESOLVED', 'OWNER_ADOPTED', 'VERIFIED_DECLARED'], `${field}.status`);
  refs(row.evidence_refs, `${field}.evidence_refs`);
  if (row.status === 'UNRESOLVED') {
    if (row[scopeField] !== 'NONE') invalid(`${field}.${scopeField}`);
  } else {
    if (!row.evidence_refs.length) invalid(`${field}.evidence_refs`);
    const allowed = row.status === 'OWNER_ADOPTED' ? ['OWNER'] : [requiredScope];
    choice(row[scopeField], allowed, `${field}.${scopeField}`);
  }
}

export function validatePrivacyReview(inventory, decisions) {
  object(inventory, 'inventory'); object(decisions, 'decisions');
  if (inventory.schema_version !== 1 || decisions.schema_version !== 1) invalid('schema_version');
  if (decisions.scope !== 'REVIEW_ONLY_NOT_PUBLIC_NOTICE') invalid('scope');
  for (const [value, field] of [[inventory.source_parent_commit, 'inventory.source_parent_commit'], [decisions.source_parent_commit, 'source_parent_commit']]) {
    if (typeof value !== 'string' || !/^[a-f0-9]{40}$/u.test(value)) invalid(field);
  }
  if (decisions.inventory_source_parent_commit !== inventory.source_parent_commit) invalid('inventory_source_parent_commit');
  exactIds(inventory.data_flow_categories, flowIds, 'inventory.data_flow_categories');
  exactIds(inventory.provider_service_components, providerIds, 'inventory.provider_service_components');
  for (const f of inventory.data_flow_categories) {
    for (const key of ['category', 'purpose', 'destination', 'limit']) text(f[key], `inventory.${f.id}.${key}`);
    strings(f.fields, `inventory.${f.id}.fields`); refs(f.source_refs, `inventory.${f.id}.source_refs`);
    if (!f.source_refs.length) invalid(`inventory.${f.id}.source_refs`);
  }
  for (const p of inventory.provider_service_components) {
    for (const key of ['service', 'status', 'data', 'pending']) text(p[key], `inventory.${p.id}.${key}`);
    refs(p.refs, `inventory.${p.id}.refs`);
  }
  exactIds(decisions.data_decisions, flowIds, 'data_decisions');
  exactIds(decisions.provider_decisions, providerIds, 'provider_decisions');
  exactIds(decisions.assurance_decisions, requirements.map(r => r[0]), 'assurance_decisions');
  for (const d of decisions.data_decisions) {
    completion(d, 'implementation_scope', 'HOSTED', d.id);
    for (const key of ['collection_requirement', 'lawful_ground', 'retention_criteria', 'expiry_rule', 'access_rule', 'decision_ref']) nullableText(d[key], `${d.id}.${key}`);
    if (d.status !== 'UNRESOLVED') {
      choice(d.collection_requirement, ['REQUIRED', 'OPTIONAL', 'MIXED'], `${d.id}.collection_requirement`);
      for (const key of ['lawful_ground', 'retention_criteria', 'expiry_rule', 'access_rule', 'decision_ref']) text(d[key], `${d.id}.${key}`);
    }
  }
  for (const d of decisions.provider_decisions) {
    completion(d, 'configuration_scope', 'OWNER_AND_PROVIDER', d.id);
    for (const key of ['role', 'region_and_transfer_summary', 'contract_ref', 'retention_summary']) nullableText(d[key], `${d.id}.${key}`);
    if (d.status !== 'UNRESOLVED') for (const key of ['role', 'region_and_transfer_summary', 'contract_ref', 'retention_summary']) text(d[key], `${d.id}.${key}`);
  }
  for (const [id, , scope] of requirements) completion(decisions.assurance_decisions.find(r => r.id === id), 'evidence_scope', scope, id);
  object(decisions.owner_facts, 'owner_facts');
  const {operator: o, privacy_contact: c, audience: a, territories: t} = decisions.owner_facts;
  for (const [v, field] of [[o, 'operator'], [c, 'privacy_contact'], [a, 'audience'], [t, 'territories']]) object(v, field);
  text(o.legal_name, 'operator.legal_name'); text(o.country, 'operator.country');
  choice(o.entity_type, ['INDIVIDUAL', 'REGISTERED_BUSINESS'], 'operator.entity_type');
  bool(o.registered_business, 'operator.registered_business');
  if (o.registered_business !== (o.entity_type === 'REGISTERED_BUSINESS')) invalid('operator.registration');
  if (o.status !== 'OWNER_REPORTED') invalid('operator.status');
  if (c.status !== 'OWNER_REPORTED') invalid('privacy_contact.status');
  if (typeof c.email !== 'string' || !/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u.test(c.email)) invalid('privacy_contact.email');
  bool(c.assigned_by_owner, 'privacy_contact.assigned_by_owner');
  bool(c.delivery_and_request_workflow_verified, 'privacy_contact.delivery_and_request_workflow_verified');
  choice(a.age_restriction, ['NONE_OWNER_INTENT', 'MINIMUM_AGE_OWNER_INTENT'], 'audience.age_restriction');
  if (a.status !== 'OWNER_REPORTED_INTENT') invalid('audience.status');
  bool(a.children_possible, 'audience.children_possible'); bool(a.child_safeguards_verified, 'audience.child_safeguards_verified');
  if (a.age_restriction === 'NONE_OWNER_INTENT') {
    if (a.minimum_account_age !== null || a.children_possible !== true) invalid('audience.unrestricted_intent');
  } else if (!Number.isSafeInteger(a.minimum_account_age) || a.minimum_account_age < 1 || a.minimum_account_age > 120) invalid('audience.minimum_account_age');
  if (t.intent !== 'WORLDWIDE_PRIOR_PLAN') invalid('territories.intent');
  bool(t.exclusions_confirmed, 'territories.exclusions_confirmed');
  bool(t.jurisdiction_mapping_approved, 'territories.jurisdiction_mapping_approved');
  strings(t.excluded_countries, 'territories.excluded_countries', false);
  choice(t.status, ['UNCONFIRMED', 'OWNER_REPORTED'], 'territories.status');
  if (t.exclusions_confirmed !== (t.status === 'OWNER_REPORTED')) invalid('territories.confirmation');
  object(decisions.public_notice, 'public_notice');
  if (decisions.public_notice.adopted !== false || decisions.public_notice.published !== false || decisions.public_notice.effective_date !== null) invalid('public_notice.review_only');
  return true;
}

export function assessPrivacyReview(inventory, decisions) {
  validatePrivacyReview(inventory, decisions);
  const blockers = [];
  const add = (code, action, reason) => blockers.push({code, action, reason});
  const {privacy_contact: c, audience: a, territories: t} = decisions.owner_facts;
  if (!c.assigned_by_owner || !c.delivery_and_request_workflow_verified) add('CONTACT_WORKFLOW', 'PR-R05', 'Owner-assigned contact is not verified privacy-request delivery/fulfillment.');
  if (!t.exclusions_confirmed || !t.jurisdiction_mapping_approved) add('TERRITORIES', 'PR-R01', 'Country exclusions or applicable-obligation mapping remain unconfirmed.');
  const childReview = decisions.assurance_decisions.find(r => r.id === 'CHILDREN_SAFEGUARDS');
  if (a.children_possible && (!a.child_safeguards_verified || childReview.status !== 'VERIFIED_DECLARED')) add('CHILDREN', 'PR-R01', 'No-age-restriction intent leaves child data/consent safeguards unresolved.');
  for (const d of decisions.data_decisions) if (d.status !== 'VERIFIED_DECLARED') add(`DATA_${d.id}`, 'PR-R03', 'Collection/grounds/retention/access decision and implementation evidence incomplete.');
  for (const d of decisions.provider_decisions) if (d.status !== 'VERIFIED_DECLARED') add(`PROVIDER_${d.id}`, 'PR-R02', 'Actual provider role, configuration, contract, region/transfer or retention evidence incomplete.');
  for (const [id, action] of requirements) if (decisions.assurance_decisions.find(r => r.id === id).status !== 'VERIFIED_DECLARED') add(id, action, 'Required decision/capability evidence is unresolved or owner-adopted only.');
  // A JSON declaration can never independently prove hosted, legal or device acceptance.
  add('INDEPENDENT_ACCEPTANCE', 'PR-R05', 'Offline declarations require independent owner/hosted/device review; this tool cannot authorize publication.');
  return {status: 'REVIEW_ONLY_PUBLICATION_BLOCKED', publication_allowed: false, hosted_acceptance: false,
    source_data_categories: inventory.data_flow_categories.length, source_service_components: inventory.provider_service_components.length,
    owner_facts_scope: 'OWNER_REPORTED_NOT_INDEPENDENTLY_VERIFIED', blocked_items: blockers,
    unresolved_data_ids: decisions.data_decisions.filter(r => r.status !== 'VERIFIED_DECLARED').map(r => r.id),
    unresolved_provider_ids: decisions.provider_decisions.filter(r => r.status !== 'VERIFIED_DECLARED').map(r => r.id)};
}

// Render all input text as inert Markdown text, including tables and raw HTML syntax.
const md = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/gu, '\\$&');
export function renderPrivacyReview(inventory, decisions) {
  const assessment = assessPrivacyReview(inventory, decisions);
  const {operator: o, privacy_contact: c, audience: a, territories: t} = decisions.owner_facts;
  const out = ['# Mushavo Budget — privacy notice review candidate', '',
    '**REVIEW ONLY — NOT ADOPTED, NOT PUBLISHED, NO EFFECTIVE DATE.**', '',
    'This internal candidate separates owner-reported facts from source observations and unresolved implementation/legal decisions. It is not a customer-facing notice or release approval.', '',
    '## Operator and contact', '',
    `Owner reports the operator as **${md(o.legal_name)}**, based in **${md(o.country)}**. Entity type: ${md(o.entity_type)}; registered business: ${o.registered_business ? 'yes, owner-reported' : 'no, owner-reported'}.`, '',
    `Owner assigns **${md(c.email)}** for privacy requests. Mail delivery, identity verification and actual request fulfillment remain separate evidence requirements.`, '',
    '## Audience and territories', '',
    a.age_restriction === 'NONE_OWNER_INTENT' ? 'Owner intent: no account age restriction. Child accounts/data are possible. This does not certify lawful unrestricted child access or parental-consent safeguards.' : `Owner-intended minimum age: ${a.minimum_account_age}. This is not a deployed age control or child-law determination.`, '',
    `Prior launch intent: worldwide. Country exclusions: ${t.exclusions_confirmed ? (t.excluded_countries.length ? md(t.excluded_countries.join('; ')) : 'owner-confirmed none') : 'UNCONFIRMED; an empty list is not approval of all countries'}. Applicable territory obligations remain subject to review.`, '',
    '## Data and purposes — source observations', '',
    '| ID / category | Source fields | Source purpose / destination | Limitation |',
    '| --- | --- | --- | --- |'];
  for (const f of inventory.data_flow_categories) out.push(`| ${md(f.id)} / ${md(f.category)} | ${md(f.fields.join('; '))} | ${md(f.purpose)} / ${md(f.destination)} | ${md(f.limit)} |`);
  out.push('', 'These source descriptions do not adopt a lawful ground, retention duration, required/optional classification or complete recipient authorization.', '', '## Providers — source and historical evidence', '',
    'Ten components are not ten distinct companies or legal processors. Runtime, historical hosting observations, build dependencies and incomplete backup evidence must retain their separate scope.', '',
    '| ID / component | Observed evidence | Pending facts |', '| --- | --- | --- |');
  for (const p of inventory.provider_service_components) out.push(`| ${md(p.id)} / ${md(p.service)} | ${md(p.status)} / ${md(p.data)} | ${md(p.pending)} |`);
  out.push('', '## Decisions required before a factual public notice', '',
    '- Adopt required/optional collection, purpose/grounds, recipient/access and retention/expiry decisions for every data category; verify the actual implementation.',
    '- Reconcile account-linked analytics and Cloudflare telemetry; do not claim all usage rows are anonymous or that push permission covers unrelated processing.',
    '- Resolve child-data consent/safeguards and accurate target-audience declarations; no adult-only rule or universal child-consent exemption is invented.',
    '- Verify current provider settings, contracts, regions/transfers, mail and log/backup lifetimes.',
    '- Verify privacy-request identity/fulfillment and deletion/shared-file/backup behavior; downloaded or printed copies cannot be promised automatic recall.',
    '- Prepare legally sufficient operator disclosures, factual terms/support/deletion resources and consistent accessible links; inspect final native SDKs/store data labels.', '',
    '## Publication blockers', '', '| Code | Action | Required evidence |', '| --- | --- | --- |');
  for (const b of assessment.blocked_items) out.push(`| ${md(b.code)} | ${md(b.action)} | ${md(b.reason)} |`);
  out.push('', 'No public policy, legal compliance, universal sharing/tracking classification, deployed security/consent/retention/deletion feature, email verification, store acceptance or fixed rights-response deadline is established by this internal draft.', '',
    'Stage 4.3.3 records one owner/hosted outcome or BLOCKED. Full Stage 4 report remains due at 4.4.');
  return out.join('\n') + '\n';
}
