import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.9";
// @ts-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";

const CLAIM_BATCH_SIZE = 25;
const DELIVERY_TTL_SECONDS = 60 * 60;

type OutboxJob = {
  id: string;
  user_id: string;
  workspace_id: string;
  source_type: string;
  source_id: string;
  notification_type: string;
  title: string;
  body: string;
  target_url: string;
  idempotency_key: string;
};

type PaymentItem = {
  id: string;
  workspace_id: string;
  family_id: string | null;
  owner_id: string;
  visibility: "personal" | "family";
  responsible_member_id: string | null;
  amount: number | string;
  recurrence_type: string;
  status: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
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

function paymentPeriodFromKey(job: OutboxJob, recurrenceType: string): string | null {
  const match = job.idempotency_key.match(
    /^payment:([0-9a-f-]{36}):due-date:(\d{4}-\d{2}-\d{2}):reminder-date:(\d{4}-\d{2}-\d{2})$/i,
  );
  if (!match || match[1].toLowerCase() !== job.source_id.toLowerCase()) return null;
  return recurrenceType === "custom_days" ? match[2] : `${match[2].slice(0, 7)}-01`;
}

async function validatePaymentJob(
  serviceClient: SupabaseClient,
  job: OutboxJob,
): Promise<ValidationResult> {
  if (job.source_type !== "payment") {
    return { valid: false, reason: "Unsupported notification source." };
  }

  const { data: itemData, error: itemError } = await serviceClient
    .from("payment_items")
    .select("id, workspace_id, family_id, owner_id, visibility, responsible_member_id, amount, recurrence_type, status")
    .eq("id", job.source_id)
    .maybeSingle();
  if (itemError) throw new Error(`payment_lookup:${itemError.code || "database_error"}`);
  const item = itemData as PaymentItem | null;
  if (!item || item.status !== "active" || item.workspace_id !== job.workspace_id) {
    return { valid: false, reason: "Payment is no longer active." };
  }

  const { data: settings, error: settingsError } = await serviceClient
    .from("workspace_settings")
    .select("reminder_enabled")
    .eq("workspace_id", job.workspace_id)
    .maybeSingle();
  if (settingsError) throw new Error(`settings_lookup:${settingsError.code || "database_error"}`);
  if (!settings?.reminder_enabled) {
    return { valid: false, reason: "Payment reminders are disabled." };
  }

  let assignedUserId: string | null = null;
  if (item.visibility === "personal") {
    assignedUserId = item.owner_id;
  } else if (item.responsible_member_id) {
    const { data: member, error: memberError } = await serviceClient
      .from("family_members")
      .select("user_id, family_id, status")
      .eq("id", item.responsible_member_id)
      .maybeSingle();
    if (memberError) throw new Error(`member_lookup:${memberError.code || "database_error"}`);
    if (member?.status === "active" && member.family_id === item.family_id) {
      assignedUserId = member.user_id;
    }
  } else {
    const { data: workspace, error: workspaceError } = await serviceClient
      .from("budget_workspaces")
      .select("owner_id, status")
      .eq("id", job.workspace_id)
      .maybeSingle();
    if (workspaceError) throw new Error(`workspace_lookup:${workspaceError.code || "database_error"}`);
    if (workspace?.status === "active") assignedUserId = workspace.owner_id;
  }
  if (!assignedUserId || assignedUserId !== job.user_id) {
    return { valid: false, reason: "Payment assignment has changed." };
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", job.workspace_id)
    .eq("user_id", job.user_id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) throw new Error(`membership_lookup:${membershipError.code || "database_error"}`);
  if (!membership) return { valid: false, reason: "Recipient is no longer active." };

  const periodStart = paymentPeriodFromKey(job, item.recurrence_type);
  if (!periodStart) return { valid: false, reason: "Reminder occurrence is invalid." };

  const { data: records, error: recordsError } = await serviceClient
    .from("payment_records")
    .select("amount")
    .eq("payment_item_id", item.id)
    .eq("period_start", periodStart);
  if (recordsError) throw new Error(`payment_records_lookup:${recordsError.code || "database_error"}`);
  const paid = (records || []).reduce((sum, record) => sum + Number(record.amount || 0), 0);
  if (paid >= Number(item.amount || 0)) {
    return { valid: false, reason: "Payment is already fully paid." };
  }

  return { valid: true };
}

async function cancelJob(
  serviceClient: SupabaseClient,
  jobId: string,
  reason: string,
): Promise<void> {
  const { error } = await serviceClient
    .from("notification_outbox")
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
  const { error } = await serviceClient.rpc("record_notification_outbox_result", {
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
    console.error("Dispatcher VAPID configuration is invalid");
    return json({ error: "PUSH_SERVER_CONFIGURATION_INVALID" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const referenceTime = new Date().toISOString();
  let enqueued = 0;
  let enqueueFailed = false;

  const { data: enqueueCount, error: enqueueError } = await serviceClient.rpc(
    "enqueue_due_payment_reminders",
    { p_reference_time: referenceTime },
  );
  if (enqueueError) {
    enqueueFailed = true;
    console.error("Reminder enqueue failed", enqueueError.code || "database_error");
  } else {
    enqueued = Number(enqueueCount || 0);
  }

  const { data: claimedRows, error: claimError } = await serviceClient.rpc(
    "claim_notification_outbox",
    {
      p_batch_size: CLAIM_BATCH_SIZE,
      p_reference_time: referenceTime,
    },
  );
  if (claimError) {
    console.error("Reminder claim failed", claimError.code || "database_error");
    return json({ error: "OUTBOX_CLAIM_FAILED", enqueued, enqueue_failed: enqueueFailed }, 500);
  }

  const jobs = (claimedRows || []) as OutboxJob[];
  const totals = {
    enqueued,
    enqueue_failed: enqueueFailed,
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
      const validation = await validatePaymentJob(serviceClient, job);
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
        tag: `payment:${job.source_id}:${job.notification_type}`,
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
          console.warn("Reminder device delivery failed", { statusCode, permanentlyGone });
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
      console.error("Reminder job processing failed", {
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
        console.error("Reminder retry state could not be recorded", { jobId: job.id });
      }
    }
  }

  return json({ status: enqueueFailed ? "completed_with_enqueue_error" : "completed", ...totals }, 200);
});
