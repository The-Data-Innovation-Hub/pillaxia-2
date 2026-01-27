import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RetryRequest {
  notification_id: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header to verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { notification_id }: RetryRequest = await req.json();

    if (!notification_id) {
      return new Response(
        JSON.stringify({ error: "notification_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the failed notification
    const { data: notification, error: fetchError } = await supabase
      .from("notification_history")
      .select("*")
      .eq("id", notification_id)
      .eq("status", "failed")
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching notification:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch notification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!notification) {
      return new Response(
        JSON.stringify({ error: "Notification not found or not in failed status" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Retrying ${notification.channel} notification: ${notification.id}`);

    let retryResult: { success: boolean; error?: string } = { success: false };

    switch (notification.channel) {
      case "push":
        retryResult = await retryPushNotification(supabaseUrl, supabaseKey, notification);
        break;
      case "email":
        retryResult = await retryEmailNotification(notification);
        break;
      case "whatsapp":
        retryResult = await retryWhatsAppNotification(supabaseUrl, supabaseKey, notification);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported channel: ${notification.channel}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (retryResult.success) {
      // Update original notification status
      await supabase
        .from("notification_history")
        .update({ 
          status: "sent", 
          error_message: null,
          metadata: { 
            ...notification.metadata, 
            retried_at: new Date().toISOString(),
            original_error: notification.error_message 
          }
        })
        .eq("id", notification_id);

      return new Response(
        JSON.stringify({ success: true, message: "Notification retried successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Update with new error
      await supabase
        .from("notification_history")
        .update({ 
          error_message: retryResult.error,
          metadata: { 
            ...notification.metadata, 
            last_retry_at: new Date().toISOString() 
          }
        })
        .eq("id", notification_id);

      return new Response(
        JSON.stringify({ success: false, error: retryResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in retry-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function retryPushNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  notification: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call the existing push notification function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_ids: [notification.user_id],
          payload: {
            title: notification.title,
            body: notification.body,
            tag: notification.notification_type,
          },
        }),
      }
    );

    const result = await response.json();
    if (result.sent > 0) {
      return { success: true };
    }
    return { success: false, error: result.errors?.[0] || "Push notification failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Push retry failed" };
  }
}

async function retryEmailNotification(
  notification: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return { success: false, error: "Email service not configured" };
    }

    const metadata = notification.metadata as Record<string, unknown> || {};
    const recipientEmail = metadata.recipient_email as string;

    if (!recipientEmail) {
      return { success: false, error: "No recipient email in notification metadata" };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Pillaxia <notifications@pillaxia.com>",
        to: [recipientEmail],
        subject: notification.title,
        html: `<p>${notification.body}</p>`,
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    const errorData = await response.json();
    return { success: false, error: JSON.stringify(errorData) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Email retry failed" };
  }
}

async function retryWhatsAppNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  notification: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!whatsappToken || !whatsappPhoneId) {
      return { success: false, error: "WhatsApp API not configured" };
    }

    // Get user's phone number using fetch
    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${notification.user_id}&select=phone`,
      {
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
      }
    );

    const profiles = await profileResponse.json();
    const phone = profiles?.[0]?.phone;

    if (!phone) {
      return { success: false, error: "No phone number found for user" };
    }

    const phoneNumber = phone.replace(/\D/g, "");

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "text",
          text: { body: `${notification.title}\n\n${notification.body || ""}` },
        }),
      }
    );

    if (response.ok) {
      return { success: true };
    }

    const errorData = await response.json();
    return { success: false, error: JSON.stringify(errorData) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "WhatsApp retry failed" };
  }
}
