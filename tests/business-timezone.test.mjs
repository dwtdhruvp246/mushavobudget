import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../business.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function businessTimezoneOffsetMinutes('),source.indexOf('function renderBusinessTimezones('));
function context(intl=Intl){const c=vm.createContext({Intl:intl});vm.runInContext(helper,c);return c;}
test('Business timezone labels include signed hours and fractional offsets',()=>{
 const c=context(),date=new Date('2026-01-15T12:00:00.999Z');
 for(const [zone,offset] of [['UTC','+00:00'],['Africa/Harare','+02:00'],['Asia/Kolkata','+05:30'],['Asia/Kathmandu','+05:45'],['America/St_Johns','-03:30'],['Pacific/Chatham','+13:45']]){
  assert(c.businessTimezoneLabel(zone,date).startsWith(`UTC${offset} — `));
 }
});
test('Business timezone labels reflect daylight saving for the specified date',()=>{
 const c=context();assert.match(c.businessTimezoneLabel('America/New_York',new Date('2026-01-15T12:00:00Z')),/UTC-05:00/);assert.match(c.businessTimezoneLabel('America/New_York',new Date('2026-07-15T12:00:00Z')),/UTC-04:00/);
 assert.match(c.businessTimezoneLabel('Europe/London',new Date('2026-01-15T12:00:00Z')),/UTC\+00:00/);assert.match(c.businessTimezoneLabel('Europe/London',new Date('2026-07-15T12:00:00Z')),/UTC\+01:00/);
});
test('UTC offset calculations stay correct across midnight and the international date line',()=>{
 const c=context();for(const [zone,date,offset] of [['America/Los_Angeles','2026-01-15T02:00:00Z','-08:00'],['Pacific/Auckland','2026-01-15T23:00:00Z','+13:00'],['Africa/Harare','2026-01-15T22:00:00Z','+02:00']])assert.match(c.businessTimezoneLabel(zone,new Date(date)),new RegExp(`UTC\\${offset[0]}${offset.slice(1)}`));
});
test('Older WebViews get timezone choices and preserve a saved alias',()=>{
 for(const supportedValuesOf of [undefined,()=>{throw new RangeError('unsupported');}]){
  const c=context({DateTimeFormat:Intl.DateTimeFormat,supportedValuesOf});const zones=Array.from(c.businessTimezones('US/Eastern'));
  for(const zone of ['UTC','Africa/Harare','Asia/Kolkata','America/New_York','US/Eastern'])assert(zones.includes(zone));assert.equal(new Set(zones).size,zones.length);assert.match(c.businessTimezoneLabel('US/Eastern',new Date('2026-01-15T12:00:00Z')),/UTC-05:00/);
 }
});

test('Simplified Business timezone choices run from negative to positive offsets and retain saved zones',()=>{
 const c=context();
 for(const date of [new Date('2026-01-15T12:00:00Z'),new Date('2026-07-15T12:00:00Z')]){
  const zones=Array.from(c.businessTimezones('Europe/Zurich',date));assert(zones.length<60);assert(zones.includes('Europe/Zurich'));
  const offsets=zones.map(zone=>c.businessTimezoneOffsetMinutes(zone,date));assert(offsets.every(Number.isFinite));assert.deepEqual(offsets,[...offsets].sort((a,b)=>a-b));assert.equal(offsets[0],-720);assert.equal(offsets.at(-1),840);
 }
 assert.equal(c.businessTimezoneLabel('Africa/Harare',new Date('2026-01-15T12:00:00Z')),'UTC+02:00 — Harare, Zimbabwe');
});
