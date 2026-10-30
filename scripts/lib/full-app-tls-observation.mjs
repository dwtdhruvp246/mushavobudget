// Full-app TLS metadata is tied to its actual document, never an offline-page URL.
const states=x=>['unknown','neutral','insecure','secure','info','insecure-broken'].includes(x)?x:'OTHER';
const protocols=x=>x==='TLS 1.2'?'TLS_1_2':x==='TLS 1.3'?'TLS_1_3':x==='QUIC'?'QUIC':'OTHER';
export function fullAppTLSObservation(origin){
 const r={document_response_observed:false,document_path_class:'MISSING',document_security_state:'MISSING',document_protocol_class:'MISSING',visible_state_observed:false,visible_security_state:'MISSING',visible_protocol_class:'MISSING',visible_certificate_present:false,certificate_network_error_present:null,certificate_currently_valid:null,certificate_error_event_observed:false};
 return {event(method,p){
  if(method==='Network.responseReceived'&&p.type==='Document'&&p.response?.status===200&&[origin+'/app',origin+'/app.html'].includes(p.response.url)){
   r.document_response_observed=true;r.document_path_class=p.response.url===origin+'/app'?'APP_CLEAN':'APP_HTML';r.document_security_state=states(p.response.securityState);r.document_protocol_class=protocols(p.response.securityDetails?.protocol);
  }
  if(method==='Security.visibleSecurityStateChanged'){
   const v=p.visibleSecurityState??{},c=v.certificateSecurityState;r.visible_state_observed=true;r.visible_security_state=states(v.securityState);r.visible_certificate_present=!!c;r.visible_protocol_class=protocols(c?.protocol);r.certificate_network_error_present=c?typeof c.certificateNetworkError==='string'&&c.certificateNetworkError.length>0:null;r.certificate_currently_valid=c&&Number.isFinite(c.validFrom)&&Number.isFinite(c.validTo)?c.validFrom<=Date.now()/1000&&c.validTo>Date.now()/1000:null;
  }
  if(method==='Security.certificateError')r.certificate_error_event_observed=true;
 },snapshot:()=>({...r})};
}
export function fullAppTransportVerified(r,{certificateBypass=false}={}){
 return certificateBypass===false&&r?.document_response_observed===true&&['APP_CLEAN','APP_HTML'].includes(r.document_path_class)&&r.document_security_state==='secure'&&['TLS_1_2','TLS_1_3','QUIC'].includes(r.document_protocol_class)&&r.visible_state_observed===true&&r.visible_security_state==='secure'&&r.visible_protocol_class===r.document_protocol_class&&r.visible_certificate_present===true&&r.certificate_network_error_present===false&&r.certificate_currently_valid===true&&r.certificate_error_event_observed===false;
}
