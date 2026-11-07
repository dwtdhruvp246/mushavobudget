// The canonical bootstrap is the ordered migration history, with no hidden DDL.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function renderCanonicalSchema(parts){
  if(!Array.isArray(parts)||!parts.length)throw new Error('MIGRATIONS_REQUIRED');
  const names=parts.map(x=>x.name);
  if(new Set(names).size!==names.length||names.some(x=>typeof x!=='string'||!/^\d{14}_[a-z0-9_]+\.sql$/.test(x))||JSON.stringify(names)!==JSON.stringify([...names].sort()))throw new Error('MIGRATION_ORDER_INVALID');
  if(parts.some(x=>typeof x.sql!=='string'||!x.sql.trim()||x.sql.includes('\0')))throw new Error('MIGRATION_BODY_INVALID');
  return '-- Mushavo Budget complete Supabase schema\n-- Generated from the ordered files in supabase/migrations.\n-- Check with: node scripts/build-canonical-schema.mjs --check\n-- This bootstrap contains historical data/DDL transitions; it is not a live repair script.\n\n'+parts.map(({name,sql})=>'-- BEGIN MIGRATION '+name+'\n'+sql.replace(/\r\n/g,'\n').replace(/\n*$/,'\n')+'-- END MIGRATION '+name+'\n').join('\n');
}
export async function readCanonicalInputs(base=root){
  const directory=path.join(base,'supabase/migrations');
  const names=(await readdir(directory)).filter(x=>x.endsWith('.sql')).sort();
  return Promise.all(names.map(async name=>({name,sql:await readFile(path.join(directory,name),'utf8')})));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==3||process.argv[2]!=='--check')throw new Error('CHECK_ONLY_CLI');
    const parts=await readCanonicalInputs();
    if(await readFile(path.join(root,'supabase/schema.sql'),'utf8')!==renderCanonicalSchema(parts))throw new Error('CANONICAL_SCHEMA_DRIFT');
    console.log(JSON.stringify({result:'CANONICAL_SCHEMA_MATCHES_ORDERED_MIGRATIONS',migrations:parts.length,files_changed:false}));
  }catch{console.log(JSON.stringify({result:'CANONICAL_SCHEMA_REVIEW_REQUIRED',files_changed:false}));process.exitCode=1;}
}
