import {upstreamJSON} from '../../supabase/functions/_shared/email-verification-http.mjs';
import {isSingleMailbox} from '../../supabase/functions/_shared/email-verification-zoho.mjs';

export const requiredScopes = ['ZohoMail.accounts.READ', 'ZohoMail.messages.CREATE'];
const tokenPattern = /^[A-Za-z0-9._-]{8,4096}$/;
const safeCodes = new Set(['LOCAL_INPUT_INVALID','OAUTH_SCOPE_REVIEW_REQUIRED',
  'OAUTH_TOKEN_SHAPE_REVIEW_REQUIRED','OAUTH_REGION_REVIEW_REQUIRED','REFRESH_TOKEN_NOT_RETURNED',
  'ACCOUNT_RESPONSE_REVIEW_REQUIRED','SENDER_MAILBOX_NOT_MATCHED','SENDER_MAILBOX_STATE_REVIEW_REQUIRED']);
const check = (yes, code) => { if (!yes) throw Object.assign(new Error(code), {safeCode:code}); };
const scopeCheck = token => {
  if (token.scope === undefined) return false;
  check(typeof token.scope === 'string', 'OAUTH_SCOPE_REVIEW_REQUIRED');
  const values = token.scope.split(/[ ,]+/).filter(Boolean);
  check(values.length === 2 && new Set(values).size === 2
    && requiredScopes.every(s => values.includes(s)), 'OAUTH_SCOPE_REVIEW_REQUIRED');
  return true;
};
const validToken = token => {
  check(token && typeof token.access_token === 'string' && tokenPattern.test(token.access_token)
    && Number.isInteger(token.expires_in) && token.expires_in > 0 && token.expires_in <= 86400,
  'OAUTH_TOKEN_SHAPE_REVIEW_REQUIRED');
  check(token.api_domain === undefined || token.api_domain === 'https://www.zohoapis.com',
    'OAUTH_REGION_REVIEW_REQUIRED');
  check(token.token_type === undefined || token.token_type === 'Bearer', 'OAUTH_TOKEN_SHAPE_REVIEW_REQUIRED');
};

