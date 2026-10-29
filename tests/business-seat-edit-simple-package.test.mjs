import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replaceSeatEntries} from '../scripts/prepare-business-seats-simple.mjs';
import {readPublicZIP} from '../scripts/lib/read-public-zip.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
const fixture=()=>new Map([['app.js',Buffer.from('old app')],['app.html',Buffer.from('old html')],...Array.from({length:40},(_,i)=>['file'+i+'.js',Buffer.from('retained '+i)])]);
test('package replaces two assets, preserves forty and reads back without mutating input',()=>{
 const old=fixture(),before=createPublicZIP([...old]),replacements=new Map([['app.js',Buffer.from('new app')],['app.html',Buffer.from('new html')]]);
 const next=replaceSeatEntries(old,replacements),read=readPublicZIP(createPublicZIP([...next]),42);
 assert.equal(next.size,42);assert.equal(read.get('app.js').toString(),'new app');assert.equal(read.get('app.html').toString(),'new html');
 for(const [name,bytes] of old)if(!replacements.has(name))assert.ok(read.get(name).equals(bytes));
 assert.ok(before.equals(createPublicZIP([...old])));
});
test('package rejects missing entries and unrelated replacements',()=>{
 const old=fixture();
 assert.throws(()=>replaceSeatEntries(old,new Map([['app.js',Buffer.from('x')],['config.js',Buffer.from('x')]])),/PUBLIC_SET_REQUIRED/);
 old.delete('app.html');
 assert.throws(()=>replaceSeatEntries(old,new Map()),/PUBLIC_SET_REQUIRED/);
});
