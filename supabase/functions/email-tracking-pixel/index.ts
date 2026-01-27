import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF pixel (smallest possible valid GIF)
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const notificationId = url.searchParams.get("id");
    const userId = url.searchParams.get("uid");

    console.log(`Tracking pixel request - notification: ${notificationId}, user: ${userId}`);

    if (notificationId && userId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Update the notification as opened
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
      } else {
        console.log(`Notification ${notificationId} marked as opened`);
      }
    }

    // Return the tracking pixel image
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Content-Length": TRACKING_PIXEL.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error in email-tracking-pixel:", error);
    // Still return the pixel even on error to avoid broken images
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Content-Length": TRACKING_PIXEL.length.toString(),
      },
    });
  }
});
