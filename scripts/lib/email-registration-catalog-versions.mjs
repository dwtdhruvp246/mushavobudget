// Exact version-specific references. Observed metadata is never rewritten.
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
const fields={
 schemas:['name','owner','ACL'],
 functions:['name','arguments','return_type','language','owner','kind','security_definer','strict','leakproof','volatility','parallel','default_arguments','settings','ACL','source_SHA256','anon_execute','authenticated_execute','service_role_execute'],
 relations:['name','kind','owner','RLS','force_RLS','ACL','options'],
 columns:['relation','name','type','type_modifier','not_null','identity','generated','default'],
 constraints:['relation','name','definition','validated'],indexes:['name','definition'],
 policies:[],triggers:['relation','name','enabled','definition'],schema_api_access:['role','usage','create'],table_api_access:['role','relation','privileges']
};
const notNull=new Map([
 ['rollout_control_changed_at_not_null','NOT NULL changed_at'],
 ['rollout_control_mode_not_null','NOT NULL mode'],
 ['rollout_control_singleton_not_null','NOT NULL singleton'],
 ['rollout_control_target_project_not_null','NOT NULL target_project']
]);
export function versionReference(base,versionNum){
 if(!Number.isInteger(versionNum))return null;
 const major=Math.floor(versionNum/10000);if(![15,16,17,18].includes(major))return null;
 const expected=structuredClone(base);
 // These changes apply only to the pinned reference, based on server version.
 if(major<18){
  for(const [name,definition]of notNull){
   const row=expected.constraints.filter(x=>x[1]===name);
   if(row.length!==1||row[0][0]!=='rollout_control'||row[0][2]!==definition||row[0][3]!==true)throw Error('PINNED_REFERENCE_REQUIRED');
   const column=expected.columns.find(x=>x[0]==='rollout_control'&&definition==='NOT NULL '+x[1]);
   if(!column||column[4]!==true)throw Error('PINNED_REFERENCE_REQUIRED');
  }
  expected.constraints=expected.constraints.filter(x=>!notNull.has(x[1]));
 }
 if(major<17){
  const row=expected.relations.find(x=>x[0]==='rollout_control');
  if(!row||row[5]!=='{postgres=arwdDxtm/postgres}')throw Error('PINNED_REFERENCE_REQUIRED');
  row[5]='{postgres=arwdDxt/postgres}';
 }
 return expected;
}
const hash=x=>createHash('sha256').update(JSON.stringify(x===undefined?null:x)).digest('hex');
const identity=(section,row)=>JSON.stringify(['columns','constraints','triggers'].includes(section)?row.slice(0,2):section==='functions'?row.slice(0,2):section==='table_api_access'?row.slice(0,2):row.slice(0,1));
function safeValue(value,field){
 if(value===null||typeof value==='boolean'||(typeof value==='number'&&Number.isSafeInteger(value)))return value;
 if(field==='source_SHA256'&&typeof value==='string'&&/^[a-f0-9]{64}$/.test(value))return value;
 if(field==='ACL')return new Map([['{postgres=arwdDxtm/postgres}','OWNER_ONLY_TABLE_WITH_MAINTAIN'],['{postgres=arwdDxt/postgres}','OWNER_ONLY_TABLE_WITHOUT_MAINTAIN'],['{postgres=X/postgres}','OWNER_ONLY_EXECUTE'],['{postgres=UC/postgres}','OWNER_ONLY_SCHEMA']]).get(value)??'OTHER_OR_UNRECOGNIZED_ACL';
 return 'VALUE_REDACTED';
}
export function compareCatalog(base,observed,versionNum){
 const reference=versionReference(base,versionNum),sections=[];
 const shape=observed!==null&&typeof observed==='object'&&!Array.isArray(observed)&&
  isDeepStrictEqual(Object.keys(observed).sort(),Object.keys(base).sort());
 for(const section of Object.keys(base)){
  const expectedRows=reference?.[section]??base[section],actual=observed?.[section];
  const rowsValid=actual===null||(Array.isArray(actual)&&actual.length<=128&&actual.every(x=>Array.isArray(x)&&x.length<=24));
  const rows=[];let unexpected=0;
  if(rowsValid&&Array.isArray(expectedRows)){
   const expectedIds=new Set(expectedRows.map(row=>identity(section,row)));
   if(Array.isArray(actual))unexpected=actual.filter(row=>!expectedIds.has(identity(section,row))).length;
   for(const row of expectedRows){
    const matches=Array.isArray(actual)?actual.filter(x=>identity(section,x)===identity(section,row)):[];
    const changes=[];
    if(matches.length===1)for(let i=0;i<Math.max(row.length,matches[0].length);i++)if(!isDeepStrictEqual(row[i],matches[0][i])){
     const field=fields[section]?.[i]??'unexpected_field';changes.push({field,expected_SHA256:hash(row[i]),observed_SHA256:hash(matches[0][i]),expected:safeValue(row[i],field),observed:safeValue(matches[0][i],field)});
    }
    // Labels derive exclusively from the pinned reference, never provider text.
    if(matches.length!==1||changes.length)rows.push({item:section==='columns'||section==='constraints'||section==='triggers'?row[1]:row[0],matching_identity_count:matches.length,field_changes:changes});
   }
  }
  sections.push({section,original_reference_exact:isDeepStrictEqual(base[section],actual),version_reference_exact:reference!==null&&isDeepStrictEqual(expectedRows,actual),
   original_reference_rows:Array.isArray(base[section])?base[section].length:0,version_reference_rows:Array.isArray(expectedRows)?expectedRows.length:0,
   observed_rows:Array.isArray(actual)?actual.length:actual===null?0:null,shape_valid:rowsValid,unexpected_identity_count:unexpected,
   expected_SHA256:hash(expectedRows),observed_SHA256:hash(actual),differences:rows});
 }
 return {original_reference_exact:shape&&isDeepStrictEqual(base,observed),version_reference_supported:reference!==null,
  version_reference_exact:shape&&reference!==null&&isDeepStrictEqual(reference,observed),sections};
}
