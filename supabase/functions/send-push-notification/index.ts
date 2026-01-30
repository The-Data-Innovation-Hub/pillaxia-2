import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

// Input validation schema
const sendPushSchema = {
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

// Base64 URL decode to Uint8Array
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Base64 URL encode from Uint8Array
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importVapidKeyPairFromBase64Url(opts: {
  publicKey: string;
  privateKey: string;
}): Promise<CryptoKeyPair> {
  const publicKeyBytes = base64UrlDecode(opts.publicKey);
  const privateKeyBytes = base64UrlDecode(opts.privateKey);

  // Public key is 65-byte uncompressed (04 || x || y)
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);

  const publicJwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    ext: true,
  };

  const privateJwk: JsonWebKey = {
    ...publicJwk,
    d: base64UrlEncode(privateKeyBytes),
  };

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  return { publicKey, privateKey };
}

serve(withSentry("send-push-notification", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys not configured");
    return new Response(
      JSON.stringify({ error: "Push notifications not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

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

  const validation = validateSchema(sendPushSchema, body);
  if (!validation.success) {
    return validationErrorResponse(validation, corsHeaders);
  }

  const { user_ids, payload } = validation.data;

  const appServer = await webpush.ApplicationServer.new({
    contactInformation: "mailto:notifications@pillaxia.com",
    vapidKeys: await importVapidKeyPairFromBase64Url({
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    }),
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`Sending push to ${user_ids.length} user(s)`);

  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,user_id")
    .in("user_id", user_ids);

  if (subError) {
    console.error("Error fetching subscriptions:", subError);
    captureException(subError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch subscriptions" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("No push subscriptions found for users");
    return new Response(
      JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Found ${subscriptions.length} subscription(s)`);

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];
  const errors: string[] = [];

  for (const sub of subscriptions) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    const subscriber = appServer.subscribe(subscription);

    try {
      await subscriber.pushTextMessage(JSON.stringify(payload), {
        ttl: 60 * 60 * 24,
        urgency: webpush.Urgency.High,
        topic: payload.tag,
      });
      sent++;

      // Log successful push notification
      await supabase.from("notification_history").insert({
        user_id: sub.user_id,
        channel: "push",
        notification_type: payload.tag || "general",
        title: payload.title,
        body: payload.body,
        status: "sent",
        metadata: { endpoint: sub.endpoint.slice(0, 50) + "..." },
      });
    } catch (err) {
      failed++;
      console.error("Push send failed:", err);

      const errorMessage = err instanceof Error ? err.message : String(err);

      // Log failed push notification
      await supabase.from("notification_history").insert({
        user_id: sub.user_id,
        channel: "push",
        notification_type: payload.tag || "general",
        title: payload.title,
        body: payload.body,
        status: "failed",
        error_message: errorMessage.slice(0, 500),
        metadata: { endpoint: sub.endpoint.slice(0, 50) + "..." },
      });

      if (err instanceof webpush.PushMessageError) {
        // Consume response body if any
        try {
          await err.response.text();
        } catch {
          // ignore
        }

        errors.push(err.toString());
        if (err.isGone()) {
          expiredEndpoints.push(sub.endpoint);
        }
      } else {
        errors.push(errorMessage);
        if (err instanceof Error) {
          captureException(err);
        }
      }
    }
  }

  if (expiredEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
    console.log(`Cleaned up ${expiredEndpoints.length} expired subscription(s)`);
  }

  console.log(`Push results: ${sent} sent, ${failed} failed`);

  return new Response(
    JSON.stringify({
      success: true,
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}));
