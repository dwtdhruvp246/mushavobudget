import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectPagesBaseline, summarizeChannel, requiredVariables} from './inspect-fr-2-email-pages.mjs';

export const STAGE = 'FR.2.4.E5.3_EXACT_PAGES_DATE';
export const REVIEWED_DATE = '2026-07-01';
const CHANNELS = ['production', 'preview'];
const PROJECT = 'mushavo-budget-staging';
const markerNames = ['EMAIL_GATE_MODE', 'EMAIL_GATE_PROJECT', 'EMAIL_GATE_ORIGIN'];
const MAX_BODY = 2097152;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const codes = new Set(['BASELINE_REVIEW_REQUIRED', 'PUBLIC_SETTINGS_PREREQUISITES_REQUIRED',
  'STATIC_DEPLOYMENT_PREREQUISITE_REQUIRED', 'UNMANAGED_CONFIGURATION_REQUIRED',
  'HTTP_DATE_UPDATE_REVIEW_REQUIRED', 'DATE_RESPONSE_TYPE_REVIEW_REQUIRED',
  'DATE_RESPONSE_TOO_LARGE', 'DATE_RESPONSE_JSON_REVIEW_REQUIRED',
  'DATE_API_ENVELOPE_REVIEW_REQUIRED', 'DATE_READBACK_PROJECT_MISMATCH',
  'DATE_READBACK_REVIEW_REQUIRED', 'CHANNEL_SETTINGS_DRIFT_REVIEW_REQUIRED',
  'PROJECT_METADATA_DRIFT_REVIEW_REQUIRED']);
