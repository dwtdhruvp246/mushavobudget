import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readStagingConfiguration,validateStagingConfiguration} from '../scripts/check-fr-2-batch-w-completed-admin-invitation.mjs';
const origin='https://dczlddwbtgvfdujgcitb.supabase.co';
const key=claims=>'header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
test('only staging public publishable or legacy anon configuration is accepted',()=>{
 for(const publicKey of ['sb_publishable_public_fixture_123456',key({role:'anon',ref:'dczlddwbtgvfdujgcitb'})]){
  const result=validateStagingConfiguration({supabaseUrl:origin,supabasePublishableKey:publicKey});
  assert.equal(result.origin,origin);assert.equal(result.key,publicKey);
 }
});
test('production origins and service-role/secret credentials are refused before network',()=>{
 assert.throws(()=>validateStagingConfiguration({supabaseUrl:'https://production.supabase.co',supabasePublishableKey:'sb_publishable_public_fixture_123456'}),/STAGING_PUBLIC_CONFIGURATION_REQUIRED/);
 for(const publicKey of ['sb_secret_private_fixture_123456',key({role:'service_role',ref:'dczlddwbtgvfdujgcitb'}),key({role:'anon',ref:'wrong_project'})]){
  assert.throws(()=>validateStagingConfiguration({supabaseUrl:origin,supabasePublishableKey:publicKey}),/PUBLIC_ANON_OR_PUBLISHABLE_KEY_REQUIRED/);
 }
});
test('an arbitrary ZIP cannot supply configuration',()=>{
 assert.throws(()=>readStagingConfiguration(Buffer.from('untrusted archive')),/ACCEPTED_STAGING_ZIP_REQUIRED/);
});
