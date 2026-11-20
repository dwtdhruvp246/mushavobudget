import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { createCleanupHandler } from "./handler.mjs";
import { readSignedPrivateObject } from "../get-private-file/signed-private-file.mjs";

const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const projectReady = projectUrl === "https://kttkospkblwvguuwnhjj.supabase.co" && Boolean(serviceKey);
const client = projectReady ? createClient(projectUrl,serviceKey,{
  auth:{persistSession:false,autoRefreshToken:false},
}) : null;
const publicKey: JsonWebKey = {"kty":"EC","x":"6fXiiO46edBiYTQFRcwdFOHKaMH9ykN7v4bJf545wks","y":"eFoSsHsIg0SobFZM9_eeRt-E_E_KfR2yxXf95NgKBxQ","crv":"P-256"};

Deno.serve(createCleanupHandler({
  projectReady,publicKey,
  rpc:async (functionName: string,args?:Record<string,unknown>) => {
    const result = await client!.rpc(functionName,args);
    if (result.error) throw Error("Storage cleanup RPC unavailable");
    return result.data;
  },
  remove:(bucket:string,path:string) => client!.storage.from(bucket).remove([path]),
  copy:async (bucketId:string,sourceKey:string,sourceVersionId:string,destinationKey:string) => {
    const response = await fetch(projectUrl+"/storage/v1/object/copy",{
      method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),
      headers:{authorization:"Bearer "+serviceKey,apikey:serviceKey,"content-type":"application/json"},
      body:JSON.stringify({bucketId,sourceKey,sourceVersionId,destinationKey}),
    });
    // Copy may have succeeded earlier; the transfer adapter checks both bytes
    // and object metadata before linking the destination.
    await response.body?.cancel();
  },
  read:async (bucket:string,path:string,maxBytes:number) => (await readSignedPrivateObject({
    bucket,path,maxBytes,projectUrl,mint:(name,objectPath,seconds) =>
      client!.storage.from(name).createSignedUrl(objectPath,seconds),
  })).data,
}));
