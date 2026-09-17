import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.9";
// @ts-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";

const CLAIM_BATCH_SIZE = 25;
const DELIVERY_TTL_SECONDS = 60 * 60;

type AdminOutboxJob = {
  id: string;
  notification_id: string;
  user_id: string;
  source_type: "subscription_payment_submitted" | "support_ticket_created" | "public_enquiry_created";
  source_id: string;
  notification_type: string;
  title: string;
  body: string;
  target_url: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

type ValidationResult = { valid: true } | { valid: false; reason: string };

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function secureEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (!leftBytes.length || leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function deliveryStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  return Number((error as { statusCode?: unknown }).statusCode || 0);
}

function permittedRoles(sourceType: AdminOutboxJob["source_type"]): string[] {
  if (sourceType === "subscription_payment_submitted") {
    return ["super_admin", "admin_staff", "finance_staff"];
  }
  return ["super_admin", "admin_staff", "support_staff"];
}

async function validateAdminJob(
  serviceClient: SupabaseClient,
  job: AdminOutboxJob,
): Promise<ValidationResult> {
  const { data: admin, error: adminError } = await serviceClient
    .from("app_admins")
    .select("role")
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (adminError) throw new Error(`admin_lookup:${adminError.code || "database_error"}`);
  if (!admin || !permittedRoles(job.source_type).includes(admin.role)) {
    return { valid: false, reason: "Recipient no longer has access to this admin alert." };
  }

  const { data: notification, error: notificationError } = await serviceClient
    .from("notifications")
    .select("id, user_id, read_at")
    .eq("id", job.notification_id)
    .maybeSingle();
  if (notificationError) throw new Error(`notification_lookup:${notificationError.code || "database_error"}`);
  if (!notification || notification.user_id !== job.user_id) {
    return { valid: false, reason: "The in-app notification is no longer available." };
  }
  if (notification.read_at) {
    return { valid: false, reason: "The admin already opened this notification." };
  }

  if (job.source_type === "subscription_payment_submitted") {
    const { data, error } = await serviceClient
      .from("subscription_payments")
      .select("status")
      .eq("id", job.source_id)
      .maybeSingle();
    if (error) throw new Error(`subscription_payment_lookup:${error.code || "database_error"}`);
    return data?.status === "pending_review"
      ? { valid: true }
      : { valid: false, reason: "The subscription payment no longer needs review." };
  }

  if (job.source_type === "support_ticket_created") {
    const { data, error } = await serviceClient
      .from("support_tickets")
      .select("status")
      .eq("id", job.source_id)
      .maybeSingle();
    if (error) throw new Error(`support_ticket_lookup:${error.code || "database_error"}`);
    return data && ["open", "in_progress", "waiting_customer"].includes(data.status)
      ? { valid: true }
      : { valid: false, reason: "The support ticket is no longer active." };
  }

  if (job.source_type === "public_enquiry_created") {
    const { data, error } = await serviceClient
      .from("enquiries")
      .select("status")
      .eq("id", job.source_id)
      .maybeSingle();
    if (error) throw new Error(`enquiry_lookup:${error.code || "database_error"}`);
    return data && ["new", "in_progress"].includes(data.status)
      ? { valid: true }
      : { valid: false, reason: "The public enquiry is no longer active." };
  }

  return { valid: false, reason: "Unsupported admin notification source." };
}

async function cancelJob(
  serviceClient: SupabaseClient,
  jobId: string,
  reason: string,
): Promise<void> {
  const { error } = await serviceClient
    .from("admin_notification_outbox")
    .update({ status: "cancelled", last_error: reason.slice(0, 500) })
    .eq("id", jobId)
    .eq("status", "processing");
  if (error) throw new Error(`outbox_cancel:${error.code || "database_error"}`);
}

async function recordJobResult(
  serviceClient: SupabaseClient,
  jobId: string,
  succeeded: boolean,
  permanentFailure: boolean,
  errorSummary: string | null,
  referenceTime: string,
): Promise<void> {
  const { error } = await serviceClient.rpc("record_admin_notification_outbox_result", {
    p_outbox_id: jobId,
    p_succeeded: succeeded,
    p_permanent_failure: permanentFailure,
    p_error: errorSummary,
    p_reference_time: referenceTime,
  });
  if (error) throw new Error(`outbox_result:${error.code || "database_error"}`);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const suppliedSecret = request.headers.get("x-mushavo-cron-secret") || "";
  if (!secureEqual(suppliedSecret, cronSecret)) {
    return json({ error: "CRON_AUTHENTICATION_FAILED" }, 401);
  }

  let requestBody: { source?: unknown };
  try {
    requestBody = await request.json();
  } catch (_error) {
    return json({ error: "INVALID_REQUEST_BODY" }, 400);
  }
  if (requestBody.source !== "cron") {
    return json({ error: "INVALID_DISPATCH_SOURCE" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return json({ error: "PUSH_SERVER_CONFIGURATION_INCOMPLETE" }, 500);
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (_error) {
    console.error("Admin dispatcher VAPID configuration is invalid");
    return json({ error: "PUSH_SERVER_CONFIGURATION_INVALID" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const referenceTime = new Date().toISOString();
  const { data: claimedRows, error: claimError } = await serviceClient.rpc(
    "claim_admin_notification_outbox",
    { p_batch_size: CLAIM_BATCH_SIZE, p_reference_time: referenceTime },
  );
  if (claimError) {
    console.error("Admin notification claim failed", claimError.code || "database_error");
    return json({ error: "ADMIN_OUTBOX_CLAIM_FAILED" }, 500);
  }

  const jobs = (claimedRows || []) as AdminOutboxJob[];
  const totals = {
    claimed: jobs.length,
    sent: 0,
    retry: 0,
    failed: 0,
    cancelled: 0,
    devices_delivered: 0,
    devices_failed: 0,
    devices_disabled: 0,
  };

  for (const job of jobs) {
    try {
      const validation = await validateAdminJob(serviceClient, job);
      if (!validation.valid) {
        await cancelJob(serviceClient, job.id, validation.reason);
        totals.cancelled += 1;
        continue;
      }

      const { data: subscriptions, error: subscriptionError } = await serviceClient
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth, failure_count")
        .eq("user_id", job.user_id)
        .is("disabled_at", null);
      if (subscriptionError) throw new Error(`subscription_lookup:${subscriptionError.code || "database_error"}`);
      if (!subscriptions?.length) {
        await cancelJob(serviceClient, job.id, "No active push subscriptions.");
        totals.cancelled += 1;
        continue;
      }

      let delivered = 0;
      let temporaryFailures = 0;
      let permanentFailures = 0;
      const sentAt = new Date().toISOString();
      const payload = JSON.stringify({
        type: job.notification_type,
        title: job.title,
        body: job.body,
        tag: `admin:${job.source_type}:${job.source_id}`,
        sent_at: sentAt,
        target_url: job.target_url,
      });

      for (const subscription of subscriptions as PushSubscriptionRow[]) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: DELIVERY_TTL_SECONDS, urgency: "normal" },
          );
          delivered += 1;
          totals.devices_delivered += 1;
          await serviceClient.from("push_subscriptions").update({
            last_success_at: sentAt,
            failure_count: 0,
          }).eq("id", subscription.id).eq("user_id", job.user_id);
        } catch (error) {
          totals.devices_failed += 1;
          const statusCode = deliveryStatus(error);
          const permanentlyGone = statusCode === 404 || statusCode === 410;
          if (permanentlyGone) {
            permanentFailures += 1;
            totals.devices_disabled += 1;
          } else {
            temporaryFailures += 1;
          }
          await serviceClient.from("push_subscriptions").update({
            failure_count: Number(subscription.failure_count || 0) + 1,
            disabled_at: permanentlyGone ? sentAt : null,
          }).eq("id", subscription.id).eq("user_id", job.user_id);
          console.warn("Admin notification device delivery failed", { statusCode, permanentlyGone });
        }
      }

      if (delivered > 0) {
        await recordJobResult(serviceClient, job.id, true, false, null, sentAt);
        totals.sent += 1;
      } else if (temporaryFailures > 0) {
        await recordJobResult(
          serviceClient,
          job.id,
          false,
          false,
          `Temporary delivery failure on ${temporaryFailures} device(s).`,
          sentAt,
        );
        totals.retry += 1;
      } else {
        await recordJobResult(
          serviceClient,
          job.id,
          false,
          permanentFailures > 0,
          "All registered push subscriptions are permanently invalid.",
          sentAt,
        );
        totals.failed += 1;
      }
    } catch (error) {
      console.error("Admin notification job processing failed", {
        jobId: job.id,
        category: error instanceof Error ? error.message.split(":")[0] : "unknown_error",
      });
      try {
        await recordJobResult(
          serviceClient,
          job.id,
          false,
          false,
          "Dispatcher could not complete this attempt.",
          new Date().toISOString(),
        );
        totals.retry += 1;
      } catch (_recordError) {
        totals.failed += 1;
        console.error("Admin notification retry state could not be recorded", { jobId: job.id });
      }
    }
  }

  return json({ status: "completed", ...totals }, 200);
});