// Returns secrets only to a private parent-process pipe. No file, console or mail operation.
export async function prepareZohoSender(input, fetcher) {
  const receipt = {
    stage_step:'FR.2.4.E3.3_PRIVATE_ZOHO_SETUP',
    result:'PRIVATE_ZOHO_SETUP_REVIEW_REQUIRED',
    scope:'OAUTH_CODE_OR_REFRESH_AND_SELECTED_ACCOUNT_METADATA_NOT_SEND_MAIL',
    requests_attempted:0, authorization_code_exchange_attempted:false,
    new_refresh_token_received:false, refresh_token_check_passed:false,
    token_reported_exact_scopes:false, sender_account_and_outgoing_state_matched:false,
    send_mail_scope_or_delivery_verified:false, email_dispatched:false,
    hosted_SQL_Auth_roles_or_Cloudflare_changed:false, hosted_acceptance:false,
    production_or_native_changed:false, findings_closed:[], problem_code:null, exit_code:1
  };
  let privateConfiguration = null;
  let phase = 'LOCAL_INPUT_INVALID';
  const request = async (url, init, cap) => {
    receipt.requests_attempted++;
    return upstreamJSON(fetcher, url, init, cap);
  };
  const tokenRequest = params => request('https://accounts.zoho.com/oauth/v2/token', {
    method:'POST', headers:{'content-type':'application/x-www-form-urlencoded', accept:'application/json'},
    body:new URLSearchParams(params).toString()
  }, 65536);
  try {
    check(input && typeof input === 'object' && !Array.isArray(input), phase);
    const allowed = ['mode','clientId','clientSecret','sender', input.mode === 'authorization_code' ? 'code' : 'refreshToken'];
    check(Object.keys(input).length === 5 && Object.keys(input).every(k => allowed.includes(k)), phase);
    check(['authorization_code','refresh'].includes(input.mode) && typeof fetcher === 'function', phase);
    for (const key of ['clientId','clientSecret', input.mode === 'authorization_code' ? 'code' : 'refreshToken']) {
      check(typeof input[key] === 'string' && tokenPattern.test(input[key]), phase);
    }
    check(isSingleMailbox(input.sender), phase);
    if (input.mode === 'authorization_code') {
      phase = 'OAUTH_CODE_EXCHANGE_REJECTED_OR_UNAVAILABLE';
      receipt.authorization_code_exchange_attempted = true;
      const token = await tokenRequest({grant_type:'authorization_code', client_id:input.clientId,
        client_secret:input.clientSecret, code:input.code});
      // Preserve an issued refresh token for encrypted recovery even if later validation fails.
      check(typeof token?.refresh_token === 'string' && tokenPattern.test(token.refresh_token), 'REFRESH_TOKEN_NOT_RETURNED');
      privateConfiguration = {schema_version:1, purpose:'MUSHAVO_STAGING_ZOHO_SENDER_ONLY',
        accountsOrigin:'https://accounts.zoho.com', mailOrigin:'https://mail.zoho.com',
        clientId:input.clientId, clientSecret:input.clientSecret, refreshToken:token.refresh_token,
        from:input.sender.toLowerCase(), accountId:null, account_verified:false};
      receipt.new_refresh_token_received = true;
      validToken(token);
      receipt.token_reported_exact_scopes = scopeCheck(token);
    } else {
      privateConfiguration = {schema_version:1, purpose:'MUSHAVO_STAGING_ZOHO_SENDER_ONLY',
        accountsOrigin:'https://accounts.zoho.com', mailOrigin:'https://mail.zoho.com',
        clientId:input.clientId, clientSecret:input.clientSecret, refreshToken:input.refreshToken,
        from:input.sender.toLowerCase(), accountId:null, account_verified:false};
    }
    phase = 'REFRESH_CHECK_REJECTED_OR_UNAVAILABLE';
    const refreshed = await tokenRequest({grant_type:'refresh_token', client_id:input.clientId,
      client_secret:input.clientSecret, refresh_token:privateConfiguration.refreshToken});
    validToken(refreshed);
    receipt.token_reported_exact_scopes = scopeCheck(refreshed) || receipt.token_reported_exact_scopes;
    receipt.refresh_token_check_passed = true;
    phase = 'ACCOUNT_READ_REJECTED_OR_UNAVAILABLE';
    const accounts = await request('https://mail.zoho.com/api/accounts', {
      method:'GET', headers:{accept:'application/json', authorization:'Zoho-oauthtoken ' + refreshed.access_token}
    }, 1048576);
    check(accounts?.status?.code === 200 && Array.isArray(accounts.data) && accounts.data.length <= 20,
      'ACCOUNT_RESPONSE_REVIEW_REQUIRED');
    const matches = accounts.data.filter(a => typeof a?.primaryEmailAddress === 'string'
      && a.primaryEmailAddress.toLowerCase() === privateConfiguration.from);
    check(matches.length === 1, 'SENDER_MAILBOX_NOT_MATCHED');
    const account = matches[0];
    check(account.type === 'ZOHO_ACCOUNT' && account.status === true && account.enabled === true
      && account.mailboxStatus === 'enabled' && account.outgoingBlocked === false,
    'SENDER_MAILBOX_STATE_REVIEW_REQUIRED');
    check(typeof account.accountId === 'string' && /^[0-9]{1,32}$/.test(account.accountId)
      && Array.isArray(account.emailAddress) && account.emailAddress.some(a => a?.isPrimary === true
        && a.isConfirmed === true && typeof a.mailId === 'string'
        && a.mailId.toLowerCase() === privateConfiguration.from), 'SENDER_MAILBOX_STATE_REVIEW_REQUIRED');
    privateConfiguration.accountId = account.accountId;
    privateConfiguration.account_verified = true;
    receipt.sender_account_and_outgoing_state_matched = true;
    receipt.result = 'ZOHO_REFRESH_AND_SENDER_METADATA_SCOPED_PASS_NOT_MAIL_DELIVERY';
    receipt.exit_code = 0;
  } catch (error) {
    receipt.problem_code = safeCodes.has(error?.safeCode) ? error.safeCode : phase;
  }
  receipt.provider_grant_may_exist_after_attempt = receipt.authorization_code_exchange_attempted;
  receipt.private_configuration_available_for_encryption = privateConfiguration !== null;
  return {receipt, private_configuration:privateConfiguration};
}
