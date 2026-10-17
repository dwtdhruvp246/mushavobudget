import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderCanonicalSchema,readCanonicalInputs} from '../scripts/build-canonical-schema.mjs';
const a={name:'20261001000000_first.sql',sql:'select 1;\n'},b={name:'20261002000000_second.sql',sql:'select 2;\n'};
test('Canonical rendering retains every ordered source body and names its boundaries',()=>{
 const output=renderCanonicalSchema([a,b]);assert(output.includes(a.sql));assert(output.includes(b.sql));assert(output.indexOf(a.name)<output.indexOf(b.name));assert.equal(output.match(/BEGIN MIGRATION/g).length,2);
});
test('Missing, duplicate, reversed and path-shaped migration inputs are rejected',()=>{
 for(const input of[[],null,[a,a],[b,a],[{...a,name:'../first.sql'}],[{...a,name:'20261001000000_first.sql\n'}]])assert.throws(()=>renderCanonicalSchema(input));
});
test('Empty and NUL-containing bodies are rejected, while CRLF normalization is reproducible',()=>{
 for(const sql of['',' \n','select\0 1;'])assert.throws(()=>renderCanonicalSchema([{...a,sql}]));assert.equal(renderCanonicalSchema([{...a,sql:a.sql.replace(/\n/g,'\r\n')}]),renderCanonicalSchema([a]));
});
test('Actual canonical source equals the 54 baseline migrations plus dormant installer registration',async()=>{
 const inputs=await readCanonicalInputs();assert.equal(inputs.length,55);assert.equal(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'),renderCanonicalSchema(inputs));
});
test('Read-only canonical CLI succeeds without changing the schema',async()=>{
 const url=new URL('../supabase/schema.sql',import.meta.url),before=await readFile(url);const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/build-canonical-schema.mjs',import.meta.url)),'--check'],{encoding:'utf8'});assert.equal(run.status,0);assert.equal(JSON.parse(run.stdout).migrations,55);assert.deepEqual(await readFile(url),before);
});
test('Canonical CLI rejects write/unknown options without changing the schema',async()=>{
 const url=new URL('../supabase/schema.sql',import.meta.url),before=await readFile(url);const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/build-canonical-schema.mjs',import.meta.url)),'--write'],{encoding:'utf8'});assert.equal(run.status,1);assert.deepEqual(await readFile(url),before);
});
