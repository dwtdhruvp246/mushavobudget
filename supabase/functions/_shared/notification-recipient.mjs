// Service-side helpers. Callers supply server-selected users and outbox rows,
// never client-provided recipient, settings or display-authority flags.
export async function activeNotificationRecipient(client, userId) {
  const {data, error} = await client.from("profiles").select("account_status")
    .eq("id", userId).maybeSingle();
  if (error) throw new Error("recipient_status:database_error");
  return data?.account_status === "active";
}

export async function prepareReminderPayload(client, job, sentAt) {
  const {data: settings, error} = await client.from("workspace_settings")
    .select("reminder_enabled, detailed_notification_previews")
    .eq("workspace_id", job.workspace_id).maybeSingle();
  if (error) throw new Error("preview_settings:database_error");
  if (!settings || settings.reminder_enabled !== true) return null;
  if (!["payment", "business_bill"].includes(job.source_type)) throw new Error("preview_source:unsupported");
  const genericBody = job.source_type === "business_bill"
    ? "A Business bill has an outstanding balance and is due soon."
    : job.notification_type === "payment_due_today" ? "You have a payment due today."
    : job.notification_type === "payment_due_tomorrow" ? "You have a payment due tomorrow."
    : "You have a payment due soon.";
  const detailed = settings.detailed_notification_previews === true;
  return {
    type: job.notification_type,
    title: detailed ? job.title : job.source_type === "business_bill" ? "Business bill reminder" : "Mushavo Budget",
    body: detailed ? job.body : genericBody,
    tag: `${job.source_type}:${job.source_id}:${job.notification_type}`,
    sent_at: sentAt,
    target_url: job.target_url,
  };
}
