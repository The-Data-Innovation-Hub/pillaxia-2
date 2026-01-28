import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendPrescriptionRequest {
  prescriptionId: string;
  pharmacyId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { prescriptionId, pharmacyId }: SendPrescriptionRequest = await req.json();

    if (!prescriptionId || !pharmacyId) {
      return new Response(
        JSON.stringify({ error: "Missing prescriptionId or pharmacyId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch prescription with related data
    const { data: prescription, error: rxError } = await supabase
      .from("prescriptions")
      .select(`
        *,
        patient_profile:profiles!prescriptions_patient_user_id_fkey(first_name, last_name, email, phone, date_of_birth),
        clinician_profile:profiles!prescriptions_clinician_user_id_fkey(first_name, last_name, license_number, email)
      `)
      .eq("id", prescriptionId)
      .eq("clinician_user_id", userId)
      .single();

    if (rxError || !prescription) {
      console.error("[SEND-PRESCRIPTION] Prescription not found:", rxError);
      return new Response(
        JSON.stringify({ error: "Prescription not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch pharmacy details
    const { data: pharmacy, error: pharmError } = await supabase
      .from("pharmacy_locations")
      .select("*")
      .eq("id", pharmacyId)
      .single();

    if (pharmError || !pharmacy) {
      console.error("[SEND-PRESCRIPTION] Pharmacy not found:", pharmError);
      return new Response(
        JSON.stringify({ error: "Pharmacy not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pharmacy.email) {
      return new Response(
        JSON.stringify({ error: "Pharmacy does not have an email address configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[SEND-PRESCRIPTION] Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Format the prescription email
    const patientName = `${prescription.patient_profile?.first_name || ""} ${prescription.patient_profile?.last_name || ""}`.trim() || "Unknown Patient";
    const clinicianName = `${prescription.clinician_profile?.first_name || ""} ${prescription.clinician_profile?.last_name || ""}`.trim() || "Unknown Clinician";
    const prescriptionDate = new Date(prescription.date_written).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Electronic Prescription</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
    .rx-symbol { font-size: 24px; font-weight: bold; }
    .section { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb; }
    .section:last-child { border-bottom: none; margin-bottom: 0; }
    .label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
    .value { font-size: 16px; }
    .medication { font-size: 20px; font-weight: bold; color: #1f2937; }
    .sig { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 6px; margin: 15px 0; }
    .controlled { background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; padding: 5px 10px; border-radius: 4px; display: inline-block; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; vertical-align: top; }
    td:first-child { width: 50%; }
  </style>
</head>
<body>
  <div class="header">
    <span class="rx-symbol">℞</span> Electronic Prescription
    <div style="font-size: 14px; margin-top: 5px;">Rx #${prescription.prescription_number}</div>
  </div>
  
  <div class="content">
    <div class="section">
      <div class="label">Date Written</div>
      <div class="value">${prescriptionDate}</div>
    </div>

    <div class="section">
      <div class="label">Patient Information</div>
      <table>
        <tr>
          <td><strong>${patientName}</strong></td>
          <td>${prescription.patient_profile?.phone || "No phone"}</td>
        </tr>
        <tr>
          <td colspan="2">${prescription.patient_profile?.email || ""}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="medication">${prescription.medication_name}</div>
      ${prescription.generic_name ? `<div style="color: #6b7280; font-size: 14px;">(${prescription.generic_name})</div>` : ""}
      ${prescription.is_controlled_substance ? `<div class="controlled">Schedule ${prescription.dea_schedule}</div>` : ""}
      
      <table style="margin-top: 15px;">
        <tr>
          <td>
            <div class="label">Dosage</div>
            <div class="value">${prescription.dosage} ${prescription.dosage_unit}</div>
          </td>
          <td>
            <div class="label">Form</div>
            <div class="value">${prescription.form}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div class="label">Quantity</div>
            <div class="value">${prescription.quantity}</div>
          </td>
          <td>
            <div class="label">Refills</div>
            <div class="value">${prescription.refills_authorized}</div>
          </td>
        </tr>
      </table>

      <div class="sig">
        <div class="label">Directions (Sig)</div>
        <div class="value">${prescription.sig}</div>
      </div>

      ${prescription.instructions ? `
      <div>
        <div class="label">Additional Instructions</div>
        <div class="value">${prescription.instructions}</div>
      </div>
      ` : ""}

      ${prescription.dispense_as_written ? `
      <div class="warning">
        <strong>⚠️ Dispense as Written (DAW)</strong> - Do not substitute with generic
      </div>
      ` : ""}
    </div>

    ${prescription.diagnosis_code ? `
    <div class="section">
      <div class="label">Diagnosis</div>
      <div class="value">${prescription.diagnosis_code}${prescription.diagnosis_description ? ` - ${prescription.diagnosis_description}` : ""}</div>
    </div>
    ` : ""}

    <div class="section">
      <div class="label">Prescriber</div>
      <div class="value">
        <strong>${clinicianName}</strong><br>
        License #: ${prescription.clinician_profile?.license_number || "N/A"}<br>
        ${prescription.clinician_profile?.email || ""}
      </div>
    </div>

    <div class="footer">
      <p>This is an electronically transmitted prescription from Pillaxia Healthcare Platform.</p>
      <p>For verification, please contact the prescriber directly.</p>
      <p style="color: #9ca3af; font-size: 11px;">Transmitted: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    console.log(`[SEND-PRESCRIPTION] Sending prescription ${prescriptionId} to ${pharmacy.email}`);
    
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Pillaxia E-Prescribing <prescriptions@resend.dev>",
      to: [pharmacy.email],
      subject: `E-Prescription: Rx #${prescription.prescription_number} for ${patientName}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("[SEND-PRESCRIPTION] Email send failed:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send prescription email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SEND-PRESCRIPTION] Email sent successfully:`, emailResult);

    // Use service role client to update prescription
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update prescription status
    const { error: updateError } = await serviceClient
      .from("prescriptions")
      .update({
        pharmacy_id: pharmacyId,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId);

    if (updateError) {
      console.error("[SEND-PRESCRIPTION] Failed to update prescription:", updateError);
    }

    // Log status change
    await serviceClient.from("prescription_status_history").insert({
      prescription_id: prescriptionId,
      previous_status: prescription.status,
      new_status: "sent",
      changed_by: userId,
      notes: `Prescription sent via email to ${pharmacy.name} (${pharmacy.email})`,
    });

    // Log in notification history
    await serviceClient.from("notification_history").insert({
      user_id: prescription.patient_user_id,
      channel: "email",
      notification_type: "prescription_sent",
      title: "Prescription Sent",
      body: `Your prescription for ${prescription.medication_name} has been sent to ${pharmacy.name}`,
      status: "delivered",
      delivered_at: new Date().toISOString(),
      metadata: {
        prescription_id: prescriptionId,
        prescription_number: prescription.prescription_number,
        pharmacy_id: pharmacyId,
        pharmacy_name: pharmacy.name,
        email_id: emailResult?.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prescription sent to ${pharmacy.name}`,
        emailId: emailResult?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[SEND-PRESCRIPTION] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
