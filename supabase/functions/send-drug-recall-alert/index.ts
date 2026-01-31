import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";

// Input validation schema
const recallAlertRequestSchema = {
  recall_id: validators.uuid(),
  notify_pharmacies: validators.optional(validators.boolean()),
  notify_patients: validators.optional(validators.boolean()),
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

serve(withSentry("send-drug-recall-alert", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const validation = validateSchema(recallAlertRequestSchema, body);
    
    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { recall_id, notify_pharmacies = true, notify_patients = true } = validation.data;

    console.info(`Processing drug recall alert for recall_id: ${recall_id}`);

    // Get recall details
    const { data: recall, error: recallError } = await supabase
      .from("drug_recalls")
      .select("*")
      .eq("id", recall_id)
      .single();

    if (recallError || !recall) {
      const err = new Error("Recall not found");
      captureException(err);
      throw err;
    }

    // Escape dynamic values for email HTML
    const safeDrugName = escapeHtml(recall.drug_name || "");
    const safeGenericName = escapeHtml(recall.generic_name || "");
    const safeManufacturer = escapeHtml(recall.manufacturer || "");
    const safeRecallReason = escapeHtml(recall.recall_reason || "");
    const safeInstructions = escapeHtml(recall.instructions || "");
    const safeRecallClass = escapeHtml(recall.recall_class || "");
    const safeFdaReference = escapeHtml(recall.fda_reference || "");
    const safeLotNumbers = recall.lot_numbers?.map((ln: string) => escapeHtml(ln)).join(", ") || "";

    const notificationsSent: { pharmacies: number; patients: number } = { pharmacies: 0, patients: 0 };

    // Notify pharmacies that have this drug in their inventory
    if (notify_pharmacies) {
      const { data: pharmacies } = await supabase
        .from("pharmacy_locations")
        .select(`
          id,
          name,
          email,
          phone,
          pharmacist_user_id,
          profiles:pharmacist_user_id (email, phone, first_name, last_name)
        `)
        .eq("is_active", true);

      if (pharmacies) {
        for (const pharmacy of pharmacies) {
          const profile = pharmacy.profiles as { email?: string; phone?: string; first_name?: string; last_name?: string } | null;
          const pharmacyEmail = pharmacy.email || profile?.email;
          const pharmacyPhone = pharmacy.phone || profile?.phone;
          const channelsUsed: string[] = [];

          // Send email notification
          if (pharmacyEmail) {
            try {
              const emailResponse = await supabase.functions.invoke("send-encouragement-email", {
                body: {
                  to: pharmacyEmail,
                  subject: `⚠️ URGENT: Drug Recall Alert - ${safeDrugName}`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">⚠️ Drug Recall Alert</h1>
                      </div>
                      <div style="padding: 20px; background: #fef2f2;">
                        <h2 style="color: #dc2626;">${safeRecallClass}: ${safeDrugName}</h2>
                        ${safeGenericName ? `<p><strong>Generic Name:</strong> ${safeGenericName}</p>` : ""}
                        ${safeManufacturer ? `<p><strong>Manufacturer:</strong> ${safeManufacturer}</p>` : ""}
                        ${safeLotNumbers ? `<p><strong>Lot Numbers:</strong> ${safeLotNumbers}</p>` : ""}
                        <p><strong>Recall Reason:</strong> ${safeRecallReason}</p>
                        ${safeInstructions ? `<p><strong>Instructions:</strong> ${safeInstructions}</p>` : ""}
                        <p><strong>Recall Date:</strong> ${escapeHtml(recall.recall_date || "")}</p>
                        ${safeFdaReference ? `<p><strong>Reference:</strong> ${safeFdaReference}</p>` : ""}
                      </div>
                      <div style="padding: 20px; background: #fff;">
                        <p>Please check your inventory immediately and take appropriate action.</p>
                        <p style="color: #666; font-size: 12px;">This is an automated alert from Pillaxia.</p>
                      </div>
                    </div>
                  `,
                },
              });
              if (!emailResponse.error) channelsUsed.push("email");
            } catch (e) {
              console.warn("Email notification failed:", e);
              captureException(e instanceof Error ? e : new Error(String(e)));
            }
          }

          // Send SMS notification
          if (pharmacyPhone) {
            try {
              const smsResponse = await supabase.functions.invoke("send-sms-notification", {
                body: {
                  recipientId: pharmacy.pharmacist_user_id,
                  message: `⚠️ DRUG RECALL: ${recall.drug_name} (${recall.recall_class}). Reason: ${recall.recall_reason}. Check inventory immediately. - Pillaxia`,
                },
              });
              if (!smsResponse.error) channelsUsed.push("sms");
            } catch (e) {
              console.warn("SMS notification failed:", e);
              captureException(e instanceof Error ? e : new Error(String(e)));
            }
          }

          // Record notification
          if (channelsUsed.length > 0) {
            await supabase.from("drug_recall_notifications").insert({
              recall_id,
              pharmacy_id: pharmacy.id,
              notification_type: "pharmacy",
              channels_used: channelsUsed,
            });
            notificationsSent.pharmacies++;
          }
        }
      }
    }

    // Notify patients who have this medication
    if (notify_patients) {
      const { data: patientMedications } = await supabase
        .from("medications")
        .select(`
          user_id,
          name,
          profiles:user_id (email, phone, first_name)
        `)
        .ilike("name", `%${recall.drug_name}%`)
        .eq("is_active", true);

      if (patientMedications) {
        const notifiedPatients = new Set<string>();

        for (const med of patientMedications) {
          if (notifiedPatients.has(med.user_id)) continue;
          notifiedPatients.add(med.user_id);

          const profile = med.profiles as { email?: string; phone?: string; first_name?: string } | null;
          const channelsUsed: string[] = [];
          const safePatientName = escapeHtml(profile?.first_name || "Patient");

          // Send email to patient
          if (profile?.email) {
            try {
              const emailResponse = await supabase.functions.invoke("send-encouragement-email", {
                body: {
                  to: profile.email,
                  subject: `Important: Recall Notice for Your Medication - ${safeDrugName}`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: #f97316; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">Medication Recall Notice</h1>
                      </div>
                      <div style="padding: 20px;">
                        <p>Dear ${safePatientName},</p>
                        <p>We're writing to inform you that <strong>${safeDrugName}</strong>, which you are currently taking, has been recalled.</p>
                        <p><strong>Reason:</strong> ${safeRecallReason}</p>
                        ${safeInstructions ? `<p><strong>What you should do:</strong> ${safeInstructions}</p>` : ""}
                        <p>Please contact your healthcare provider or pharmacist for guidance on alternative medications.</p>
                        <p>Do NOT stop taking your medication without consulting your doctor first.</p>
                      </div>
                      <div style="padding: 20px; background: #f3f4f6;">
                        <p style="color: #666; font-size: 12px;">This is an automated alert from Pillaxia.</p>
                      </div>
                    </div>
                  `,
                },
              });
              if (!emailResponse.error) channelsUsed.push("email");
            } catch (e) {
              console.warn("Patient email notification failed:", e);
              captureException(e instanceof Error ? e : new Error(String(e)));
            }
          }

          // Send push notification
          try {
            await supabase.functions.invoke("send-push-notification", {
              body: {
                userId: med.user_id,
                title: "⚠️ Medication Recall Alert",
                body: `${recall.drug_name} has been recalled. Please check your medications and contact your pharmacist.`,
                data: { type: "drug_recall", recall_id },
              },
            });
            channelsUsed.push("push");
          } catch (e) {
            console.warn("Push notification failed:", e);
            captureException(e instanceof Error ? e : new Error(String(e)));
          }

          // Record notification
          if (channelsUsed.length > 0) {
            await supabase.from("drug_recall_notifications").insert({
              recall_id,
              patient_user_id: med.user_id,
              notification_type: "patient",
              channels_used: channelsUsed,
            });
            notificationsSent.patients++;
          }
        }
      }
    }

    console.info(`Recall alert sent: ${notificationsSent.pharmacies} pharmacies, ${notificationsSent.patients} patients`);

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notificationsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending recall alert:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
