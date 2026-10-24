// Diagnostic classification is NOT a route allowlist. All unmatched fixture routes stay 404/failing.
import {createHash} from 'node:crypto';
const probes=new Map([
 ['/', 'ROOT_DOCUMENT'],['/favicon.svg','FAVICON_SVG'],['/favicon.png','FAVICON_PNG'],['/favicon-16x16.png','FAVICON_16'],['/favicon-32x32.png','FAVICON_32'],
 ['/apple-touch-icon.png','APPLE_TOUCH_ICON'],['/apple-touch-icon-precomposed.png','APPLE_TOUCH_ICON_PRECOMPOSED'],
 ['/browserconfig.xml','BROWSER_CONFIG_XML'],['/site.webmanifest','SITE_WEBMANIFEST'],['/manifest.json','MANIFEST_JSON'],['/manifest.webmanifest','MANIFEST_WEBMANIFEST'],
 ['/.well-known/appspecific/com.chrome.devtools.json','DEVTOOLS_WORKSPACE_PROBE'],['/.well-known/traffic-advice','TRAFFIC_ADVICE_PROBE'],['/robots.txt','ROBOTS_TXT']
]);
const destinations=new Set(['','document','iframe','image','script','style','font','manifest','worker','serviceworker','empty']);
export function summarizeUnreviewedRoute(url,method,destination){
 if(!(url instanceof URL))throw Error('ROUTE_DIAGNOSTIC_INPUT_REQUIRED');
 return{probe_tag:probes.get(url.pathname)||'UNCLASSIFIED',pathname_sha256:createHash('sha256').update(url.pathname).digest('hex'),method:['GET','POST','HEAD','OPTIONS'].includes(method)?method:'OTHER',destination:destinations.has(destination)?(destination||'EMPTY'):'OTHER',query_present:!!url.search};
}
export function collectUnreviewedRoute(state,url,method,destination){
 state.unexpected++;const entry=summarizeUnreviewedRoute(url,method,destination),key=JSON.stringify(entry),prior=state.unreviewedRoutes.get(key);
 if(prior){prior.count++;return;}
 if(state.unreviewedRoutes.size>=16){state.unreviewedRouteOverflow++;return;}
 state.unreviewedRoutes.set(key,{...entry,count:1});
}
export function safeRouteAudit(state){return{unexpected_request_count:state.unexpected,overflow_request_count:state.unreviewedRouteOverflow,entries:[...state.unreviewedRoutes.values()].map(x=>({...x}))};}
