import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FHIR R4 Resource Types
interface FHIRBundle {
  resourceType: "Bundle";
  type: "searchset" | "collection";
  total?: number;
  entry?: Array<{
    resource: FHIRResource;
    fullUrl?: string;
  }>;
}

interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
  };
  [key: string]: unknown;
}

// Convert internal medication to FHIR MedicationRequest
function toFHIRMedicationRequest(prescription: any): FHIRResource {
  return {
    resourceType: "MedicationRequest",
    id: prescription.id,
    meta: {
      lastUpdated: prescription.updated_at,
    },
    identifier: [
      {
        system: "urn:pillaxia:prescription",
        value: prescription.prescription_number,
      },
    ],
    status: mapPrescriptionStatus(prescription.status),
    intent: "order",
    medicationCodeableConcept: {
      coding: [
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          display: prescription.medication_name,
        },
      ],
      text: prescription.medication_name,
    },
    subject: {
      reference: `Patient/${prescription.patient_user_id}`,
    },
    requester: {
      reference: `Practitioner/${prescription.clinician_user_id}`,
    },
    authoredOn: prescription.date_written,
    dosageInstruction: [
      {
        text: prescription.sig,
        doseAndRate: [
          {
            doseQuantity: {
              value: parseFloat(prescription.dosage) || 0,
              unit: prescription.dosage_unit,
            },
          },
        ],
      },
    ],
    dispenseRequest: {
      quantity: {
        value: prescription.quantity,
        unit: prescription.form,
      },
      numberOfRepeatsAllowed: prescription.refills_authorized,
    },
    substitution: {
      allowedBoolean: !prescription.dispense_as_written,
    },
  };
}

// Convert internal patient profile to FHIR Patient
function toFHIRPatient(profile: any): FHIRResource {
  return {
    resourceType: "Patient",
    id: profile.user_id,
    meta: {
      lastUpdated: profile.updated_at,
    },
    identifier: [
      {
        system: "urn:pillaxia:user",
        value: profile.user_id,
      },
    ],
    name: [
      {
        use: "official",
        family: profile.last_name || "",
        given: profile.first_name ? [profile.first_name] : [],
      },
    ],
    telecom: [
      ...(profile.email
        ? [{ system: "email", value: profile.email, use: "home" }]
        : []),
      ...(profile.phone
        ? [{ system: "phone", value: profile.phone, use: "mobile" }]
        : []),
    ],
    address: profile.address_line1
      ? [
          {
            use: "home",
            line: [profile.address_line1, profile.address_line2].filter(Boolean),
            city: profile.city,
            state: profile.state,
            postalCode: profile.postal_code,
            country: profile.country,
          },
        ]
      : [],
  };
}

// Convert internal medication log to FHIR MedicationAdministration
function toFHIRMedicationAdministration(log: any, medication: any): FHIRResource {
  return {
    resourceType: "MedicationAdministration",
    id: log.id,
    meta: {
      lastUpdated: log.created_at,
    },
    status: log.status === "taken" ? "completed" : log.status === "missed" ? "not-done" : "in-progress",
    medicationCodeableConcept: {
      text: medication?.name || "Unknown",
    },
    subject: {
      reference: `Patient/${log.user_id}`,
    },
    effectiveDateTime: log.taken_at || log.scheduled_time,
    note: log.notes ? [{ text: log.notes }] : undefined,
  };
}

// Convert allergy to FHIR AllergyIntolerance
function toFHIRAllergyIntolerance(allergy: any): FHIRResource {
  return {
    resourceType: "AllergyIntolerance",
    id: allergy.id,
    meta: {
      lastUpdated: allergy.updated_at,
    },
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active",
        },
      ],
    },
    type: allergy.is_drug_allergy ? "allergy" : "intolerance",
    category: allergy.is_drug_allergy ? ["medication"] : ["environment"],
    code: {
      text: allergy.allergen,
    },
    patient: {
      reference: `Patient/${allergy.user_id}`,
    },
    reaction: allergy.reaction_description
      ? [
          {
            description: allergy.reaction_description,
            severity: mapReactionSeverity(allergy.reaction_type),
          },
        ]
      : undefined,
  };
}

// Convert condition to FHIR Condition
function toFHIRCondition(condition: any): FHIRResource {
  return {
    resourceType: "Condition",
    id: condition.id,
    meta: {
      lastUpdated: condition.updated_at,
    },
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: condition.is_active ? "active" : "inactive",
        },
      ],
    },
    code: {
      text: condition.condition_name,
    },
    subject: {
      reference: `Patient/${condition.user_id}`,
    },
    onsetDateTime: condition.diagnosed_date,
    note: condition.notes ? [{ text: condition.notes }] : undefined,
  };
}

function mapPrescriptionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: "draft",
    pending: "active",
    sent: "active",
    received: "active",
    processing: "active",
    ready: "active",
    dispensed: "completed",
    cancelled: "cancelled",
    expired: "stopped",
  };
  return statusMap[status] || "unknown";
}

