// 2.2.2: overlay only the reviewed contact files onto an isolated staging copy.
const fs = require('node:fs');
const path = require('node:path');
const headers = require('./prepare-stage-2-headers.cjs');

function prepareContact(source, output, sitekey, candidate = {}) {
  if (!/^0x[A-Za-z0-9_-]{10,100}$/.test(sitekey || '')) {
    throw Error('Enter a real public Turnstile sitekey for the staging widget.');
  }
  const site = candidate.site ?? fs.readFileSync(path.join(__dirname, '..', 'site.js'), 'utf8');
  let html = candidate.html ?? fs.readFileSync(path.join(__dirname, '..', 'contact.html'), 'utf8');
  if (typeof site !== 'string' || typeof html !== 'string' ||
      (html.match(/data-sitekey=""/g) || []).length !== 1 ||
      (html.match(new RegExp(headers.PRODUCTION, 'g')) || []).length !== 1 ||
      !site.includes('/functions/v1/submit-enquiry') || site.includes('.from("enquiries").insert')) {
    throw Error('The pinned contact candidate does not match the reviewed layout.');
  }
  html = html.replace(headers.PRODUCTION, headers.STAGING).replace('data-sitekey=""', 'data-sitekey="' + sitekey + '"');
  const report = headers.preparePreview(source, output, {
    'site.js': Buffer.from(site), 'contact.html': Buffer.from(html)
  });
  return { ...report, stage_step: '2.2.2', result: 'STAGING_CONTACT_CANDIDATE_PREPARED',
    contact_endpoint: 'submit-enquiry', direct_browser_insert_removed: true,
    public_sitekey_present: true, widget_hostname_or_key_pair_verified: false,
    edge_function_deployed: false, database_gate_applied: false,
    hosted_challenge_quota_or_permissions_verified: false };
}
module.exports = { prepareContact };
if (require.main === module) {
  try { console.log(JSON.stringify(prepareContact(...process.argv.slice(2)), null, 2)); }
  catch (error) { console.error('2.2.2: ' + error.message); process.exitCode = 1; }
}
