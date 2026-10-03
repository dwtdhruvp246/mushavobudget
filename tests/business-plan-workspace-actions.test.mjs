import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function activeOwnedBusinessWorkspaces('),source.indexOf('function renderWorkspacePlans('));
const now=Date.parse('2026-10-03T12:00:00Z');
const active={workspace_id:'active',status:'active',entitlement_start_at:'2026-10-01T00:00:00Z',paid_through_at:'2027-10-01T00:00:00Z'};
function context(workspaces,subscriptions){const c=vm.createContext({state:{session:{user:{id:'owner'}},workspaces,ownedBusinessSubscriptions:subscriptions}});vm.runInContext(helper,c);return c;}
const business=id=>({id,workspace_type:'business',owner_id:'owner',status:'active'});
test('Business entry points include only owned, active and currently paid workspaces',()=>{
 const ids=['active','expired','suspended','closed','future','pending','missing','invalid','other-owner','personal'];
 const workspaces=ids.map(business);workspaces.find(w=>w.id==='suspended').status='suspended';workspaces.find(w=>w.id==='closed').status='closed';workspaces.find(w=>w.id==='other-owner').owner_id='someone-else';workspaces.find(w=>w.id==='personal').workspace_type='personal';
 const subscriptions=ids.filter(id=>id!=='missing').map(id=>({...active,workspace_id:id}));
 subscriptions.find(s=>s.workspace_id==='expired').paid_through_at='2026-10-03T12:00:00Z';subscriptions.find(s=>s.workspace_id==='future').entitlement_start_at='2026-10-04T00:00:00Z';subscriptions.find(s=>s.workspace_id==='pending').status='pending';subscriptions.find(s=>s.workspace_id==='invalid').paid_through_at='invalid';
 const c=context(workspaces,subscriptions);assert.deepEqual(Array.from(c.activeOwnedBusinessWorkspaces(now),w=>w.id),['active']);
});
test('Multiple owned businesses remain distinct and account changes remove old owner entry points',()=>{
 const c=context([business('active'),business('second')],[active,{...active,workspace_id:'second'}]);assert.deepEqual(Array.from(c.activeOwnedBusinessWorkspaces(now),w=>w.id),['active','second']);
 c.state.session.user.id='new-owner';assert.equal(c.activeOwnedBusinessWorkspaces(now).length,0);c.state.session=null;assert.equal(c.activeOwnedBusinessWorkspaces(now).length,0);
});
test('The active workspace option disappears when its subscription expires or ownership transfers',()=>{
 const c=context([business('active')],[active]);assert.equal(c.activeOwnedBusinessWorkspaces(now).length,1);assert.equal(c.activeOwnedBusinessWorkspaces(Date.parse(active.paid_through_at)).length,0);
 c.state.workspaces[0].owner_id='new-owner';assert.equal(c.activeOwnedBusinessWorkspaces(now).length,0);
});
