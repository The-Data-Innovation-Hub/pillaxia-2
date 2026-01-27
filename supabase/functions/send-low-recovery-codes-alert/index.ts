import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LowRecoveryCodesRequest {
  email: string;
  firstName?: string;
  remainingCodes: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, remainingCodes }: LowRecoveryCodesRequest = await req.json();

    console.log(`Sending low recovery codes alert to ${email}, remaining: ${remainingCodes}`);

    // Validate required fields
    if (!email || remainingCodes === undefined) {
      throw new Error("Missing required fields: email and remainingCodes");
    }

    const name = firstName || "there";
    const codeWord = remainingCodes === 1 ? "code" : "codes";

    const emailResponse = await resend.emails.send({
      from: "Pillaxia Security <noreply@pillaxia.com>",
      to: [email],
      subject: `⚠️ Security Alert: Only ${remainingCodes} recovery ${codeWord} remaining`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #22d3ee; margin: 0; font-size: 28px;">Pillaxia</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 14px;">Medication Adherence Platform</p>
          </div>
          
          <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-weight: 600;">
                ⚠️ Security Notice: Low Recovery Codes
              </p>
            </div>
            
            <p style="margin: 0 0 15px 0;">Hi ${name},</p>
            
            <p style="margin: 0 0 15px 0;">
              You just used a recovery code to log into your Pillaxia account. You now have 
              <strong style="color: #dc2626;">${remainingCodes} recovery ${codeWord}</strong> remaining.
            </p>
            
            <p style="margin: 0 0 20px 0;">
              Recovery codes are essential for accessing your account if you lose access to your 
              authenticator app or phone. We recommend generating new recovery codes soon to ensure 
              you don't get locked out of your account.
            </p>
            
            <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: 600; color: #166534;">How to generate new recovery codes:</p>
              <ol style="margin: 0; padding-left: 20px; color: #166534;">
                <li>Log into your Pillaxia account</li>
                <li>Go to <strong>Settings</strong> → <strong>Security</strong></li>
                <li>Find the <strong>Two-Factor Authentication</strong> section</li>
                <li>Click <strong>"Regenerate Recovery Codes"</strong></li>
                <li>Save the new codes in a secure location</li>
              </ol>
            </div>
            
            <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">
              <strong>Important:</strong> Store your recovery codes in a secure location, such as a 
              password manager or a printed copy kept in a safe place. Never share your recovery codes 
              with anyone.
            </p>
            
            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
              If you didn't use a recovery code to log in, please secure your account immediately by 
              changing your password and regenerating your recovery codes.
            </p>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">
              This is an automated security notification from Pillaxia.
            </p>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">
              © ${new Date().getFullYear()} Pillaxia. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Low recovery codes alert sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-low-recovery-codes-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
