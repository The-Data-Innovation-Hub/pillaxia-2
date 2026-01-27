import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EncouragementEmailRequest {
  patient_user_id: string;
  caregiver_name: string;
  message: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { patient_user_id, caregiver_name, message }: EncouragementEmailRequest = await req.json();

    // Validate required fields
    if (!patient_user_id || !caregiver_name || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service client to check notification settings
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if encouragement messages are enabled
    const { data: settingData, error: settingError } = await serviceClient
      .from("notification_settings")
      .select("is_enabled")
      .eq("setting_key", "encouragement_messages")
      .maybeSingle();

    if (settingError) {
      console.error("Error checking notification settings:", settingError);
    }

    if (settingData && !settingData.is_enabled) {
      console.log("Encouragement messages are disabled, skipping email...");
      return new Response(
        JSON.stringify({ success: true, message: "Encouragement messages are disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get patient's email from profiles
    const { data: patientProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("user_id", patient_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch patient profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!patientProfile?.email) {
      console.log("Patient has no email configured, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "No email configured for patient" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const patientName = patientProfile.first_name || "there";

    // Send the email
    const { error: emailError } = await resend.emails.send({
      from: "Pillaxia <noreply@resend.dev>",
      to: [patientProfile.email],
      subject: `💜 ${caregiver_name} sent you an encouragement message!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💜 You've Got Encouragement!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi ${patientName}! 👋
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${caregiver_name}</strong> noticed your dedication to your health and wanted to share some encouragement:
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #8B5CF6; margin: 20px 0;">
              <p style="font-size: 16px; margin: 0; font-style: italic; color: #4b5563;">
                "${message}"
              </p>
            </div>
            
            <p style="font-size: 16px; margin-top: 20px;">
              Keep up the great work! Your caregivers are cheering you on. 🌟
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #6b7280; text-align: center;">
              This message was sent through Pillaxia.<br>
              Stay healthy, stay connected.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Encouragement email sent to ${patientProfile.email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
