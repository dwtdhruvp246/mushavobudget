const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rpcSucceeded}=require('../scripts/check-stage-3-business-api.cjs');
const empty=status=>({status,data:null,body_read_ok:true,body_empty:true,body_json_ok:false});
const json=(status,data)=>({status,data,body_read_ok:true,body_empty:false,body_json_ok:true});
const cases=[
 ['archive void accepts 204 empty','archive_business_role',empty(204),true],
 ['permission override void accepts 204 empty','set_business_member_permission',empty(204),true],
 ['void accepts legacy 200 JSON null','archive_business_role',json(200,null),true],
 ['void accepts legacy 200 JSON empty string','archive_business_role',json(200,''),true],
 ['void accepts legacy 200 empty body','archive_business_role',empty(200),true],
 ['void rejects 204 JSON null body','archive_business_role',json(204,null),false],
 ['void rejects 204 unexpected object body','archive_business_role',json(204,{}),false],
 ['void rejects 200 unexpected object body','archive_business_role',json(200,{}),false],
 ['void rejects 200 malformed body','archive_business_role',{...json(200,null),body_json_ok:false},false],
 ['void rejects unreadable body','archive_business_role',{...empty(204),body_read_ok:false},false],
 ['void rejects 201','archive_business_role',empty(201),false],
 ['void rejects 202','archive_business_role',empty(202),false],
 ['void rejects permission denial','archive_business_role',json(403,{code:'42501'}),false],
 ['void rejects server failure','archive_business_role',json(500,{code:'XX000'}),false],
 ['nonvoid role save rejects 204','save_business_role',empty(204),false],
 ['unknown RPC rejects 204','not_a_reviewed_void_rpc',empty(204),false],
 ['nonvoid role save accepts 200 JSON','save_business_role',json(200,{version:1}),true]
];
for(const [title,name,response,expected] of cases)test(title,()=>assert.equal(rpcSucceeded(name,response),expected));
