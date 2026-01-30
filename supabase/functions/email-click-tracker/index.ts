import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

/**
 * Email Click Tracker
 * 
 * Tracks when users click links in emails by redirecting through this endpoint.
 * Updates notification_history with click timestamps.
 * 
 * Usage: Wrap links in emails with:
 * ${supabaseUrl}/functions/v1/email-click-tracker?id={notification_id}&uid={user_id}&url={encoded_target_url}
 */

// URL validation - only allow safe redirect destinations
const ALLOWED_REDIRECT_DOMAINS = [
  'pillaxia.com',
  'pillaxia-craft-suite.lovable.app',
  'lovable.app',
];

function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow https
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // Check against allowed domains
    return ALLOWED_REDIRECT_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// UUID validation
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const DEFAULT_REDIRECT = "https://pillaxia.com";

serve(withSentry("email-click-tracker", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const notificationId = url.searchParams.get("id");
    const userId = url.searchParams.get("uid");
    const targetUrl = url.searchParams.get("url");

    console.log(`Click tracker - notification: ${notificationId}, user: ${userId}, target: ${targetUrl ? "[REDACTED]" : "none"}`);

    // Validate and decode target URL
    let redirectTo = DEFAULT_REDIRECT;
    if (targetUrl) {
      try {
        const decodedUrl = decodeURIComponent(targetUrl);
        if (isValidRedirectUrl(decodedUrl)) {
          redirectTo = decodedUrl;
        } else {
          console.warn("Invalid redirect URL attempted, using default");
        }
      } catch {
        console.warn("Failed to decode URL, using default");
      }
    }

    // Validate IDs before database operation
    if (notificationId && userId && isValidUUID(notificationId) && isValidUUID(userId)) {
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
        captureException(new Error(`Click tracking failed: ${error.message}`));
      } else {
        console.log(`Notification ${notificationId} marked as clicked`);
      }
    } else if (notificationId || userId) {
      console.warn("Invalid notification or user ID format");
    }

    // Redirect to the target URL
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectTo,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error in email-click-tracker:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    
    // Still redirect even on error
    return new Response(null, {
      status: 302,
      headers: {
        "Location": DEFAULT_REDIRECT,
        "Cache-Control": "no-store",
      },
    });
  }
}));
