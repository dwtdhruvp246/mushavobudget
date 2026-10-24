import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectTemplate} from './helpers/auth-email-template-projection.mjs';

const root = new URL('../', import.meta.url);
const site = 'https://mushavo-budget-staging.pages.dev';
const uuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const kinds = ['invite-user', 'magic-link'];
const templates = {};
for (const kind of kinds) for (const extension of ['html', 'subject.txt']) {
  const file = `supabase/templates/${kind}.${extension}`;
  templates[file] = await readFile(new URL(file, root), 'utf8');
}
const baseline = JSON.parse(await readFile(new URL('tests/fixtures/stage-6-email-template-baseline.json', root), 'utf8'));
const subject = (kind, redirect, SiteURL = site, files = templates) => projectTemplate(files[`supabase/templates/${kind}.subject.txt`], {SiteURL, RedirectTo: redirect});
const body = (kind, redirect, SiteURL = site, files = templates) => projectTemplate(files[`supabase/templates/${kind}.html`], {SiteURL, RedirectTo: redirect});
function expectPurpose(kind, redirect, purpose, SiteURL = site) {
  const heading = subject(kind, redirect, SiteURL), copy = body(kind, redirect, SiteURL);
  assert.equal(heading.trim(), purpose === 'business' ? 'Invitation to join a Business workspace | Mushavo Budget' : purpose === 'admin' || kind === 'invite-user' ? 'Complete your Mushavo Budget account setup' : 'Your Mushavo Budget sign-in link');
  assert.equal(copy.includes('Review Business invitation'), purpose === 'business');
  assert.equal(copy.includes('Your administrator has prepared'), purpose === 'admin');
  assert.equal((copy.match(/href="{{ \.ConfirmationURL }}"/g) || []).length, 1);
  assert.equal(copy.includes('href="' + redirect + '"'), false);
  assert.equal(/[\r\n]/.test(heading.trim()), false);
}

test('frozen previous bytes demonstrate current Business redirects selecting generic fallback', () => {
  assert.equal(baseline.source_commit, '87a1d302c0d490578dc0752fa7c0124ef0e4eda7');
  for (const kind of kinds) for (const flow of ['business-new', 'business-existing']) {
    const redirect = `${site}/auth.html?flow=${flow}&invitation=${uuid}`;
    assert.doesNotMatch(subject(kind, redirect, site, baseline.templates), /Business workspace/);
    assert.doesNotMatch(body(kind, redirect, site, baseline.templates), /Review Business invitation/);
  }
});

for (const kind of kinds) {
  for (const [name, path] of [['new Business', '/auth.html?flow=business-new&invitation='], ['existing Business', '/auth.html?flow=business-existing&invitation='], ['legacy Business', '/business.html?invitation=']]) {
    test(`${kind}: ${name} subject/body agree and retain the authentic link placeholder`, () => {
      const redirect = site + path + uuid;
      expectPurpose(kind, redirect, 'business');
      assert.match(body(kind, redirect), /only after you choose Accept/);
      assert.match(body(kind, redirect), /If you are new, create your password/);
    });
  }
  test(`${kind}: Admin setup has setup wording without Business grant wording`, () => {
    const redirect = `${site}/signup.html?mode=admin-invite&invitation=${uuid}`;
    expectPurpose(kind, redirect, 'admin');
    assert.match(body(kind, redirect), /only after setup is completed/);
  });
  test(`${kind}: ordinary sign-in preserves the prior generic subject and copy`, () => {
    const redirect = site + '/app.html';
    expectPurpose(kind, redirect, 'generic');
    assert.equal(subject(kind, redirect).trim(), subject(kind, redirect, site, baseline.templates).trim());
    assert.equal(body(kind, redirect).match(/<h2>[^<]+<\/h2>/)[0], body(kind, redirect, site, baseline.templates).match(/<h2>[^<]+<\/h2>/)[0]);
  });
}

