$ErrorActionPreference = 'Stop'
$ZipPath = 'C:\Users\HP\Desktop\Mushavo-Staging-Candidate-6205f79b476048a48edf4fe9e8a88cd0\mushavo-staging-upload-beb642556710479b91dbfde0931744a2.zip'
$ExpectedZipHash = 'c79819c4abb1cc8184d87ccfeb70c7d0e6b2cd7630e1f89072ea63415ba7707c'
$ActualZipHash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualZipHash -cne $ExpectedZipHash) {
    throw 'ZIP differs from the recorded upload. Return this error.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
    $Selected = @('assets/ledger-mark.svg', 'assets/pwa-icon.svg', 'manifest.webmanifest')
    $Details = @($Archive.Entries | Where-Object {
        $_.FullName.Replace('\', '/') -in $Selected
    } | ForEach-Object {
        [ordered]@{
            raw_entry_name = $_.FullName
            normalized_path = $_.FullName.Replace('\', '/')
            contains_backslash = $_.FullName.Contains('\')
            bytes = $_.Length
        }
    })
    [ordered]@{
        stage_step = 'FR.1.3_DELIVERY_DETAILS'
        scope = 'READ_ONLY_EXISTING_ZIP_METADATA'
        ZIP_hash_matches_recorded_upload = $true
        selected_entries = $Details
        files_changed = $false
    } | ConvertTo-Json -Depth 5
} finally { $Archive.Dispose() }

$DeliveryProbe = @'
const {createHash}=require('node:crypto');
const origin='https://mushavo-budget-staging.pages.dev';
const paths=['/assets/ledger-mark.svg','/assets/pwa-icon.svg','/manifest.webmanifest'];
const types=['text/html','text/plain','application/octet-stream','application/json','application/manifest+json','image/svg+xml','text/xml','application/xml'];
const caches=['HIT','MISS','DYNAMIC','REVALIDATED','BYPASS','EXPIRED','UPDATING','STALE'];
(async()=>{
 const samples=[];
 for(const path of paths)for(const probe of [false,true]){
  let reader,status=null;
  try{
   const route=path+(probe?'?fr1_delivery_probe=20261013':'');
   const r=await fetch(origin+route,{method:'GET',redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(6000),headers:{Accept:'*/*'}});
   status=r.status;
   const media=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
   const cache=(r.headers.get('cf-cache-status')||'').toUpperCase();
   const chunks=[];let bytes=0;
   if(r.body){
    reader=r.body.getReader();
    for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.length;if(bytes>65536)throw Error('BODY_LIMIT');chunks.push(Buffer.from(x.value));}
   }
   const data=Buffer.concat(chunks);
   samples.push({path,probe_query_used:probe,status,bytes,sha256:createHash('sha256').update(data).digest('hex'),observed_media_type:types.includes(media)?media:'OTHER_OR_UNSET',cache_status:caches.includes(cache)?cache:'OTHER_OR_UNSET',result:'METADATA_RECEIVED'});
  }catch{
   samples.push({path,probe_query_used:probe,status,result:'HTTP_METADATA_UNAVAILABLE_OR_SIZE_LIMIT'});
  }finally{reader?.cancel().catch(()=>{});}
 }
 console.log(JSON.stringify({stage_step:'FR.1.3_DELIVERY_DETAILS',scope:'SIX_FIXED_PUBLIC_STATIC_GET_METADATA_REQUESTS',origin,authenticated_requests:0,redirects_followed:0,samples,bodies_keys_or_exception_text_printed:false,files_or_settings_changed:false},null,2));
})().catch(()=>{console.error('SANITIZED_DELIVERY_PROBE_FAILURE');process.exitCode=1;});
'@
$DeliveryProbe | node -
if ($LASTEXITCODE -ne 0) {
    throw 'Delivery probe could not finish. Return the sanitized error.'
}

