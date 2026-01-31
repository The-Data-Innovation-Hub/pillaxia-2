import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

// Input validation schema
const sendNativePushSchema = {
  user_ids: validators.array(validators.uuid(), { minLength: 1, maxLength: 100 }),
  payload: {
    validate: (value: unknown) => {
      if (typeof value !== "object" || value === null) {
        return { success: false, error: "payload object is required" } as const;
      }
      const p = value as Record<string, unknown>;
      if (typeof p.title !== "string" || !p.title) {
        return { success: false, error: "payload.title is required" } as const;
      }
      if (typeof p.body !== "string" || !p.body) {
        return { success: false, error: "payload.body is required" } as const;
      }
      return { success: true, data: value as PushPayload } as const;
    },
  },
};

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
}

/**
 * Send push notifications to native iOS devices via APNs
 * For Android, the existing web push via VAPID should work in the Capacitor WebView
 */
serve(withSentry("send-native-push", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apnsKeyId = Deno.env.get("APNS_KEY_ID");
  const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
  const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY");
  const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID") || "app.lovable.8333c041bf5948aca7173597c3a11358";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse and validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const validation = validateSchema(sendNativePushSchema, body);
  if (!validation.success) {
    return validationErrorResponse(validation, corsHeaders);
  }

  const { user_ids, payload } = validation.data;

  console.info(`Sending native push to ${user_ids.length} user(s)`);

  // Fetch iOS subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("native_token, user_id, platform")
    .in("user_id", user_ids)
    .eq("platform", "ios")
    .not("native_token", "is", null);

  if (subError) {
    console.error("Error fetching subscriptions:", subError);
    captureException(new Error(`Failed to fetch subscriptions: ${subError.message}`));
    return new Response(
      JSON.stringify({ error: "Failed to fetch subscriptions" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.info("No iOS push subscriptions found");
    return new Response(
      JSON.stringify({ success: true, sent: 0, message: "No iOS subscriptions found" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if APNs is configured
  if (!apnsKeyId || !apnsTeamId || !apnsPrivateKey) {
    console.info("APNs not configured - logging notification instead");
      
    // Log the notifications even without APNs
    for (const sub of subscriptions) {
      await supabase.from("notification_history").insert({
        user_id: sub.user_id,
        channel: "push",
        notification_type: "native_ios",
        title: payload.title,
        body: payload.body,
        status: "pending",
        metadata: { platform: "ios", note: "APNs not configured" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: 0,
        pending: subscriptions.length,
        message: "APNs not configured - notifications logged for later delivery",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate APNs JWT token
  const jwt = await generateApnsJwt(apnsKeyId, apnsTeamId, apnsPrivateKey);

  let sent = 0;
  let failed = 0;
  const expiredTokens: string[] = [];

  for (const sub of subscriptions) {
    try {
      const apnsPayload = {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          badge: payload.badge ?? 1,
          sound: payload.sound ?? "default",
        },
        ...payload.data,
      };

      // Use production APNs server
      const apnsUrl = `https://api.push.apple.com/3/device/${sub.native_token}`;

      const response = await fetch(apnsUrl, {
        method: "POST",
        headers: {
          "Authorization": `bearer ${jwt}`,
          "apns-topic": apnsBundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apnsPayload),
      });

      if (response.ok) {
        sent++;
        await supabase.from("notification_history").insert({
          user_id: sub.user_id,
          channel: "push",
          notification_type: "native_ios",
          title: payload.title,
          body: payload.body,
          status: "sent",
          metadata: { platform: "ios" },
        });
      } else {
        const errorBody = await response.text();
        console.error(`APNs error for token ${sub.native_token?.slice(0, 10)}...:`, response.status, errorBody);
        failed++;

        // Check for invalid/expired token
        if (response.status === 410 || errorBody.includes("Unregistered")) {
          expiredTokens.push(sub.native_token!);
        }

        await supabase.from("notification_history").insert({
          user_id: sub.user_id,
          channel: "push",
          notification_type: "native_ios",
          title: payload.title,
          body: payload.body,
          status: "failed",
          error_message: `APNs ${response.status}: ${errorBody}`,
          metadata: { platform: "ios" },
        });
      }
    } catch (err) {
      failed++;
      console.error("Error sending to APNs:", err);
      captureException(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // Clean up expired tokens
  if (expiredTokens.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("native_token", expiredTokens);
    console.info(`Cleaned up ${expiredTokens.length} expired iOS token(s)`);
  }

  console.info(`Native push results: ${sent} sent, ${failed} failed`);

  return new Response(
    JSON.stringify({ success: true, sent, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}));

/**
 * Generate JWT for APNs authentication
 */
async function generateApnsJwt(keyId: string, teamId: string, privateKey: string): Promise<string> {
  const header = {
    alg: "ES256",
    kid: keyId,
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: teamId,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  // Import the private key
  const keyData = pemToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${unsignedToken}.${encodedSignature}`;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem.split("\n");
  const base64 = lines
    .filter(line => !line.startsWith("-----"))
    .join("");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