function need(condition, code) { if (!condition) throw Object.assign(new Error(code), {dateCode: code}); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
export function exactDatePayload() {
  return {deployment_configs: {production: {compatibility_date: REVIEWED_DATE}, preview: {compatibility_date: REVIEWED_DATE}}};
}
function withoutDates(configs) {
  const result = structuredClone(configs);
  for (const key of CHANNELS) delete result[key].compatibility_date;
  return result;
}
function selectedProject(project) {
  const keys = ['id', 'name', 'subdomain', 'production_branch', 'source', 'build_config',
    'canonical_deployment', 'latest_deployment', 'domains'];
  return Object.fromEntries(keys.filter(key => own(project, key)).map(key => [key, project[key]]));
}
async function boundedJSON(response) {
  need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || ''), 'DATE_RESPONSE_TYPE_REVIEW_REQUIRED');
  const reader = response.body?.getReader();
  need(reader, 'DATE_RESPONSE_JSON_REVIEW_REQUIRED');
  let size = 0; const parts = [];
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength; need(size <= MAX_BODY, 'DATE_RESPONSE_TOO_LARGE'); parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { need(false, 'DATE_RESPONSE_JSON_REVIEW_REQUIRED'); }
}
function accepted(body) {
  return object(body) && body.success === true &&
    (body.errors === null || (Array.isArray(body.errors) && body.errors.length === 0));
}
function ready(channel) {
  return channel.configuration_metadata_reported && channel.fail_open === false &&
    channel.always_use_latest_compatibility_date === false && channel.environment_entry_count === 3 &&
    channel.required_variables.length === requiredVariables.length && channel.required_variables.every(row =>
      row.state === (markerNames.includes(row.name) ? 'PLAIN_TEXT' : 'ABSENT')) &&
    channel.non_secret_staging_markers.every(row => row.state === 'MATCH') &&
    channel.limiter_binding === 'MATCH' && channel.other_Durable_Object_binding_count === 0;
}
export async function setExactPagesDate(input, {transport = fetch, artifactCheck} = {}) {
  const r = {stage_step: STAGE, result: 'EXACT_PAGES_DATE_REVIEW_REQUIRED', requests_attempted: 0,
    local_44_file_review_artifact_unchanged: false, fresh_four_endpoint_baseline_passed: false,
    public_settings_prerequisites_passed: false, date_only_payload_verified: false,
    date_patch_attempted: false, date_patch_HTTP_accepted: false,
    fresh_channel_readback_verified: false, all_observed_channel_settings_except_date_compared_unchanged: false,
    selected_project_source_build_and_deployment_metadata_compared_unchanged: false,
    both_reviewed_dates_verified: false, no_write_needed: false, remote_state_may_require_review: false,
    reviewed_compatibility_date: REVIEWED_DATE, channels: [], samples: [],
    concurrent_configuration_changes_excluded: false, raw_responses_values_hashes_identifiers_or_credentials_printed: false,
    token_saved_to_disk_or_environment: false, Zoho_file_accessed: false,
    email_or_provider_dispatch_attempted: false, upload_or_redeployment_attempted: false,
    SQL_or_Auth_requests: 0, gateway_configuration_ready_verified: false, live_activation_approved: false,
    hosted_acceptance: false, findings_closed: [], production_or_native_changed: false, APK_update_deferred: true,
    checkpoint: 'FRESH_BASELINE', problem_code: null, exit_code: 1};
  let before;
  async function countedTransport(url, init) {
    r.requests_attempted++;
    const response = await transport(url, init);
    // Capture only the already bounded first project response in private RAM; never persist it.
    if (r.requests_attempted === 1 && response.status === 200 && init.method === 'GET') {
      const body = await boundedJSON(response); before = body.result;
      return new Response(JSON.stringify(body), {status: 200, headers: {'content-type': 'application/json'}});
    }
    return response;
  }
  try {
    const baseline = await inspectPagesBaseline(input, {transport: countedTransport, ...(artifactCheck ? {artifactCheck} : {})});
    r.samples = baseline.samples; r.local_44_file_review_artifact_unchanged = baseline.local_44_file_review_artifact_unchanged;
    need(baseline.exit_code === 0, 'BASELINE_REVIEW_REQUIRED'); r.fresh_four_endpoint_baseline_passed = true;
    r.checkpoint = 'PUBLIC_SETTINGS_PREREQUISITES';
    need(baseline.channels.length === 2 && baseline.channels.every(ready), 'PUBLIC_SETTINGS_PREREQUISITES_REQUIRED');
    need(before?.canonical_deployment?.uses_functions === false && before.source == null, 'STATIC_DEPLOYMENT_PREREQUISITE_REQUIRED');
    need(CHANNELS.every(key => object(before.deployment_configs[key]) &&
      /^\d{4}-\d{2}-\d{2}$/.test(before.deployment_configs[key].compatibility_date) &&
      !before.deployment_configs[key].wrangler_config_hash), 'UNMANAGED_CONFIGURATION_REQUIRED');
    r.public_settings_prerequisites_passed = true;
    const originalSettings = withoutDates(before.deployment_configs);
    const originalProject = structuredClone(selectedProject(before));
    const namespace = before.deployment_configs.production.durable_object_namespaces.EMAIL_GATE_LIMITER_NS.namespace_id;
    let after = before;
    if (CHANNELS.every(key => before.deployment_configs[key].compatibility_date === REVIEWED_DATE)) {
      r.no_write_needed = true;
    } else {
      const payload = exactDatePayload();
      need(JSON.stringify(payload) === '{"deployment_configs":{"production":{"compatibility_date":"2026-07-01"},"preview":{"compatibility_date":"2026-07-01"}}}', 'DATE_READBACK_REVIEW_REQUIRED');
      r.date_only_payload_verified = true;
      const endpoint = 'https://api.cloudflare.com/client/v4/accounts/' + input.account + '/pages/projects/' + PROJECT;
      async function request(label, method, body) {
        r.checkpoint = label;
        const sample = {endpoint: label, http_status: null, JSON_received: false}; r.samples.push(sample);
        const response = await countedTransport(endpoint, {method, redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: {Authorization: 'Bearer ' + input.token, Accept: 'application/json', ...(body ? {'Content-Type': 'application/json'} : {})},
          ...(body ? {body: JSON.stringify(body)} : {})});
        sample.http_status = response.status;
        if (response.status !== 200) { await response.body?.cancel(); need(false, 'HTTP_DATE_UPDATE_REVIEW_REQUIRED'); }
        const value = await boundedJSON(response); sample.JSON_received = true;
        need(accepted(value), 'DATE_API_ENVELOPE_REVIEW_REQUIRED'); return value;
      }
      r.date_patch_attempted = true; r.remote_state_may_require_review = true;
      await request('EXACT_DATE_PATCH', 'PATCH', payload); r.date_patch_HTTP_accepted = true;
      after = (await request('POST_PATCH_PROJECT_READBACK', 'GET')).result;
    }
    r.checkpoint = 'COMPARE_FRESH_SETTINGS';
    need(after?.name === PROJECT && after.subdomain === PROJECT + '.pages.dev', 'DATE_READBACK_PROJECT_MISMATCH');
    need(object(after.deployment_configs) && CHANNELS.every(key =>
      after.deployment_configs[key]?.compatibility_date === REVIEWED_DATE), 'DATE_READBACK_REVIEW_REQUIRED');
    r.both_reviewed_dates_verified = true;
    need(same(originalSettings, withoutDates(after.deployment_configs)), 'CHANNEL_SETTINGS_DRIFT_REVIEW_REQUIRED');
    r.all_observed_channel_settings_except_date_compared_unchanged = true;
    need(same(originalProject, selectedProject(after)), 'PROJECT_METADATA_DRIFT_REVIEW_REQUIRED');
    r.selected_project_source_build_and_deployment_metadata_compared_unchanged = true;
    r.channels = CHANNELS.map(key => {
      const c = summarizeChannel(after.deployment_configs[key], key.toUpperCase() + '_CHANNEL_OF_STAGING_PAGES_PROJECT', namespace);
      need(ready(c), 'DATE_READBACK_REVIEW_REQUIRED');
      return {environment: c.environment, compatibility_date_matches_reviewed: c.compatibility_date_matches_reviewed,
        fail_open: c.fail_open, always_use_latest_compatibility_date: c.always_use_latest_compatibility_date,
        three_staging_markers_match: c.non_secret_staging_markers.every(row => row.state === 'MATCH'), limiter_binding: c.limiter_binding};
    });
    r.fresh_channel_readback_verified = true; r.remote_state_may_require_review = false;
    r.result = r.no_write_needed ? 'EXACT_PAGES_DATES_ALREADY_MATCH_SCOPED_PASS_NOT_ROLLOUT_ACCEPTANCE' :
      'EXACT_PAGES_DATES_SET_AND_READ_BACK_SCOPED_PASS_NOT_ROLLOUT_ACCEPTANCE';
    r.checkpoint = 'COMPLETE'; r.exit_code = 0;
  } catch (error) { r.problem_code = codes.has(error?.dateCode) ? error.dateCode : 'LOCAL_OR_DATE_UPDATE_REVIEW_REQUIRED'; }
  r.checked_UTC = new Date().toISOString(); return r;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let input;
  try { let size = 0; const parts = []; for await (const part of process.stdin) {
    size += part.length; if (size > 16384) throw Error(); parts.push(part);
  } input = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { input = null; }
  const receipt = await setExactPagesDate(input); console.log(JSON.stringify(receipt, null, 2)); process.exitCode = receipt.exit_code;
}
