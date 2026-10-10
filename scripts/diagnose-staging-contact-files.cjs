// 2.2.3: file comparison only. No backend requests, passwords or acceptance bypass.
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const WEBSITE = 'https://mushavo-budget-staging.pages.dev';
const MAX_BYTES = 512 * 1024;
const EXPECTED = {
  'site.js': {
    full: 'a4cf1add2b9f702fe21ac956e380c1ae99b4afe2d291b6b606c57f1598fc507d',
    ascii: '20fd1704096969d1bcf40430cbf75798d5772271c328bef1b039657ec70e4161',
  },
  'contact.html': {
    full: 'f52e51744229c8de735a675f305810c68837695600bc370d3b177ef4d90e9159',
    ascii: '069382210052cd5367b663bba60848ab08fec36ef608b9c19968d08c05d318d4',
  },
};
const normalize = text => text.replace(/\r\n?/g, '\n').trimEnd();
const digest = text => createHash('sha256').update(text).digest('hex');
function fingerprint(name, text) {
  const keyCount = (text.match(/data-sitekey="0x[A-Za-z0-9_-]{10,100}"/g) || []).length;
  const canonical = normalize(name === 'contact.html'
    ? text.replace(/data-sitekey="0x[A-Za-z0-9_-]{10,100}"/g, 'data-sitekey=""') : text);
  return {
    text_bytes_utf8: Buffer.byteLength(text),
    matches_reviewed_candidate: digest(canonical) === EXPECTED[name].full && (name !== 'contact.html' || keyCount === 1),
    ascii_skeleton_matches_reviewed_diagnostic_only: digest(canonical.replace(/[^\x00-\x7F]/g, '')) === EXPECTED[name].ascii,
    replacement_character_count: (text.match(/\uFFFD/g) || []).length,
    leading_bom_present: text.startsWith('\uFEFF'),
    ...(name === 'site.js' ? { contact_endpoint_marker_present: text.includes('/functions/v1/submit-enquiry') }
      : { real_format_public_sitekey_count: keyCount }),
    cloudflare_rewrite_marker_present: /cdn-cgi\/|rocket-loader|data-cf-beacon|beacon\.min\.js/i.test(text),
  };
}
async function readLocal(filename) {
  const item = await fs.lstat(filename);
  if (!item.isFile() || item.isSymbolicLink() || item.size > MAX_BYTES) throw new Error('LOCAL_FILE_UNAVAILABLE');
  return fs.readFile(filename, 'utf8');
}
async function run({ webDirectory, fetcher = fetch, readText = readLocal, now = Date.now } = {}) {
  const files = [];
  const stamp = String(now());
  for (const name of Object.keys(EXPECTED)) {
    const entry = { file: name };
    let local, live;
    if (typeof webDirectory === 'string' && path.isAbsolute(webDirectory)) {
      try {
        local = await readText(path.join(webDirectory, name));
        entry.local = { available: true, ...fingerprint(name, local) };
      } catch { entry.local = { available: false, problem_code: 'LOCAL_FILE_UNAVAILABLE' }; }
    } else entry.local = { available: false, problem_code: 'UPLOAD_DIRECTORY_REQUIRED' };
    for (const [label, suffix] of [['live', ''], ['live_cache_busted', '?audit_contact_files=' + stamp]]) {
      try {
        const response = await fetcher(WEBSITE + '/' + name + suffix, {
          method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
        });
        entry[label] = { http_status: response.status, available: false };
        if (response.status !== 200) { entry[label].problem_code = 'ASSET_HTTP_STATUS'; await response.body?.cancel(); continue; }
        const intended = new URL(WEBSITE + '/' + name);
        if (response.url) {
          const final = new URL(response.url);
          if (final.origin !== intended.origin || final.pathname !== intended.pathname) throw new Error('ASSET_ADDRESS_CHANGED');
        }
        const chunks = []; let size = 0;
        if (!response.body) throw new Error('ASSET_BODY_MISSING');
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > MAX_BYTES) throw new Error('ASSET_TOO_LARGE');
          chunks.push(Buffer.from(chunk));
        }
        const text = Buffer.concat(chunks).toString('utf8');
        entry[label] = { http_status: response.status, available: true, ...fingerprint(name, text),
          ...(local === undefined ? {} : { matches_local_prepared_file: normalize(text) === normalize(local) }),
        };
        if (label === 'live') live = text;
        else if (live !== undefined) entry[label].matches_normal_live_file = normalize(text) === normalize(live);
      } catch { entry[label] = { ...entry[label], available: false, problem_code: 'ASSET_READ_FAILED' }; }
    }
    files.push(entry);
  }
  return {
    stage_step: '2.2.3', result: 'STAGING_CONTACT_FILE_COMPARISON_DIAGNOSTIC',
    project: 'dczlddwbtgvfdujgcitb', files,
    ascii_comparison_is_acceptance_proof: false,
    diagnosis_confirmed: false,
    files_modified_or_deployed: false, backend_or_auth_requests_performed: false,
    passwords_keys_tokens_or_file_contents_printed: false,
    full_f09_acceptance_verified: false,
    completed_utc: new Date(Number(stamp)).toISOString(),
  };
}
module.exports = { run, fingerprint, EXPECTED, WEBSITE };
if (require.main === module) run({ webDirectory: process.env.MUSHAVO_CONTACT_WEB_DIRECTORY }).then(result => {
  console.log(JSON.stringify(result, null, 2));
}).catch(() => { console.log(JSON.stringify({ stage_step: '2.2.3', result: 'STAGING_CONTACT_FILE_COMPARISON_REVIEW', problem_code: 'LOCAL_DIAGNOSTIC_FAILED' })); process.exitCode = 1; });
