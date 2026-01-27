import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecallAlertRequest {
  recall_id: string;
  notify_pharmacies?: boolean;
  notify_patients?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { recall_id, notify_pharmacies = true, notify_patients = true }: RecallAlertRequest = await req.json();

    if (!recall_id) {
      throw new Error("recall_id is required");
    }

    console.log(`Processing drug recall alert for recall_id: ${recall_id}`);

    // Get recall details
    const { data: recall, error: recallError } = await supabase
      .from("drug_recalls")
      .select("*")
      .eq("id", recall_id)
      .single();

    if (recallError || !recall) {
      throw new Error("Recall not found");
    }

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
          const profile = pharmacy.profiles as any;
          const pharmacyEmail = pharmacy.email || profile?.email;
          const pharmacyPhone = pharmacy.phone || profile?.phone;
          const channelsUsed: string[] = [];

          // Send email notification
          if (pharmacyEmail) {
            try {
              const emailResponse = await supabase.functions.invoke("send-encouragement-email", {
                body: {
                  to: pharmacyEmail,
                  subject: `⚠️ URGENT: Drug Recall Alert - ${recall.drug_name}`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">⚠️ Drug Recall Alert</h1>
                      </div>
                      <div style="padding: 20px; background: #fef2f2;">
                        <h2 style="color: #dc2626;">${recall.recall_class}: ${recall.drug_name}</h2>
                        ${recall.generic_name ? `<p><strong>Generic Name:</strong> ${recall.generic_name}</p>` : ""}
                        ${recall.manufacturer ? `<p><strong>Manufacturer:</strong> ${recall.manufacturer}</p>` : ""}
                        ${recall.lot_numbers?.length ? `<p><strong>Lot Numbers:</strong> ${recall.lot_numbers.join(", ")}</p>` : ""}
                        <p><strong>Recall Reason:</strong> ${recall.recall_reason}</p>
                        ${recall.instructions ? `<p><strong>Instructions:</strong> ${recall.instructions}</p>` : ""}
                        <p><strong>Recall Date:</strong> ${recall.recall_date}</p>
                        ${recall.fda_reference ? `<p><strong>Reference:</strong> ${recall.fda_reference}</p>` : ""}
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
              console.error("Email notification failed:", e);
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
              console.error("SMS notification failed:", e);
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

          const profile = med.profiles as any;
          const channelsUsed: string[] = [];

          // Send email to patient
          if (profile?.email) {
            try {
              const emailResponse = await supabase.functions.invoke("send-encouragement-email", {
                body: {
                  to: profile.email,
                  subject: `Important: Recall Notice for Your Medication - ${recall.drug_name}`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: #f97316; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">Medication Recall Notice</h1>
                      </div>
                      <div style="padding: 20px;">
                        <p>Dear ${profile.first_name || "Patient"},</p>
                        <p>We're writing to inform you that <strong>${recall.drug_name}</strong>, which you are currently taking, has been recalled.</p>
                        <p><strong>Reason:</strong> ${recall.recall_reason}</p>
                        ${recall.instructions ? `<p><strong>What you should do:</strong> ${recall.instructions}</p>` : ""}
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
              console.error("Patient email notification failed:", e);
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
            console.error("Push notification failed:", e);
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

    console.log(`Recall alert sent: ${notificationsSent.pharmacies} pharmacies, ${notificationsSent.patients} patients`);

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notificationsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending recall alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
