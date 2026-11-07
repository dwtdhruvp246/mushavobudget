import {randomBytes} from 'node:crypto';
import {gatewayFromEnvironment, STAGING_PROJECT, STAGING_ORIGIN} from '../../supabase/functions/_shared/email-verification-gateway.mjs';
import {isSingleMailbox} from '../../supabase/functions/_shared/email-verification-zoho.mjs';
export const packetStage = 'FR.2.4.E5.4_PRIVATE_CREDENTIAL_PACKET';
export const packetProblems = Object.freeze(['LOCAL_PRIVATE_INPUT_REVIEW_REQUIRED','PUBLISHABLE_KEY_FORMAT_REQUIRED',
  'MODERN_SECRET_KEY_FORMAT_REQUIRED','RETAINED_PUBLIC_KEY_MISMATCH']);
const ordinary = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => ordinary(x) && Object.keys(x).sort().join(',') === keys.slice().sort().join(',');
const need = (condition, code='LOCAL_PRIVATE_INPUT_REVIEW_REQUIRED') => {if (!condition) throw Object.assign(new Error(code), {packetCode:code});};
const oldZIP = '33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1';
export function preparePrivatePacket(input, {entropy = randomBytes, now = () => new Date().toISOString()} = {}) {
  need(exact(input, ['publishableKey','secretKey','zoho','recipients','configuration','expectedWorkerSHA']));
  need(typeof input.publishableKey === 'string' && /^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(input.publishableKey), 'PUBLISHABLE_KEY_FORMAT_REQUIRED');
  need(typeof input.secretKey === 'string' && /^sb_secret_[A-Za-z0-9_-]{1,4096}$/.test(input.secretKey), 'MODERN_SECRET_KEY_FORMAT_REQUIRED');
  need(typeof input.expectedWorkerSHA === 'string' && /^[a-f0-9]{64}$/.test(input.expectedWorkerSHA)
    && input.expectedWorkerSHA !== 'fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99');
  need(typeof input.configuration === 'string' && Buffer.byteLength(input.configuration, 'utf8') <= 16384);
  const match = input.configuration.replace(/^\uFEFF/, '').match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  need(match); let config; try {config = JSON.parse(match[1]);} catch {need(false);}
  need(exact(config, ['supabaseUrl','supabasePublishableKey','vapidPublicKey']) &&
    config.supabaseUrl === 'https://' + STAGING_PROJECT + '.supabase.co' && config.vapidPublicKey === '');
  need(config.supabasePublishableKey === input.publishableKey, 'RETAINED_PUBLIC_KEY_MISMATCH');
  const z = input.zoho;
  need(exact(z, ['schema_version','purpose','accountsOrigin','mailOrigin','clientId','clientSecret','refreshToken','from','accountId','account_verified']));
  need(z.schema_version === 1 && z.purpose === 'MUSHAVO_STAGING_ZOHO_SENDER_ONLY' && z.account_verified === true &&
    z.accountsOrigin === 'https://accounts.zoho.com' && z.mailOrigin === 'https://mail.zoho.com' &&
    z.from === 'notifications@mushavobudget.com' && typeof z.accountId === 'string' && /^[0-9]{1,32}$/.test(z.accountId));
  need(Array.isArray(input.recipients) && input.recipients.length >= 1 && input.recipients.length <= 10 && input.recipients.every(isSingleMailbox));
  const recipients = input.recipients.map(x => x.toLowerCase()); need(new Set(recipients).size === recipients.length);
  const code = entropy(32), rate = entropy(32);
  need(code instanceof Uint8Array && rate instanceof Uint8Array && code.length === 32 && rate.length === 32);
  const codeHex = Buffer.from(code).toString('hex'), rateHex = Buffer.from(rate).toString('hex'); need(codeHex !== rateHex);
  const env = {EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY', EMAIL_GATE_PROJECT:STAGING_PROJECT, EMAIL_GATE_ORIGIN:STAGING_ORIGIN,
    EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:codeHex}), EMAIL_GATE_KEY_VERSION:'v1', EMAIL_GATE_RATE_PEPPER:rateHex,
    SUPABASE_PUBLISHABLE_KEY:input.publishableKey, SUPABASE_SERVICE_ROLE_KEY:input.secretKey,
    ZOHO_MAIL_ORIGIN:z.mailOrigin, ZOHO_ACCOUNTS_ORIGIN:z.accountsOrigin, ZOHO_ACCOUNT_ID:z.accountId,
    ZOHO_FROM_ADDRESS:z.from, ZOHO_CLIENT_ID:z.clientId, ZOHO_CLIENT_SECRET:z.clientSecret, ZOHO_REFRESH_TOKEN:z.refreshToken,
    ZOHO_TEST_RECIPIENTS_JSON:JSON.stringify(recipients)};
  // Validate the actual gateway constructor without invoking a handler or any transport.
  gatewayFromEnvironment({...env, EMAIL_GATE_RATE_LIMITER:{limit(){throw Error('NO_TRANSPORT');}}}, async () => {throw Error('NO_TRANSPORT');});
  const private_configuration = {schema_version:1, purpose:'MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY',
    project:STAGING_PROJECT, origin:STAGING_ORIGIN, created_UTC:now(),
    expected_modern_Pages_Worker_SHA256:input.expectedWorkerSHA,
    retained_ZIP_configuration_baseline_SHA256:oldZIP, retained_ZIP_is_configuration_source_only:true,
    requires_new_reviewed_Worker_upload:true, env};
  return {receipt:{stage_step:packetStage, result:'PRIVATE_PACKET_VALUES_VALIDATED_FOR_PARENT_ENCRYPTION_ONLY',
    configured_variable_count:16, test_recipient_count:recipients.length, retained_public_key_matches_input:true,
    modern_key_formats_validated:true, retained_Zoho_snapshot_metadata_validated:true,
    independent_code_and_rate_peppers_generated:true, actual_gateway_constructor_validated:true,
    Supabase_key_ownership_independently_verified:false, live_provider_credentials_or_delivery_verified:false,
    actual_hosted_requests:0, email_dispatched:false, hosted_acceptance:false, exit_code:0}, private_configuration};
}
