import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Exponential backoff intervals in minutes: 1, 5, 15, 60
const BACKOFF_INTERVALS = [1, 5, 15, 60];

function getNextRetryDelay(retryCount: number): number {
  const index = Math.min(retryCount, BACKOFF_INTERVALS.length - 1);
  return BACKOFF_INTERVALS[index] * 60 * 1000; // Convert to milliseconds
}

interface NotificationToRetry {
  id: string;
  user_id: string;
  channel: string;
  notification_type: string;
  title: string;
  body: string | null;
  retry_count: number;
  max_retries: number;
  metadata: Record<string, unknown> | null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing notification retries...");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Fetch failed notifications that are due for retry
    const now = new Date().toISOString();
    const { data: notifications, error: fetchError } = await serviceClient
      .from("notification_history")
      .select("id, user_id, channel, notification_type, title, body, retry_count, max_retries, metadata")
      .eq("status", "failed")
      .not("next_retry_at", "is", null)
      .lte("next_retry_at", now)
      .lt("retry_count", 3) // Use literal since we can't reference max_retries in filter
      .limit(50); // Process in batches

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      console.log("No notifications due for retry");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No notifications due for retry" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${notifications.length} notifications to retry`);

    let successCount = 0;
    let failCount = 0;
    let permanentFailCount = 0;

    for (const notification of notifications as NotificationToRetry[]) {
      const newRetryCount = notification.retry_count + 1;
      const isLastRetry = newRetryCount >= notification.max_retries;

      try {
        let retrySuccess = false;

        // Attempt retry based on channel
        if (notification.channel === "email") {
          retrySuccess = await retryEmailNotification(notification, resend, serviceClient);
        } else if (notification.channel === "push") {
          retrySuccess = await retryPushNotification(notification, serviceClient);
        } else if (notification.channel === "whatsapp") {
          // WhatsApp retries would require additional setup
          console.log(`WhatsApp retry not implemented for notification ${notification.id}`);
          retrySuccess = false;
        }

        if (retrySuccess) {
          // Mark as sent
          await serviceClient
            .from("notification_history")
            .update({
              status: "sent",
              retry_count: newRetryCount,
              last_retry_at: new Date().toISOString(),
              next_retry_at: null,
              error_message: null,
            })
            .eq("id", notification.id);
          
          successCount++;
          console.log(`Successfully retried notification ${notification.id}`);
        } else {
          throw new Error("Retry failed");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        if (isLastRetry) {
          // Mark as permanently failed
          await serviceClient
            .from("notification_history")
            .update({
              status: "failed",
              retry_count: newRetryCount,
              last_retry_at: new Date().toISOString(),
              next_retry_at: null,
              error_message: `Permanently failed after ${newRetryCount} attempts: ${errorMessage}`.slice(0, 500),
            })
            .eq("id", notification.id);
          
          permanentFailCount++;
          console.log(`Notification ${notification.id} permanently failed after ${newRetryCount} attempts`);
        } else {
          // Schedule next retry with exponential backoff
          const nextRetryDelay = getNextRetryDelay(newRetryCount);
          const nextRetryAt = new Date(Date.now() + nextRetryDelay).toISOString();
          
          await serviceClient
            .from("notification_history")
            .update({
              retry_count: newRetryCount,
              last_retry_at: new Date().toISOString(),
              next_retry_at: nextRetryAt,
              error_message: `Retry ${newRetryCount} failed: ${errorMessage}. Next retry at ${nextRetryAt}`.slice(0, 500),
            })
            .eq("id", notification.id);
          
          failCount++;
          console.log(`Notification ${notification.id} failed, scheduled retry ${newRetryCount + 1} at ${nextRetryAt}`);
        }
      }
    }

    const summary = {
      success: true,
      processed: notifications.length,
      succeeded: successCount,
      rescheduled: failCount,
      permanentlyFailed: permanentFailCount,
    };

    console.log("Retry processing complete:", summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing retries:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process retries", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function retryEmailNotification(
  notification: NotificationToRetry,
  resend: Resend,
  // deno-lint-ignore no-explicit-any
  serviceClient: SupabaseClient
): Promise<boolean> {
  const metadata = notification.metadata as Record<string, string> | null;
  const recipientEmail = metadata?.recipient_email;

  if (!recipientEmail) {
    console.error(`No recipient email for notification ${notification.id}`);
    return false;
  }

  const emailResponse = await resend.emails.send({
    from: "Pillaxia <noreply@resend.dev>",
    to: [recipientEmail],
    subject: `[Retry] ${notification.title}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>${notification.title}</h2>
        <p>${notification.body || ""}</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          This is a retry of a previously failed notification.
        </p>
      </div>
    `,
  });

  if (emailResponse.error) {
    console.error(`Email retry failed for ${notification.id}:`, emailResponse.error);
    return false;
  }

  // Update metadata with new resend_email_id for webhook tracking
  if (emailResponse.data?.id) {
    const updatedMetadata = {
      ...(metadata || {}),
      resend_email_id: emailResponse.data.id,
      retry_email_id: emailResponse.data.id,
    };
    await serviceClient
      .from("notification_history")
      .update({ metadata: updatedMetadata })
      .eq("id", notification.id);
  }

  return true;
}

async function retryPushNotification(
  notification: NotificationToRetry,
  // deno-lint-ignore no-explicit-any
  serviceClient: SupabaseClient
): Promise<boolean> {
  // Get user's push subscriptions
  const { data: subscriptions, error: subError } = await serviceClient
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", notification.user_id);

  if (subError || !subscriptions || subscriptions.length === 0) {
    console.log(`No push subscriptions for user ${notification.user_id}`);
    return false;
  }

  // Invoke the send-push-notification function
  const { error: invokeError } = await serviceClient.functions.invoke("send-push-notification", {
    body: {
      user_ids: [notification.user_id],
      payload: {
        title: notification.title,
        body: notification.body || "",
        tag: `retry-${notification.notification_type}`,
        data: { retry: true, originalId: notification.id },
      },
    },
  });

  if (invokeError) {
    console.error(`Push retry failed for ${notification.id}:`, invokeError);
    return false;
  }

  return true;
}
