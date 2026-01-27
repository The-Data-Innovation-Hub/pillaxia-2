import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Email Click Tracker
 * 
 * Tracks when users click links in emails by redirecting through this endpoint.
 * Updates notification_history with click timestamps.
 * 
 * Usage: Wrap links in emails with:
 * ${supabaseUrl}/functions/v1/email-click-tracker?id={notification_id}&uid={user_id}&url={encoded_target_url}
 */

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const notificationId = url.searchParams.get("id");
    const userId = url.searchParams.get("uid");
    const targetUrl = url.searchParams.get("url");

    console.log(`Click tracker - notification: ${notificationId}, user: ${userId}, target: ${targetUrl}`);

    // Default redirect URL if none provided
    const redirectTo = targetUrl || "https://pillaxia.com";

    if (notificationId && userId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Update the notification as clicked
      const { error } = await supabase
        .from("notification_history")
        .update({
          clicked_at: new Date().toISOString(),
          status: "clicked",
        })
        .eq("id", notificationId)
        .eq("user_id", userId)
        .is("clicked_at", null); // Only update if not already clicked

      if (error) {
        console.error("Failed to update notification click status:", error);
      } else {
        console.log(`Notification ${notificationId} marked as clicked`);
      }
    }

    // Redirect to the target URL
    return new Response(null, {
      status: 302,
      headers: {
        "Location": decodeURIComponent(redirectTo),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error in email-click-tracker:", error);
    // Still redirect even on error
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "https://pillaxia.com",
      },
    });
  }
});
