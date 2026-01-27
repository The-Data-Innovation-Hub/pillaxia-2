import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TestEmailRequest {
  to: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Test email webhook function started");

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

    // Verify the user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub as string;

    // Check if user is admin
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Not an admin or role check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to }: TestEmailRequest = await req.json();

    if (!to || !to.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email address required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending test email to: ${to}`);

    // Send the test email
    const emailResponse = await resend.emails.send({
      from: "Pillaxia <noreply@resend.dev>",
      to: [to],
      subject: "🧪 Pillaxia Webhook Test",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #10B981 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🧪 Webhook Test Email</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              This is a test email to verify that the Resend webhook integration is working correctly.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #10B981; margin: 20px 0;">
              <p style="font-size: 14px; margin: 0; color: #4b5563;">
                <strong>What to check:</strong><br>
                1. You received this email ✓<br>
                2. The notification history shows "sent" status<br>
                3. After a few seconds, status updates to "delivered"
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 20px;">
              Sent from Pillaxia Admin Panel<br>
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Email send error:", emailResponse.error);
      
      // Extract detailed error info from Resend
      const errorMessage = emailResponse.error.message || "Unknown email error";
      const errorName = emailResponse.error.name || "ResendError";
      
      // Schedule first retry in 1 minute (exponential backoff)
      const nextRetryAt = new Date(Date.now() + 60 * 1000).toISOString();
      
      // Log failed email with detailed error and retry scheduling
      await serviceClient.from("notification_history").insert({
        user_id: userId,
        channel: "email",
        notification_type: "webhook_test",
        title: "Webhook Test Email",
        body: `Test email to ${to}`,
        status: "failed",
        error_message: `${errorName}: ${errorMessage}`.slice(0, 500),
        retry_count: 0,
        max_retries: 3,
        next_retry_at: nextRetryAt,
        metadata: { 
          recipient_email: to, 
          test: true,
          error_type: errorName,
          error_details: errorMessage
        },
      });
      
      // Return detailed error for UI display (200 status so data is accessible)
      return new Response(
        JSON.stringify({ 
          error: "Failed to send email", 
          details: errorMessage,
          error_type: errorName
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Test email sent successfully, ID: ${emailResponse.data?.id}`);

    // Log successful email with Resend ID for webhook tracking
    await serviceClient.from("notification_history").insert({
      user_id: userId,
      channel: "email",
      notification_type: "webhook_test",
      title: "Webhook Test Email",
      body: `Test email to ${to}`,
      status: "sent",
      metadata: { 
        recipient_email: to,
        resend_email_id: emailResponse.data?.id,
        test: true
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test email sent successfully",
        email_id: emailResponse.data?.id
      }),
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