const negative = [
  ['external origin', `https://outsider.example/auth.html?flow=business-new&invitation=${uuid}`],
  ['host suffix spoof', `${site}.outsider.example/auth.html?flow=business-new&invitation=${uuid}`],
  ['host user-info spoof', `${site}@outsider.example/auth.html?flow=business-new&invitation=${uuid}`],
  ['different scheme', `http://mushavo-budget-staging.pages.dev/auth.html?flow=business-new&invitation=${uuid}`],
  ['protocol relative', `//mushavo-budget-staging.pages.dev/auth.html?flow=business-new&invitation=${uuid}`],
  ['wrong environment', `https://mushavobudget.com/auth.html?flow=business-new&invitation=${uuid}`],
  ['lookalike path', `${site}/auth.html.evil?flow=business-new&invitation=${uuid}`],
  ['recovery purpose', `${site}/auth.html?flow=recover&invitation=${uuid}`],
  ['confirmation purpose', `${site}/auth.html?flow=confirm&invitation=${uuid}`],
  ['unknown Business flow', `${site}/auth.html?flow=business-owner&invitation=${uuid}`],
  ['wrong query order', `${site}/auth.html?invitation=${uuid}&flow=business-new`],
  ['duplicate flow', `${site}/auth.html?flow=business-new&invitation=${uuid}&flow=recover`],
  ['additional redirect', `${site}/auth.html?flow=business-new&invitation=${uuid}&next=https://outsider.example`],
  ['unexpected fragment', `${site}/auth.html?flow=business-new&invitation=${uuid}#anything`],
  ['encoded path', `${site}/%61uth.html?flow=business-new&invitation=${uuid}`],
  ['truncated invitation', `${site}/auth.html?flow=business-new&invitation=short`],
  ['empty invitation', `${site}/auth.html?flow=business-new&invitation=`],
  ['legacy extra query', `${site}/business.html?invitation=${uuid}&next=anything`],
  ['wrong Admin mode', `${site}/signup.html?mode=self-signup&invitation=${uuid}`],
  ['Admin empty invitation', `${site}/signup.html?mode=admin-invite&invitation=`],
  ['Admin external origin', `https://outsider.example/signup.html?mode=admin-invite&invitation=${uuid}`],
  ['Admin extra query', `${site}/signup.html?mode=admin-invite&invitation=${uuid}&role=super_admin`],
  ['empty redirect', ''],
  ['short redirect', '/'],
  ['raw whitespace', ` ${site}/auth.html?flow=business-new&invitation=${uuid}`]
];
for (const [name, redirect] of negative) test(`negative route ${name}: both template pairs retain generic copy`, () => {
  for (const kind of kinds) expectPurpose(kind, redirect, 'generic');
});

test('empty SiteURL never selects Business/Admin by matching a relative prefix', () => {
  for (const kind of kinds) {
    expectPurpose(kind, `/auth.html?flow=business-new&invitation=${uuid}`, 'generic', '');
    expectPurpose(kind, `/signup.html?mode=admin-invite&invitation=${uuid}`, 'generic', '');
  }
});
test('SiteURL canonical-origin prerequisite is explicit; trailing slash has generic fallback', () => {
  for (const kind of kinds) expectPurpose(kind, `${site}/auth.html?flow=business-new&invitation=${uuid}`, 'generic', site + '/');
});
test('test model does not interpret invitation route length as Auth UUID validation', () => {
  const invented = 'x'.repeat(36);
  for (const kind of kinds) expectPurpose(kind, `${site}/auth.html?flow=business-new&invitation=${invented}`, 'business');
  // Copy classification grants no access; production Auth/RPC UUID validation
  // is unchanged and must reject any invalid invitation independently.
});
test('projection rejects unsupported grammar rather than silently manufacturing a pass', () => {
  for (const source of ['{{ mystery .SiteURL }}', '{{ .SiteURL | html }}', '{{ if .SiteURL }}', '{{ else }}', '{{ end }}', '{{ $unknown }}', '{{ incomplete']) {
    assert.throws(() => projectTemplate(source, {SiteURL: site, RedirectTo: '/'}));
  }
});
test('projection preserves ConfirmationURL and never substitutes client-selected URLs', () => {
  assert.equal(projectTemplate('<a href="{{ .ConfirmationURL }}">Open</a>', {SiteURL: site, RedirectTo: 'https://outsider.example', ConfirmationURL: 'javascript:injected'}), '<a href="{{ .ConfirmationURL }}">Open</a>');
});
test('short-circuit length guard avoids an invalid slice on empty/short fields', () => {
  assert.equal(projectTemplate('{{ if and (eq (len .RedirectTo) 10) (eq (slice .RedirectTo 0 10) "abcdefghij") }}yes{{ else }}no{{ end }}', {SiteURL: site, RedirectTo: ''}), 'no');
});
test('template predicates use the same supported shapes in subjects and bodies', () => {
  const control = source => [...source.matchAll(/{{([\s\S]*?)}}/g)].map(match => match[1].trim()).filter(action => action !== '.ConfirmationURL');
  for (const kind of kinds) assert.deepEqual(control(templates[`supabase/templates/${kind}.html`]), control(templates[`supabase/templates/${kind}.subject.txt`]));
});
