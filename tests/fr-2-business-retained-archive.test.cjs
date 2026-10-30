const {test}=require('node:test');
const assert=require('node:assert/strict');
const {run,pgJsonb,utcTimestamp,retainedFingerprint,validRetainedContract}=require('../scripts/check-stage-3-business-api.cjs');
const contract={role_sha256:'1'.repeat(64),permissions_sha256:'2'.repeat(64),audit_sha256:'3'.repeat(64)};
test('Exact three-field contract accepts safe hashes',()=>assert.doesNotThrow(()=>validRetainedContract(contract)));
for(const [label,value] of [
 ['missing fingerprint',{role_sha256:contract.role_sha256}],
 ['extra override',{...contract,ignore_checks:true}],
 ['malformed fingerprint',{...contract,audit_sha256:'not-a-hash'}],
 ['null hash',{...contract,role_sha256:null}]
])test('Reject '+label+' before any network request',async()=>{
 let calls=0;const r=await run({ownerPassword:'DUMMY',outsiderPassword:'DUMMY',retainedArchive:value,fetcher:async()=>{calls++;throw Error('Unexpected transport');}});
 assert.equal(r.problem_code,'RETAINED_ARCHIVE_CONTRACT_INVALID');assert.equal(calls,0);assert.equal(r.incomplete_write_effects_may_remain,false);
});
test('JSONB key order uses byte length then byte ordering',()=>assert.equal(pgJsonb({bbb:3,ab:2,a:1,aa:4}),'{"a": 1, "aa": 4, "ab": 2, "bbb": 3}'));
test('Timestamp normalization preserves microseconds across offsets',()=>assert.equal(utcTimestamp('2026-10-14T23:17:46.683109+04:00'),'2026-10-14T19:17:46.683109+00:00'));
test('Timestamp normalization removes only trailing fractional zeroes',()=>assert.equal(utcTimestamp('2026-10-14T19:17:46.100000Z'),'2026-10-14T19:17:46.1+00:00'));
test('Equivalent UTC timestamps preserve full-row fingerprint',()=>assert.equal(retainedFingerprint([{created_at:'2026-10-14T19:17:46.683109Z'}],['created_at']),retainedFingerprint([{created_at:'2026-10-14T23:17:46.683109+04:00'}],['created_at'])));
test('Missing timezone cannot be guessed',()=>assert.throws(()=>utcTimestamp('2026-10-14T19:17:46'),/TIMESTAMP_INVALID/));
test('Sub-microsecond timestamp is rejected',()=>assert.throws(()=>utcTimestamp('2026-10-14T19:17:46.6831099Z'),/TIMESTAMP_INVALID/));
test('Numeric scale and floating point cannot be guessed',()=>assert.throws(()=>pgJsonb({version:1.5}),/UNSUPPORTED_NUMBER/));
