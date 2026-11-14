import {upstreamJSON, requireGate} from './email-verification-http.mjs';
const mailbox = /^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,63}$/;
export const isSingleMailbox = value => typeof value === 'string' && value.length <= 254 && mailbox.test(value);

// US endpoint candidate only. Other data centres require a reviewed exact endpoint pair.
// Secrets are runtime server configuration; no inbox password is accepted here.
export function createZohoCodeMailer({fetcher, config}) {
  requireGate(typeof fetcher === 'function' && config?.mailOrigin === 'https://mail.zoho.com'
    && config.accountsOrigin === 'https://accounts.zoho.com'
    && /^[0-9]{1,32}$/.test(config.accountId || '') && isSingleMailbox(config.from));
  for (const key of ['clientId','clientSecret','refreshToken']) {
    requireGate(typeof config[key] === 'string' && config[key].length >= 8
      && config[key].length <= 4096 && !/[\r\n\0]/.test(config[key]));
  }
  requireGate(Array.isArray(config.allowedRecipients) && config.allowedRecipients.length >= 1
    && config.allowedRecipients.length <= 10 && config.allowedRecipients.every(isSingleMailbox));
  const allowed = new Set(config.allowedRecipients.map(x=>x.toLowerCase()));
  return async ({to, code}) => {
    requireGate(isSingleMailbox(to) && allowed.has(to.toLowerCase()) && /^\d{6}$/.test(code || ''), 'RECIPIENT_NOT_PREPARED', 403);
    const token = await upstreamJSON(fetcher, config.accountsOrigin + '/oauth/v2/token', {
      method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'refresh_token', client_id:config.clientId,
        client_secret:config.clientSecret, refresh_token:config.refreshToken}).toString()
    }, 16384);
    requireGate(typeof token.access_token === 'string' && /^[A-Za-z0-9._-]{8,4096}$/.test(token.access_token)
      && Number.isInteger(token.expires_in) && token.expires_in > 0 && token.expires_in <= 86400);
    const sent = await upstreamJSON(fetcher, config.mailOrigin + '/api/accounts/' + config.accountId + '/messages', {
      method:'POST', headers:{'content-type':'application/json', authorization:'Zoho-oauthtoken ' + token.access_token},
      body:JSON.stringify({fromAddress:config.from, toAddress:to,
        subject:'Your Mushavo Budget sign-in code', mailFormat:'plaintext', encoding:'UTF-8', askReceipt:'no',
        content:'Your Mushavo Budget sign-in code is ' + code + '.\n\nIt expires in 10 minutes. Never share this code. If you did not request it, you can ignore this message.'})
    });
    requireGate(sent?.status?.code === 200);
    // Provider acceptance only; this does not establish inbox delivery.
    return {accepted:true};
  };
}
