import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientId: string;
  senderName: string;
  message: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientId, senderName, message }: NotificationRequest = await req.json();

    if (!recipientId || !senderName || !message) {
      throw new Error("Missing required fields");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get recipient profile to check for phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone, first_name")
      .eq("user_id", recipientId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw profileError;
    }

    if (!profile?.phone) {
      console.log("No phone number configured for recipient, skipping WhatsApp notification");
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: "no_phone",
          message: "Recipient has no phone number configured" 
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Check if WhatsApp API is configured
    const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!whatsappToken || !whatsappPhoneId) {
      console.log("WhatsApp API not configured, skipping notification");
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: "not_configured",
          message: "WhatsApp API credentials not configured" 
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Format phone number (remove any non-digits)
    const phoneNumber = profile.phone.replace(/\D/g, "");

    // Send WhatsApp message via Meta Graph API
    const whatsappResponse = await fetch(
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
          text: {
            body: `💬 New message from ${senderName} on Pillaxia:\n\n"${message.substring(0, 500)}"\n\nOpen the app to reply.`,
          },
        }),
      }
    );

    if (!whatsappResponse.ok) {
      const errorData = await whatsappResponse.json();
      console.error("WhatsApp API error:", errorData);
      throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
    }

    const result = await whatsappResponse.json();
    console.log("WhatsApp notification sent successfully:", result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp notification sent",
        messageId: result.messages?.[0]?.id 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    console.error("Error in send-whatsapp-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
