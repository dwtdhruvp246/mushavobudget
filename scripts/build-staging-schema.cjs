// Build from a pinned Git commit; never read the dirty working tree.
const {execFileSync}=require('node:child_process');
const ref=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(ref||''))throw Error('A full reviewed commit SHA is required.');
const read=p=>execFileSync('git',['show',`${ref}:${p}`],{encoding:'utf8',maxBuffer:8*1024*1024});
const files=execFileSync('git',['ls-tree','-r','--name-only',ref,'supabase/migrations'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p.endsWith('.sql')).sort();
if(files.length!==51)throw Error('Migration count differs from reviewed 51.');
// Preserve every dollar-quoted function/DO body. Remove transaction wrappers
// only from outer SQL segments, so one transaction covers the whole setup.
function unwrap(sql){return sql.split(/(\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$[\s\S]*?\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$)/g).map((s,i)=>i%2?s:s.replace(/^\s*(?:begin|commit);\s*$/gim,'')).join('');}
const guard=`BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '5s';
DO $guard$ BEGIN
 IF EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM storage.buckets) OR EXISTS (SELECT 1 FROM storage.objects)
 OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e'))
 THEN RAISE EXCEPTION 'STAGING_NOT_EMPTY_STOP'; END IF;
END $guard$;
`;
process.stdout.write('-- 1.3.3 STAGING ONLY dczlddwbtgvfdujgcitb; verify Dashboard URL manually.\n-- Source '+ref+'; no production data import.\n'+guard+files.map(p=>'\n-- SOURCE '+p+'\n'+unwrap(read(p))).join('\n')+"\nSELECT '1.3.3' AS stage_step, 'APPLICATION_SCHEMA_INITIALIZED' AS result, 51 AS migrations_applied;\nCOMMIT;\n");