function mapReactionSeverity(type: string | null): string {
  if (!type) return "moderate";
  const severityMap: Record<string, string> = {
    mild: "mild",
    moderate: "moderate",
    severe: "severe",
    anaphylaxis: "severe",
  };
  return severityMap[type.toLowerCase()] || "moderate";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    // Expected paths: /fhir-api/{resourceType} or /fhir-api/{resourceType}/{id}
    // Remove 'fhir-api' from path
    const fhirPath = pathParts.slice(pathParts.indexOf("fhir-api") + 1);
    const resourceType = fhirPath[0];
    const resourceId = fhirPath[1];

    // Extract patient ID from query params for scoped queries
    const patientId = url.searchParams.get("patient") || url.searchParams.get("subject");

    // Validate authorization (simplified - in production use proper OAuth2/SMART)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "security",
              diagnostics: "Authorization header required",
            },
          ],
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
        }
      );
    }

    let bundle: FHIRBundle;

    switch (resourceType) {
      case "Patient": {
        if (resourceId) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", resourceId)
            .single();

          if (error || !profile) {
            return new Response(
              JSON.stringify({
                resourceType: "OperationOutcome",
                issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }],
              }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/fhir+json" } }
            );
          }

          return new Response(JSON.stringify(toFHIRPatient(profile)), {
            headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
          });
        }

        const { data: profiles, error } = await supabase.from("profiles").select("*").limit(100);
        if (error) throw error;

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: profiles?.length || 0,
          entry: profiles?.map((p) => ({
            resource: toFHIRPatient(p),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/Patient/${p.user_id}`,
          })),
        };
        break;
      }

      case "MedicationRequest": {
        let query = supabase.from("prescriptions").select("*");
        if (patientId) query = query.eq("patient_user_id", patientId);
        if (resourceId) query = query.eq("id", resourceId);

        const { data: prescriptions, error } = await query.limit(100);
        if (error) throw error;

        if (resourceId && prescriptions?.length === 1) {
          return new Response(JSON.stringify(toFHIRMedicationRequest(prescriptions[0])), {
            headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
          });
        }

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: prescriptions?.length || 0,
          entry: prescriptions?.map((p) => ({
            resource: toFHIRMedicationRequest(p),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/MedicationRequest/${p.id}`,
          })),
        };
        break;
      }

      case "MedicationAdministration": {
        let query = supabase.from("medication_logs").select("*, medications(name)");
        if (patientId) query = query.eq("user_id", patientId);

        const { data: logs, error } = await query.limit(100);
        if (error) throw error;

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: logs?.length || 0,
          entry: logs?.map((log: any) => ({
            resource: toFHIRMedicationAdministration(log, log.medications),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/MedicationAdministration/${log.id}`,
          })),
        };
        break;
      }

      case "AllergyIntolerance": {
        let query = supabase.from("patient_allergies").select("*");
        if (patientId) query = query.eq("user_id", patientId);

        const { data: allergies, error } = await query.limit(100);
        if (error) throw error;

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: allergies?.length || 0,
          entry: allergies?.map((a) => ({
            resource: toFHIRAllergyIntolerance(a),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/AllergyIntolerance/${a.id}`,
          })),
        };
        break;
      }

      case "Condition": {
        let query = supabase.from("patient_chronic_conditions").select("*");
        if (patientId) query = query.eq("user_id", patientId);

        const { data: conditions, error } = await query.limit(100);
        if (error) throw error;

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: conditions?.length || 0,
          entry: conditions?.map((c) => ({
            resource: toFHIRCondition(c),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/Condition/${c.id}`,
          })),
        };
        break;
      }

      case "metadata": {
        // FHIR Capability Statement
        const capabilityStatement = {
          resourceType: "CapabilityStatement",
          status: "active",
          date: new Date().toISOString(),
          kind: "instance",
          fhirVersion: "4.0.1",
          format: ["json"],
          rest: [
            {
              mode: "server",
              resource: [
                { type: "Patient", interaction: [{ code: "read" }, { code: "search-type" }] },
                { type: "MedicationRequest", interaction: [{ code: "read" }, { code: "search-type" }] },
                { type: "MedicationAdministration", interaction: [{ code: "search-type" }] },
                { type: "AllergyIntolerance", interaction: [{ code: "search-type" }] },
                { type: "Condition", interaction: [{ code: "search-type" }] },
              ],
            },
          ],
        };

        return new Response(JSON.stringify(capabilityStatement), {
          headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({
            resourceType: "OperationOutcome",
            issue: [
              {
                severity: "error",
                code: "not-supported",
                diagnostics: `Resource type '${resourceType}' is not supported`,
              },
            ],
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/fhir+json" } }
        );
    }

    return new Response(JSON.stringify(bundle), {
      headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
    });
  } catch (error) {
    console.error("FHIR API error:", error);
    return new Response(
      JSON.stringify({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: error instanceof Error ? error.message : "Internal server error",
          },
        ],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/fhir+json" } }
    );
  }
});
