// 3.5.2 review-only preparation. No upload, Auth settings or Edge deployment.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const source = process.argv[2];
const output = process.argv[3];
const staging = 'dczlddwbtgvfdujgcitb';
const production = 'kttkospkblwvguuwnhjj';
const key = (process.env.MUSHAVO_STAGING_PUBLISHABLE_KEY || '').trim();
if (!/^[a-f0-9]{40}$/.test(source || '')) throw Error('Provide the pinned 40-character candidate commit.');
if (process.env.MUSHAVO_STAGING_PROJECT_CONFIRMED !== staging) throw Error('Confirm the staging project before preparing files.');
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw Error('Use the staging publishable key. Secret and service-role keys are rejected.');
if (!output || fs.existsSync(path.resolve(output))) throw Error('Provide a new, nonexistent output folder.');
const git = args => execFileSync('git',args,{maxBuffer:16*1024*1024});
if (git(['cat-file','-t',source]).toString().trim() !== 'commit') throw Error('The pin must identify a commit.');
if (git(['show',`${source}:config.js`]).includes(Buffer.from(key))) throw Error('The supplied key matches source/production config.');
const required = new Set(['about.html','app-entry.html','app.html','auth.html','business.html','contact.html','index.html','offline.html','pricing.html','signup.html',
  'workspace-preference.js','app-entry.js','app.js','admin-mfa.js','admin-plans.js','auth-security.js','auth-flows.js','business.js','config.js','push-notifications.js','pwa-install.js','pwa.js','site.js','sw.js',
  'business.css','pwa-install.css','pwa-shell.css','pwa-update.css','site.css','styles.css','manifest.webmanifest','_headers']);
const allowed = new Set([...required,'_redirects']);
const entries = git(['ls-tree','-r',source]).toString().trim().split(/\r?\n/).map(line => {
  const [meta,name] = line.split('\t');
  const [mode,type] = meta.split(' ');
  return {name,mode,type};
}).filter(entry => allowed.has(entry.name) || entry.name.startsWith('assets/'));
for (const name of required) if (!entries.some(entry => entry.name === name)) throw Error('Missing candidate public asset: '+name);
if (!entries.some(entry=>entry.name.startsWith('assets/'))) throw Error('Candidate image assets are missing.');
const files = entries.map(entry => {
  if (entry.type !== 'blob' || !['100644','100755'].includes(entry.mode)) throw Error('Public assets must be ordinary files.');
  let data = git(['show',`${source}:${entry.name}`]);
  if (entry.name === 'config.js') data = Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:`https://${staging}.supabase.co`,supabasePublishableKey:key,vapidPublicKey:''},null,2)+';\n');
  else if (/\.(html|js|css|webmanifest)$/.test(entry.name) || entry.name === '_headers' || entry.name === '_redirects') data=Buffer.from(data.toString().split(production).join(staging));
  if (data.includes(Buffer.from(production))) throw Error('A production reference remains in '+entry.name);
  return [entry.name,data];
});
// Validate all source content before creating the requested directory.
fs.mkdirSync(path.resolve(output));
for (const [name,data] of files) { const target=path.join(path.resolve(output),name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data); }
const receipt={stage_step:'3.5.2',result:'STAGING_AUTH_FRONTEND_PREPARED',source_commit:source,project:staging,files:files.length,production_reference_scan_passed:true,push_disabled:true,
  publishable_key_ownership_independently_verified:false,hosting_deployed:false,Auth_settings_changed:false,Edge_functions_deployed:false,mail_dispatched:false,hosted_acceptance:false};
fs.writeFileSync(path.join(path.resolve(output),'auth-candidate-manifest.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
