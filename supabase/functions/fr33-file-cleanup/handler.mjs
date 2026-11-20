import { verifiedCleanupAttempt } from "./scheduled-auth.mjs";
import { reconcileOrdinaryUploads, reconcileReplacedLogos, reconcileUnlinkedSubscriptions } from "../_shared/business-upload-cleanup.mjs";
import { reconcileSharedProof } from "../_shared/fr33-shared-proof-handoff.mjs";
import { reconcileBillingArchiveExpiry } from "../_shared/fr33-billing-archive-expiry.mjs";

const rehearsalPath = /^personal\/[a-f0-9-]{36}\/managed-upload-v1\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/;
const headers = {"cache-control":"no-store","x-content-type-options":"nosniff"};

export function createCleanupHandler({ projectReady, publicKey, rpc, remove, copy, read, seed }) {
  return async request => {
    const fail = status => new Response(null, {status,headers});
    if (request.method !== "POST") return fail(405);
    if (!projectReady) return fail(503);
    try {
      const dispatch = await verifiedCleanupAttempt(request.headers,publicKey);
      if (!dispatch) return fail(403);
      const signed = {p_nonce:dispatch.nonce,p_epoch:dispatch.seconds};
      const job = await rpc("fr33_begin_storage_job",signed);
      if (!job) return fail(204);

      const finishOrdinary = (bucket,path,token) =>
        rpc("fr32_finish_ordinary_cleanup",{p_bucket:bucket,p_path:path,p_token:token});
      if (job.operation === "rehearsal" || job.operation === "rehearsal_seed") {
        const path = job.rehearsal_path;
        if (!rehearsalPath.test(path || "")) return fail(503);
        if (job.operation === "rehearsal_seed") {
          if (!seed) return fail(503);
          await seed(path);
          return fail(204);
        }
        const result = await reconcileOrdinaryUploads({
          claim: () => rpc("fr33_claim_storage_rehearsal",{...signed,p_path:path}),
          remove: (bucket,key) => {
            if (bucket !== "payment-proofs" || key !== path) throw Error("Rehearsal scope");
            return remove(bucket,key);
          },
          finish: finishOrdinary,
        });
        return Response.json({ordinaryUploads:result},{headers});
      }
      if (job.operation !== "reconcile" || job.rehearsal_path !== null) return fail(503);

      const results = {};
      const [ordinaryDue,logoDue,subscriptionDue] = await Promise.all([
        rpc("fr32_ordinary_cleanup_due"),rpc("fr32_logo_replacement_mode"),rpc("managed_subscription_cleanup_due"),
      ]);
      if (ordinaryDue) results.ordinaryUploads = await reconcileOrdinaryUploads({
        claim: limit => rpc("fr32_claim_ordinary_cleanup",{...signed,p_limit:limit}),
        remove,finish:finishOrdinary,
      });
      if (logoDue) results.logos = await reconcileReplacedLogos({
        claim: limit => rpc("fr32_claim_logo_replacements",{...signed,p_limit:limit}),
        remove,finish:(path,token) => rpc("fr32_finish_logo_replacement",{p_object:path,p_token:token}),
      });
      if (subscriptionDue) results.subscriptionProofs = await reconcileUnlinkedSubscriptions({
        claim: limit => rpc("claim_managed_subscription_cleanup",{...signed,p_limit:limit}),
        remove,finish:(path,token) => rpc("finish_managed_subscription_cleanup",{p_path:path,p_token:token}),
      });
      const proofTransfer = await reconcileSharedProof({
        claim: () => rpc("fr33_claim_shared_proof_handoff"),
        step: (plan,step,digest=null) => rpc("fr33_shared_proof_handoff_step",{
          p_id:plan.id,p_token:plan.lease_token,p_step:step,p_digest:digest,
        }),
        copy,read,remove,
      });
      if (proofTransfer.claimed) results.proofTransfer = proofTransfer;
      const billing = await reconcileBillingArchiveExpiry({
        step: (workspace,lease) => rpc("fr33_billing_archive_expiry_step",workspace ? {p_workspace:workspace,p_lease:lease} : {}),
        remove,
      }).catch(() => ({status:"retry"}));
      if (billing) results.billingExpiry = billing;
      return Object.keys(results).length ? Response.json(results,{headers}) : fail(204);
    } catch { return fail(503); }
  };
}
