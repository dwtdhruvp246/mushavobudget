// REVIEW MODEL ONLY. Imported by offline tests, never by app/Edge/native code.
// The injected adapter is synthetic. It does not authenticate provider events,
// verify signatures/receipts, or supply a durable ledger/CAS transaction.
const providers = new Set(['google_play', 'apple_app_store']);
const states = new Set(['active', 'canceled_paid', 'pending', 'hold', 'expired', 'revoked']);
const own = (o, k) => Object.hasOwn(o, k);
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(name);
}
function text(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) throw Error(name);
}
function integer(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw Error(name);
}
function sameBinding(a, b) {
  return ['provider', 'environment', 'application', 'account', 'workspace', 'intent']
    .every(k => a[k] === b[k]);
}
function validateBinding(binding) {
  object(binding, 'binding');
  for (const k of ['provider', 'environment', 'application', 'account', 'workspace', 'intent']) text(binding[k], k);
  if (!providers.has(binding.provider) || !['sandbox', 'production'].includes(binding.environment)) throw Error('provider/environment');
}
function validateSnapshot(snapshot, binding, catalog) {
  object(snapshot, 'snapshot');
  if (!sameBinding(snapshot, binding)) throw Error('snapshot binding');
  for (const k of ['chain', 'transaction', 'product']) text(snapshot[k], k);
  integer(snapshot.sequence, 'synthetic snapshot sequence', 1);
  // Sequence is an adapter fixture convention, NOT a provider timestamp/event ID.
  integer(snapshot.startsAt, 'startsAt'); integer(snapshot.endsAt, 'endsAt');
  if (snapshot.endsAt <= snapshot.startsAt) throw Error('term');
  if (!states.has(snapshot.state)) throw Error('state needs approved adapter mapping');
  if (!Array.isArray(catalog)) throw Error('synthetic catalog');
  const matches = catalog.filter(p => p.provider === binding.provider &&
    p.environment === binding.environment && p.application === binding.application && p.product === snapshot.product);
  if (matches.length !== 1) throw Error('unknown/ambiguous product');
  const product = matches[0];
  if (!['personal', 'family', 'business'].includes(product.plan) || !['monthly', 'annual'].includes(product.cycle)) throw Error('product mapping');
  integer(product.seats, 'seats', 1);
  return {plan: product.plan, cycle: product.cycle, seats: product.seats};
}
const fingerprint = s => JSON.stringify(['provider', 'environment', 'application', 'account', 'workspace', 'intent',
  'chain', 'transaction', 'product', 'startsAt', 'endsAt', 'state'].map(k => s[k]));

// binding/catalog/prior belong to the imagined server, never the client request.
// Caller must persist a returned proposal with a real transactional revision and
// unique chain ownership check. This function performs neither operation.
export async function proposeSnapshot({request, binding, catalog, prior = null, expectedRevision}, adapter) {
  object(request, 'request');
  if (Object.keys(request).length !== 1 || !own(request, 'proofReference')) throw Error('client authority fields');
  text(request.proofReference, 'proofReference'); validateBinding(binding);
  integer(expectedRevision, 'expectedRevision');
  if (typeof adapter !== 'function') throw Error('verifier adapter unavailable');
  if (prior !== null) {
    object(prior, 'prior'); integer(prior.revision, 'revision', 1);
    validateSnapshot(prior.snapshot, binding, catalog);
    if (prior.revision !== expectedRevision) throw Error('revision conflict');
  } else if (expectedRevision !== 0) throw Error('revision conflict');
  // Do not pass a mutable binding or catalog object into the adapter.
  const snapshot = structuredClone(await adapter(Object.freeze({proofReference: request.proofReference, ...binding})));
  const product = validateSnapshot(snapshot, binding, catalog);
  if (prior) {
    if (prior.snapshot.chain !== snapshot.chain) throw Error('chain transfer needs approved policy');
    if (snapshot.sequence < prior.snapshot.sequence) return {outcome: 'STALE', record: structuredClone(prior)};
    if (snapshot.sequence === prior.snapshot.sequence && fingerprint(snapshot) !== fingerprint(prior.snapshot)) throw Error('conflicting snapshot');
    if (fingerprint(snapshot) === fingerprint(prior.snapshot)) {
      // Refreshing the same paid window cannot add time. Preserve the high-water
      // sequence, so a delayed intervening snapshot cannot replace this state.
      const record = structuredClone(prior);
      if (snapshot.sequence > record.snapshot.sequence) { record.snapshot.sequence = snapshot.sequence; record.revision++; }
      return {outcome: 'UNCHANGED', record};
    }
  }
  return {outcome: 'PROPOSED', record: {revision: expectedRevision + 1,
    snapshot, product, source: 'SYNTHETIC_ADAPTER_STORE_SNAPSHOT'}};
}

// Projection never writes finance rows, manual grants, subscription dates or
// seats. Cross-source precedence is deliberately a pending product decision.
export function projectAccess(record, manual, {now, suspended = false}) {
  integer(now, 'now');
  if (typeof suspended !== 'boolean') throw Error('suspended');
  if (manual !== null && manual !== undefined) {
    object(manual, 'manual'); integer(manual.startsAt, 'manual startsAt'); integer(manual.endsAt, 'manual endsAt');
    if (manual.endsAt <= manual.startsAt) throw Error('manual term');
  }
  if (record !== null && record !== undefined) {
    object(record, 'record'); validateBinding(record.snapshot);
    validateSnapshot(record.snapshot, record.snapshot, [{...record.snapshot, ...record.product}]);
  }
  if (suspended) return {outcome: 'SUSPENDED', access: false};
  const storeActive = !!record && ['active', 'canceled_paid'].includes(record.snapshot.state) &&
    record.snapshot.startsAt <= now && now < record.snapshot.endsAt;
  const manualActive = !!manual && manual.startsAt <= now && now < manual.endsAt;
  if (storeActive && manualActive) return {outcome: 'REVIEW_SOURCE_PRECEDENCE', access: null};
  if (storeActive) return {outcome: 'STORE_MODEL', access: true, ...structuredClone(record.product), endsAt: record.snapshot.endsAt};
  if (manualActive) return {outcome: 'EXISTING_MANUAL_SOURCE', access: true};
  return {outcome: 'NO_ACTIVE_SOURCE', access: false};
}
