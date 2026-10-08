// 1.3.4: build an isolated static frontend from reviewed Git source.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const source='e5b1936847e22a04a3f5fd63785ceed3b4d0f9da';
const production='kttkospkblwvguuwnhjj';
const staging='dczlddwbtgvfdujgcitb';
const key=(process.env.MUSHAVO_STAGING_PUBLISHABLE_KEY||'').trim();
if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw Error('Use a staging sb_publishable_ key, never a secret/service-role key.');
const originalConfig=execFileSync('git',['show',`${source}:config.js`],{encoding:'utf8'});
if(originalConfig.includes(key))throw Error('The supplied key matches production configuration.');
const out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||fs.existsSync(out))throw Error('Provide a new, nonexistent output folder.');
const topFiles=new Set(['about.html','app-entry.html','app.html','business.html','contact.html','index.html','offline.html','pricing.html','signup.html','app-entry.js','app.js','admin-plans.js','business.js','config.js','push-notifications.js','pwa-install.js','pwa.js','site.js','sw.js','workspace-preference.js','business.css','pwa-install.css','pwa-shell.css','pwa-update.css','site.css','styles.css','manifest.webmanifest']);
const files=execFileSync('git',['ls-tree','-r','--name-only',source],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>topFiles.has(p)||p.startsWith('assets/'));
for(const p of topFiles)if(!files.includes(p))throw Error('Missing reviewed public asset: '+p);
const buffers=[];
for(const p of files){let data=execFileSync('git',['show',`${source}:${p}`],{maxBuffer:16*1024*1024});
 if(p==='config.js')data=Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:`https://${staging}.supabase.co`,supabasePublishableKey:key,vapidPublicKey:''},null,2)+';\n');
 else if(/\.(html|js|css|webmanifest)$/.test(p)) data=Buffer.from(data.toString('utf8').split(production).join(staging));
 if(data.includes(Buffer.from(production)))throw Error('Production project reference remains in '+p);
 buffers.push([p,data]);
}
fs.mkdirSync(out);
for(const [p,data]of buffers){const target=path.join(out,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);}
console.log(JSON.stringify({stage_step:'1.3.4',result:'STAGING_FRONTEND_PREPARED',source_commit:source,staging_reference:staging,files:files.length,output:out,production_reference_scan_passed:true,production_push_key_removed:true,publishable_key_project_ownership_verified:false,hosting_deployed:false,auth_redirects_verified:false,edge_functions_or_secrets_copied:false,complete_staging_isolation_verified:false},null,2));
