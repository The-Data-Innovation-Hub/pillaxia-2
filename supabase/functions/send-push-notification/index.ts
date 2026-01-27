import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

interface SendPushRequest {
  user_ids: string[];
  payload: PushPayload;
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

// Create VAPID JWT for authorization
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const headerB64 = base64UrlEncode(headerBytes);
  const payloadB64 = base64UrlEncode(payloadBytes);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Decode the keys
  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  const publicKeyBytes = base64UrlDecode(publicKeyBase64);
  
  // Extract x and y from the 65-byte uncompressed public key (04 || x || y)
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  
  // Create JWK for the private key
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    d: base64UrlEncode(privateKeyBytes),
  };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sigBytes = new Uint8Array(signature);
  const signatureB64 = base64UrlEncode(sigBytes);

  return `${unsignedToken}.${signatureB64}`;
}

// Encrypt payload using Web Push encryption (aes128gcm)
async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  // Generate local key pair for ECDH
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Export local public key
  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  // Import subscriber's public key
  const subscriberPublicKeyBytes = base64UrlDecode(p256dhBase64);
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKeyBytes.buffer.slice(
      subscriberPublicKeyBytes.byteOffset,
      subscriberPublicKeyBytes.byteOffset + subscriberPublicKeyBytes.byteLength
    ) as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret using ECDH
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecretBytes = new Uint8Array(sharedSecret);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Import auth secret
  const authSecret = base64UrlDecode(authBase64);

  // Info for IKM: "WebPush: info" || 0x00 || subscriber_public_key || local_public_key
  const infoPrefix = new TextEncoder().encode("WebPush: info\0");
  const ikmInfo = new Uint8Array(
    infoPrefix.length + subscriberPublicKeyBytes.length + localPublicKey.length
  );
  ikmInfo.set(infoPrefix, 0);
  ikmInfo.set(subscriberPublicKeyBytes, infoPrefix.length);
  ikmInfo.set(localPublicKey, infoPrefix.length + subscriberPublicKeyBytes.length);

  // First HKDF: derive IKM using auth as salt and shared secret as input
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    authSecret.buffer.slice(
      authSecret.byteOffset,
      authSecret.byteOffset + authSecret.byteLength
    ) as ArrayBuffer,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const ikm = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: sharedSecretBytes,
      info: ikmInfo,
    },
    ikmKey,
    256
  );

  // Second HKDF: derive content encryption key and nonce
  const prkKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cek = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt,
      info: cekInfo,
    },
    prkKey,
    128
  );

  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt,
      info: nonceInfo,
    },
    prkKey,
    96
  );

  // Encrypt the payload
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding delimiter (0x02 for last record)
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 0x02;

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(nonce), tagLength: 128 },
    aesKey,
    paddedPayload
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    salt,
    localPublicKey,
  };
}

// Build aes128gcm encrypted body
function buildEncryptedBody(
  ciphertext: Uint8Array,
  salt: Uint8Array,
  localPublicKey: Uint8Array
): ArrayBuffer {
  // Record size (4096 bytes)
  const recordSize = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
  // Key ID length (65 bytes for uncompressed EC key)
  const keyIdLen = new Uint8Array([65]);

  const totalLength =
    salt.length + recordSize.length + keyIdLen.length + localPublicKey.length + ciphertext.length;
  const body = new Uint8Array(totalLength);

  let offset = 0;
  body.set(salt, offset);
  offset += salt.length;
  body.set(recordSize, offset);
  offset += recordSize.length;
  body.set(keyIdLen, offset);
  offset += keyIdLen.length;
  body.set(localPublicKey, offset);
  offset += localPublicKey.length;
  body.set(ciphertext, offset);

  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
}

// Send Web Push notification
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const payloadString = JSON.stringify(payload);

    console.log(`Encrypting payload for endpoint: ${subscription.endpoint.substring(0, 50)}...`);

    // Encrypt the payload
    const { ciphertext, salt, localPublicKey } = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth
    );

    // Build the encrypted body
    const body = buildEncryptedBody(ciphertext, salt, localPublicKey);

    // Create VAPID JWT
    const jwt = await createVapidJwt(
      audience,
      "mailto:notifications@pillaxia.com",
      vapidPrivateKey,
      vapidPublicKey
    );

    const headers: Record<string, string> = {
      "TTL": "86400",
      "Urgency": "high",
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
    };

    console.log(`Sending encrypted push (${body.byteLength} bytes)`);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers,
      body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Push failed: ${response.status} - ${responseText}`);
      return {
        success: false,
        status: response.status,
        error: `${response.status}: ${responseText}`,
      };
    }

    console.log(`Push succeeded: ${response.status}`);
    return { success: true, status: response.status };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending push notification:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log("VAPID public key length:", vapidPublicKey.length);
    console.log("VAPID private key length:", vapidPrivateKey.length);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_ids, payload }: SendPushRequest = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: "payload with title and body is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push to ${user_ids.length} user(s)`);

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", user_ids);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
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
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKey
      );

      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push(result.error || `Status: ${result.status}`);
        if (result.status === 404 || result.status === 410) {
          expiredEndpoints.push(sub.endpoint);
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
