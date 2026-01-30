import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, captureException } from "../_shared/sentry.ts";

/**
 * Email Tracking Pixel
 * 
 * Returns a 1x1 transparent GIF and records email opens.
 * Updates notification_history with opened_at timestamps.
 * 
 * Usage: Embed in emails as:
 * <img src="${supabaseUrl}/functions/v1/email-tracking-pixel?id={notification_id}&uid={user_id}" />
 */

// 1x1 transparent GIF pixel (smallest possible valid GIF)
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

// Response headers for the tracking pixel
const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": TRACKING_PIXEL.length.toString(),
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Content-Type-Options": "nosniff",
};

// UUID validation
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

serve(withSentry("email-tracking-pixel", async (req) => {
  // No CORS needed for image requests - browsers handle them differently
  // Only allow GET requests for tracking pixels
  if (req.method !== "GET") {
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: PIXEL_HEADERS,
    });
  }

  try {
    const url = new URL(req.url);
    const notificationId = url.searchParams.get("id");
    const userId = url.searchParams.get("uid");

    console.info(`Tracking pixel request - notification: ${notificationId}, user: ${userId}`);

    // Validate IDs before database operation
    if (notificationId && userId && isValidUUID(notificationId) && isValidUUID(userId)) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Update the notification as opened (fire and forget - don't block response)
      // Using void to explicitly ignore the promise result
      void (async () => {
        try {
          const { error } = await supabase
            .from("notification_history")
            .update({
              opened_at: new Date().toISOString(),
              status: "opened",
            })
            .eq("id", notificationId)
            .eq("user_id", userId)
            .is("opened_at", null); // Only update if not already opened

          if (error) {
            console.error("Failed to update notification open status:", error);
            captureException(new Error(`Tracking pixel update failed: ${error.message}`));
          } else {
            console.info(`Notification ${notificationId} marked as opened`);
          }
        } catch (err) {
          console.error("Tracking pixel update error:", err);
          captureException(err instanceof Error ? err : new Error(String(err)));
        }
      })();
    } else if (notificationId || userId) {
      console.warn("Invalid notification or user ID format");
    }

    // Return the tracking pixel immediately
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: PIXEL_HEADERS,
    });
  } catch (error) {
    console.error("Error in email-tracking-pixel:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    
    // Still return the pixel even on error to avoid broken images
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: PIXEL_HEADERS,
    });
  }
}));
