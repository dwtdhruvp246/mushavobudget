// Metadata stays collection-only. Acceptance is a separate strict browser/certificate predicate.
const state=x=>['unknown','neutral','insecure','secure','info','insecure-broken'].includes(x)?x:(x==null?'MISSING':'OTHER');
const protocol=x=>x==='TLS 1.2'?'TLS_1_2':x==='TLS 1.3'?'TLS_1_3':x==='QUIC'?'QUIC':x==null?'MISSING':'OTHER';
export function tlsObservation(origin){
 const result={collection_only:true,document_response_observed:false,document_matches_original_literal:false,document_path_class:'MISSING',document_security_state:'MISSING',document_protocol_class:'MISSING',visible_state_observed:false,visible_security_state:'MISSING',visible_protocol_class:'MISSING',visible_certificate_present:false,certificate_network_error_present:null,certificate_currently_valid:null,certificate_error_event_observed:false};
 return {
  event(method,p){
   if(method==='Network.responseReceived'&&p.type==='Document'){
    const u=p.response?.url;if(u!==origin+'/offline'&&u!==origin+'/offline.html')return;
    result.document_response_observed=true;result.document_matches_original_literal=u===origin+'/offline';result.document_path_class=u===origin+'/offline'?'OFFLINE_CLEAN':'OFFLINE_HTML';
    result.document_security_state=state(p.response.securityState);result.document_protocol_class=protocol(p.response.securityDetails?.protocol);
   }
   if(method==='Security.visibleSecurityStateChanged'){
    const v=p.visibleSecurityState??{},c=v.certificateSecurityState;
    result.visible_state_observed=true;result.visible_security_state=state(v.securityState);result.visible_certificate_present=!!c;result.visible_protocol_class=protocol(c?.protocol);
    result.certificate_network_error_present=c?typeof c.certificateNetworkError==='string'&&c.certificateNetworkError.length>0:null;
    result.certificate_currently_valid=c&&Number.isFinite(c.validFrom)&&Number.isFinite(c.validTo)?c.validFrom<=Date.now()/1000&&c.validTo>Date.now()/1000:null;
   }
   if(method==='Security.certificateError')result.certificate_error_event_observed=true;
  },snapshot(){return {...result};}
 };
}

export function browserTransportVerified(m,{certificateBypass=false}={}){
 return certificateBypass===false&&m?.document_response_observed===true&&['OFFLINE_CLEAN','OFFLINE_HTML'].includes(m.document_path_class)&&
  m.document_security_state==='secure'&&['TLS_1_2','TLS_1_3','QUIC'].includes(m.document_protocol_class)&&
  m.visible_state_observed===true&&m.visible_security_state==='secure'&&m.visible_protocol_class===m.document_protocol_class&&
  m.visible_certificate_present===true&&m.certificate_network_error_present===false&&m.certificate_currently_valid===true&&m.certificate_error_event_observed===false;
}
