// Check only: this CLI neither writes generated SQL nor connects to a database.
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {componentNames,installerMigration,renderAtomicInstaller} from './lib/email-atomic-source.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{
 if(process.argv.length!==2)throw new Error('CHECK_ONLY');
 const components=Object.fromEntries(await Promise.all(componentNames.map(async name=>[name,await readFile(resolve(root,'supabase/candidates/security_fr_2_4_email_'+name+'.sql'),'utf8')])));
 if(await readFile(resolve(root,'supabase/migrations',installerMigration),'utf8')!==renderAtomicInstaller(components))throw new Error('INSTALLER_SOURCE_DRIFT');
 console.log(JSON.stringify({result:'ATOMIC_INSTALLER_MATCHES_REVIEWED_COMPONENTS',components:4,files_changed:false,activation_invoked:false}));
}catch{console.log(JSON.stringify({result:'ATOMIC_INSTALLER_SOURCE_REVIEW_REQUIRED',files_changed:false,activation_invoked:false}));process.exitCode=1;}
