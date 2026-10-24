import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const business = await readFile(new URL('../business.js', import.meta.url), 'utf8');
const part = (source, start, end) => {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing source boundaries: ${start}`);
  return source.slice(from, to);
};
const types = {'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'application/pdf':'pdf'};
const cap = 10 * 1024 * 1024;

function appHarness() {
  const calls = {upload:[], sign:[], open:[], errors:[]};
  let finish;
  const pending = new Promise(resolve => {finish = resolve;});
  const context = {
    state:{session:{user:{id:'owner'}}, family:null, paymentRecords:[{id:'record',proof_path:'personal/owner/proof.pdf'}]},
    workspace:{id:'personal'}, authDataEpoch:1,
    PAYMENT_PROOF_BUCKET:'payment-proofs', SUBSCRIPTION_PROOF_BUCKET:'subscription-proofs',
    PAYMENT_PROOF_TYPES:new Set(Object.keys(types)), PAYMENT_PROOF_MAX_BYTES:cap,
    crypto:{randomUUID:()=> 'synthetic-uuid'},
    currentBudgetWorkspace:()=>context.workspace,
    supabase:{storage:{from(bucket){return {
      async upload(path,file,options){calls.upload.push({bucket,path,file,options});return {error:null};},
      createSignedUrl(path,ttl){calls.sign.push({bucket,path,ttl});return pending;}
    };}}},
    document:{createElement(){return {click(){calls.open.push({href:this.href,target:this.target,rel:this.rel});}};}},
    showToast:message=>calls.errors.push(message)
  };
  vm.createContext(context);
  for (const [start,end] of [
    ['function validateProofFile(', 'function statusBadge('],
    ['async function uploadPaymentProof(', 'async function openPaymentProof('],
    ['async function uploadSubscriptionProof(', 'async function submitSubscriptionRenewal('],
    ['async function openPaymentProof(', 'async function deletePaymentRecord(']
  ]) vm.runInContext(part(app,start,end),context);
  return {context,calls,finish};
}

for (const [mime,extension] of Object.entries(types)) {
  for (const size of [1,cap]) test(`actual proof upload accepts ${mime} at ${size} bytes and generates canonical name`, async()=>{
    const h=appHarness(), file={name:'../../unsafe.html',type:mime,size};
    const receipt=await h.context.uploadPaymentProof({visibility:'personal'},file);
    const subscription=await h.context.uploadSubscriptionProof(file,'household');
    assert.equal(receipt.path,`personal/owner/synthetic-uuid.${extension}`);
    assert.equal(subscription,`workspaces/household/owner/synthetic-uuid.${extension}`);
    assert.equal(receipt.name,file.name);
    assert.equal(h.calls.upload.length,2);
    for(const call of h.calls.upload){assert.equal(call.options.upsert,false);assert.equal(call.options.contentType,mime);assert.equal(call.file,file);}
  });
}
for (const size of [0,-1,cap+1,NaN,Infinity,1.5,undefined]) test(`actual upload functions reject invalid size ${String(size)} before Storage`,async()=>{
  const h=appHarness(),file={name:'proof.pdf',type:'application/pdf',size};
  await assert.rejects(h.context.uploadPaymentProof({visibility:'personal'},file));
  await assert.rejects(h.context.uploadSubscriptionProof(file,'workspace'));
  assert.equal(h.calls.upload.length,0);
});
for(const mime of ['text/html','image/svg+xml','application/javascript','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','']) {
  test(`Personal/Family proof uploader rejects ${mime || 'missing MIME'} without changing general Business document support`,async()=>{
    const h=appHarness(),file={name:'proof.pdf',type:mime,size:1};
    await assert.rejects(h.context.uploadPaymentProof({visibility:'personal'},file));
    await assert.rejects(h.context.uploadSubscriptionProof(file,'workspace'));
    assert.equal(h.calls.upload.length,0);
  });
}
test('Family proof object keeps owner/uploader path positions and original display name',async()=>{
  const h=appHarness();h.context.state.family={id:'family',owner_id:'head'};
  const result=await h.context.uploadPaymentProof({visibility:'family',family_id:'family'},{name:'receipt.png',type:'image/png',size:12});
  assert.equal(result.path,'families/family/head/owner/synthetic-uuid.png');assert.equal(result.name,'receipt.png');
});
test('client preflight does not claim byte-content verification',()=>{
  const h=appHarness();assert.equal(h.context.validateProofFile({type:'application/pdf',size:1,name:'wrong.exe'}),'pdf');
});

const appChanges={
  account:c=>{c.state.session.user.id='other';},
  signout:c=>{c.state.session=null;},
  epoch:c=>{c.authDataEpoch++;},
  workspace:c=>{c.workspace={id:'other'};},
  family:c=>{c.state.family={id:'other'};},
  record:c=>{c.state.paymentRecords=[];},
  path:c=>{c.state.paymentRecords[0].proof_path='replacement.pdf';}
};
test('current Personal proof opens with TTL 60 and opener/referrer protection',async()=>{
  const h=appHarness(), work=h.context.openPaymentProof('record');h.finish({data:{signedUrl:'https://synthetic.invalid/signed'},error:null});await work;
  assert.equal(h.calls.sign[0].ttl,60);assert.equal(h.calls.open.length,1);assert.equal(h.calls.open[0].rel,'noopener noreferrer');
});
for(const [name,change] of Object.entries(appChanges)) test(`Personal signed-link response and errors discarded after ${name} change`,async()=>{
  for(const error of [null,{message:'synthetic failure'}]){
    const h=appHarness(),work=h.context.openPaymentProof('record');change(h.context);
    h.finish({data:{signedUrl:'https://synthetic.invalid/signed'},error});await work;
    assert.equal(h.calls.open.length,0);assert.equal(h.calls.errors.length,0);
  }
});
test('Personal current error is shown and unknown record does not sign',async()=>{
  const h=appHarness();await h.context.openPaymentProof('missing');assert.equal(h.calls.sign.length,0);
  const work=h.context.openPaymentProof('record');h.finish({error:{message:'synthetic failure'}});await work;assert.equal(h.calls.errors.length,1);
});

function businessHarness() {
  const calls={sign:[],open:[],errors:[]};let finish;
  const pending=new Promise(resolve=>{finish=resolve;});
  const context={
    state:{session:{user:{id:'owner'}},workspace:{id:'business'},
      claims:[{id:'claim'}],claimReceipts:[{parent_id:'claim',storage_path:'claim.pdf'}],
      bills:[{id:'bill'}],billPayments:[{id:'payment',bill_id:'bill'}],
      billDocuments:[{parent_id:'bill',storage_path:'bill.pdf'},{parent_id:'payment',storage_path:'payment.pdf'}],
      billingSnapshot:{history:[{proofs:[{path:'billing.pdf'}]}]}},
    workspaceLoadSequence:1,businessAuthEpoch:1,openedClaimId:'claim',openedBillId:'bill',owner:true,
    businessBillingOwner:()=>context.owner,
    query:async(_label,promise)=>{const response=await promise;if(response.error)throw response.error;return response.data;},
    supabase:{storage:{from(bucket){return {createSignedUrl(path,ttl){calls.sign.push({bucket,path,ttl});return pending;}};}}},
    window:{open:(...args)=>calls.open.push(args)},friendlyMessage:error=>error.message,
    setClaimMessage:(...args)=>calls.errors.push(args)
  };
  vm.runInNewContext(part(business,'async function openBusinessBillingProof(', 'async function printBusinessBillingReceipt('),context);
  return {context,calls,finish};
}
const businessChanges={
  account:c=>{c.state.session.user.id='other';},signout:c=>{c.state.session=null;},
  epoch:c=>{c.businessAuthEpoch++;},sequence:c=>{c.workspaceLoadSequence++;},workspace:c=>{c.state.workspace={id:'other'};},
  record:c=>{c.state.claimReceipts=[];c.state.billDocuments=[];c.state.billingSnapshot=null;},
  parent:c=>{c.openedClaimId='other';c.openedBillId='other';c.owner=false;}
};
const launch=(h,kind)=>kind==='billing'?h.context.openBusinessBillingProof('billing.pdf'):h.context.openBusinessDocumentProof(`${kind}.pdf`,kind);
for(const kind of ['claim','bill','billing']){
  test(`current ${kind} proof opens with TTL 60 and protected window`,async()=>{
    const h=businessHarness(),work=launch(h,kind);h.finish({data:{signedUrl:'https://synthetic.invalid/signed'}});await work;
    assert.equal(h.calls.sign.length,1);assert.equal(h.calls.sign[0].ttl,60);assert.equal(h.calls.open.length,1);
    assert.equal(h.calls.open[0][2],'noopener,noreferrer');
  });
  for(const [name,change] of Object.entries(businessChanges))test(`${kind} signed-link response and errors discarded after ${name} change`,async()=>{
    for(const error of [null,{message:'synthetic failure'}]){
      const h=businessHarness(),work=launch(h,kind);change(h.context);h.finish({data:{signedUrl:'https://synthetic.invalid/signed'},error});await work;
      assert.equal(h.calls.open.length,0);assert.equal(h.calls.errors.length,0);
    }
  });
  test(`${kind} current signing error remains visible`,async()=>{
    const h=businessHarness(),work=launch(h,kind);h.finish({error:{message:'synthetic failure'}});await work;assert.equal(h.calls.errors.length,1);
  });
}
test('bill payment proof allowed only while linked to the selected bill',async()=>{
  const h=businessHarness(),work=h.context.openBusinessDocumentProof('payment.pdf','bill');
  h.context.state.billPayments[0].bill_id='other';h.finish({data:{signedUrl:'https://synthetic.invalid/signed'}});await work;assert.equal(h.calls.open.length,0);
});
test('valid bill payment proof opens',async()=>{
  const h=businessHarness(),work=h.context.openBusinessDocumentProof('payment.pdf','bill');h.finish({data:{signedUrl:'https://synthetic.invalid/signed'}});await work;assert.equal(h.calls.open.length,1);
});
test('unknown document, missing identity and missing parent do not request a signature',async()=>{
  const h=businessHarness();await h.context.openBusinessDocumentProof('foreign.pdf','claim');await h.context.openBusinessDocumentProof('claim.pdf','unknown');
  h.context.state.session=null;await h.context.openBusinessDocumentProof('claim.pdf','claim');
  h.context.state.session={user:{id:'owner'}};h.context.state.claims=[];await h.context.openBusinessDocumentProof('claim.pdf','claim');assert.equal(h.calls.sign.length,0);
});
test('both actual Business click handlers delegate to the tested document opener',()=>{
  assert.match(business,/await openBusinessDocumentProof\(button\.dataset\.proofPath, "bill"\)/);
  assert.match(business,/await openBusinessDocumentProof\(button\.dataset\.receiptPath, "claim"\)/);
});
