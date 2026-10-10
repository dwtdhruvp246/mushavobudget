import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { run, fingerprint, WEBSITE } = require('../scripts/diagnose-staging-contact-files.cjs');
const site = await readFile(new URL('../site.js', import.meta.url), 'utf8');
const html = (await readFile(new URL('../contact.html', import.meta.url), 'utf8'))
  .replaceAll('kttkospkblwvguuwnhjj', 'dczlddwbtgvfdujgcitb').replace('data-sitekey=""', 'data-sitekey="0xDIAGNOSTIC_PUBLIC_KEY"');
const texts = { 'site.js': site, 'contact.html': html };
const options = { webDirectory: path.resolve('diagnostic-fixture'), now: () => 1791620000000,
  readText: async filename => texts[path.basename(filename)] };
function fetchFixture(transform = (name, text) => text) {
  const calls = [];
  const fetcher = async (url, opts) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, WEBSITE); assert.equal(opts.method, 'GET'); assert.equal(opts.redirect, 'error');
    assert.deepEqual(Object.keys(opts).sort(), ['cache', 'method', 'redirect', 'signal']);
    calls.push(url);
    const name = parsed.pathname === '/contact' ? 'contact.html' : parsed.pathname.slice(1);
    return new Response(transform(name, texts[name], parsed), { status: 200 });
  };
  return { calls, fetcher };
}
test('compares prepared/live/cache-busted candidate using only four public GETs and safe metadata', async () => {
  const fixture = fetchFixture(); const result = await run({ ...options, fetcher: fixture.fetcher });
  assert.equal(fixture.calls.length, 4);
  assert.ok(fixture.calls.some(url => new URL(url).pathname === '/contact'));
  assert.ok(fixture.calls.every(url => !url.includes('/contact.html')));
  for (const file of result.files) {
    assert.equal(file.local.matches_reviewed_candidate, true);
    assert.equal(file.live.matches_local_prepared_file, true);
    assert.equal(file.live_cache_busted.matches_normal_live_file, true);
    assert.equal(file.live.matches_reviewed_candidate, true);
  }
  assert.equal(result.backend_or_auth_requests_performed, false);
  assert.equal(result.full_f09_acceptance_verified, false);
  assert.ok(!JSON.stringify(result).includes('0xDIAGNOSTIC_PUBLIC_KEY'));
  assert.ok(!JSON.stringify(result).includes('function init'));
});
test('Unicode corruption is identified as diagnostic similarity and cannot pass candidate parity', async () => {
  assert.ok(/[^\x00-\x7F]/.test(site));
  const corrupt = site.replace(/[^\x00-\x7F]/g, '\uFFFD');
  const fixture = fetchFixture((name, text) => name === 'site.js' ? corrupt : text);
  const result = await run({ ...options, fetcher: fixture.fetcher,
    readText: async filename => path.basename(filename) === 'site.js' ? corrupt : html });
  const file = result.files[0];
  assert.equal(file.local.matches_reviewed_candidate, false);
  assert.equal(file.local.ascii_skeleton_matches_reviewed_diagnostic_only, true);
  assert.equal(file.live.matches_local_prepared_file, true);
  assert.ok(file.live.replacement_character_count > 0);
  assert.equal(result.ascii_comparison_is_acceptance_proof, false);
});
test('distinguishes changed hosted HTML and normal-versus-cache-busted responses without assuming a cause', async () => {
  const fixture = fetchFixture((name, text, url) => name === 'contact.html' && !url.search
    ? text + '<script data-cf-beacon="synthetic-private-contents"></script>' : text);
  const result = await run({ ...options, fetcher: fixture.fetcher });
  const file = result.files[1];
  assert.equal(file.local.matches_reviewed_candidate, true);
  assert.equal(file.live.matches_reviewed_candidate, false);
  assert.equal(file.live.matches_local_prepared_file, false);
  assert.equal(file.live.cloudflare_rewrite_marker_present, true);
  assert.equal(file.live_cache_busted.matches_reviewed_candidate, true);
  assert.equal(file.live_cache_busted.matches_normal_live_file, false);
  assert.equal(result.diagnosis_confirmed, false);
  assert.ok(!JSON.stringify(result).includes('synthetic-private-contents'));
});
test('missing local files and network errors print fixed problem codes, without secrets or backend fallback', async () => {
  const result = await run({ ...options,
    readText: async () => { throw new Error('private-local-path'); },
    fetcher: async () => { throw new Error('sensitive-network-details'); } });
  for (const file of result.files) {
    assert.equal(file.local.problem_code, 'LOCAL_FILE_UNAVAILABLE');
    assert.equal(file.live.problem_code, 'ASSET_READ_FAILED');
  }
  assert.ok(!JSON.stringify(result).includes('private-local-path'));
  assert.ok(!JSON.stringify(result).includes('sensitive-network-details'));
});
test('unfilled widget fails even with reviewed normalized HTML, and large/redirected assets stay unavailable', async () => {
  const empty = fingerprint('contact.html', html.replace('0xDIAGNOSTIC_PUBLIC_KEY', ''));
  assert.equal(empty.matches_reviewed_candidate, false);
  assert.equal(empty.real_format_public_sitekey_count, 0);
  const result = await run({ ...options, fetcher: async url => url.includes('site.js')
    ? new Response('x'.repeat(512 * 1024 + 1))
    : { status: 200, url: 'https://other.example/contact.html' } });
  for (const file of result.files) assert.equal(file.live.available, false);
});
