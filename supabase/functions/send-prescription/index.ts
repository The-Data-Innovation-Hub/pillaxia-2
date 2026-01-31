import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";

// Input validation schema
const sendPrescriptionSchema = {
  prescriptionId: validators.uuid(),
  pharmacyId: validators.uuid(),
};

// XSS prevention utility
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

serve(withSentry("send-prescription", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

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

    const body = await req.json();
    const validation = validateSchema(sendPrescriptionSchema, body);
    
    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { prescriptionId, pharmacyId } = validation.data;

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

    // Escape all dynamic content for XSS prevention
    const safePatientFirstName = escapeHtml(prescription.patient_profile?.first_name || "");
    const safePatientLastName = escapeHtml(prescription.patient_profile?.last_name || "");
    const safePatientName = `${safePatientFirstName} ${safePatientLastName}`.trim() || "Unknown Patient";
    const safePatientPhone = escapeHtml(prescription.patient_profile?.phone || "No phone");
    const safePatientEmail = escapeHtml(prescription.patient_profile?.email || "");
    
    const safeClinicianFirstName = escapeHtml(prescription.clinician_profile?.first_name || "");
    const safeClinicianLastName = escapeHtml(prescription.clinician_profile?.last_name || "");
    const safeClinicianName = `${safeClinicianFirstName} ${safeClinicianLastName}`.trim() || "Unknown Clinician";
    const safeClinicianLicense = escapeHtml(prescription.clinician_profile?.license_number || "N/A");
    const safeClinicianEmail = escapeHtml(prescription.clinician_profile?.email || "");
    
    const safeMedicationName = escapeHtml(prescription.medication_name || "");
    const safeGenericName = escapeHtml(prescription.generic_name || "");
    const safeDosage = escapeHtml(prescription.dosage || "");
    const safeDosageUnit = escapeHtml(prescription.dosage_unit || "");
    const safeForm = escapeHtml(prescription.form || "");
    const safeQuantity = escapeHtml(String(prescription.quantity || ""));
    const safeRefills = escapeHtml(String(prescription.refills_authorized || "0"));
    const safeSig = escapeHtml(prescription.sig || "");
    const safeInstructions = escapeHtml(prescription.instructions || "");
    const safePrescriptionNumber = escapeHtml(prescription.prescription_number || "");
    const safeDiagnosisCode = escapeHtml(prescription.diagnosis_code || "");
    const safeDiagnosisDesc = escapeHtml(prescription.diagnosis_description || "");
    const safeDeaSchedule = escapeHtml(prescription.dea_schedule || "");
    const safePharmacyName = escapeHtml(pharmacy.name || "");

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
    <div style="font-size: 14px; margin-top: 5px;">Rx #${safePrescriptionNumber}</div>
  </div>
  
  <div class="content">
    <div class="section">
      <div class="label">Date Written</div>
      <div class="value">${escapeHtml(prescriptionDate)}</div>
    </div>

    <div class="section">
      <div class="label">Patient Information</div>
      <table>
        <tr>
          <td><strong>${safePatientName}</strong></td>
          <td>${safePatientPhone}</td>
        </tr>
        <tr>
          <td colspan="2">${safePatientEmail}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="medication">${safeMedicationName}</div>
      ${safeGenericName ? `<div style="color: #6b7280; font-size: 14px;">(${safeGenericName})</div>` : ""}
      ${prescription.is_controlled_substance ? `<div class="controlled">Schedule ${safeDeaSchedule}</div>` : ""}
      
      <table style="margin-top: 15px;">
        <tr>
          <td>
            <div class="label">Dosage</div>
            <div class="value">${safeDosage} ${safeDosageUnit}</div>
          </td>
          <td>
            <div class="label">Form</div>
            <div class="value">${safeForm}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div class="label">Quantity</div>
            <div class="value">${safeQuantity}</div>
          </td>
          <td>
            <div class="label">Refills</div>
            <div class="value">${safeRefills}</div>
          </td>
        </tr>
      </table>

      <div class="sig">
        <div class="label">Directions (Sig)</div>
        <div class="value">${safeSig}</div>
      </div>

      ${safeInstructions ? `
      <div>
        <div class="label">Additional Instructions</div>
        <div class="value">${safeInstructions}</div>
      </div>
      ` : ""}

      ${prescription.dispense_as_written ? `
      <div class="warning">
        <strong>⚠️ Dispense as Written (DAW)</strong> - Do not substitute with generic
      </div>
      ` : ""}
    </div>

    ${safeDiagnosisCode ? `
    <div class="section">
      <div class="label">Diagnosis</div>
      <div class="value">${safeDiagnosisCode}${safeDiagnosisDesc ? ` - ${safeDiagnosisDesc}` : ""}</div>
    </div>
    ` : ""}

    <div class="section">
      <div class="label">Prescriber</div>
      <div class="value">
        <strong>${safeClinicianName}</strong><br>
        License #: ${safeClinicianLicense}<br>
        ${safeClinicianEmail}
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
    console.info(`[SEND-PRESCRIPTION] Sending prescription ${prescriptionId} to ${pharmacy.email}`);
    
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Pillaxia E-Prescribing <prescriptions@resend.dev>",
      to: [pharmacy.email],
      subject: `E-Prescription: Rx #${safePrescriptionNumber} for ${safePatientName}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("[SEND-PRESCRIPTION] Email send failed:", emailError);
      captureException(new Error(`Email send failed: ${emailError.message}`));
      return new Response(
        JSON.stringify({ error: "Failed to send prescription email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info(`[SEND-PRESCRIPTION] Email sent successfully:`, emailResult);

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
      captureException(new Error(`Failed to update prescription: ${updateError.message}`));
    }

    // Log status change
    await serviceClient.from("prescription_status_history").insert({
      prescription_id: prescriptionId,
      previous_status: prescription.status,
      new_status: "sent",
      changed_by: userId,
      notes: `Prescription sent via email to ${safePharmacyName} (${pharmacy.email})`,
    });

    // Log in notification history
    await serviceClient.from("notification_history").insert({
      user_id: prescription.patient_user_id,
      channel: "email",
      notification_type: "prescription_sent",
      title: "Prescription Sent",
      body: `Your prescription for ${safeMedicationName} has been sent to ${safePharmacyName}`,
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
        message: `Prescription sent to ${safePharmacyName}`,
        emailId: emailResult?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[SEND-PRESCRIPTION] Error:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
