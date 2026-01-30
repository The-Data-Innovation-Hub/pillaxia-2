import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, withSentry, captureException } from "../_shared/sentry.ts";

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

// Authorization context
interface AuthContext {
  userId: string;
  roles: string[];
  isAdmin: boolean;
  isClinician: boolean;
  isPharmacist: boolean;
  isPatient: boolean;
}

// FHIR-compliant error response
function fhirErrorResponse(
  message: string, 
  code: string, 
  status: number, 
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code, diagnostics: message }],
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/fhir+json" } }
  );
}

// Helper function to check if user can access patient data
async function canAccessPatientData(
  supabase: SupabaseClient,
  authContext: AuthContext,
  patientId: string
): Promise<boolean> {
  // Admins can access all patient data
  if (authContext.isAdmin) {
    return true;
  }

  // Patients can only access their own data
  if (authContext.isPatient && authContext.userId === patientId) {
    return true;
  }

  // Clinicians can access data for patients they are assigned to
  if (authContext.isClinician) {
    const { data: assignment, error } = await supabase
      .from("clinician_patient_assignments")
      .select("id")
      .eq("clinician_user_id", authContext.userId)
      .eq("patient_user_id", patientId)
      .maybeSingle();
    
    if (!error && assignment) {
      return true;
    }
  }

  // Check if user is an accepted caregiver for this patient
  const { data: caregiverRelation, error: caregiverError } = await supabase
    .from("caregiver_invitations")
    .select("id")
    .eq("caregiver_user_id", authContext.userId)
    .eq("patient_user_id", patientId)
    .eq("status", "accepted")
    .maybeSingle();

  if (!caregiverError && caregiverRelation) {
    return true;
  }

  return false;
}

// Helper function to get authorized patient IDs for current user
async function getAuthorizedPatientIds(
  supabase: SupabaseClient,
  authContext: AuthContext
): Promise<string[]> {
  const patientIds: string[] = [];

  // Patients can access their own data
  if (authContext.isPatient) {
    patientIds.push(authContext.userId);
  }

  // Clinicians can access their assigned patients
  if (authContext.isClinician) {
    const { data: assignments } = await supabase
      .from("clinician_patient_assignments")
      .select("patient_user_id")
      .eq("clinician_user_id", authContext.userId);
    
    if (assignments && Array.isArray(assignments)) {
      for (const a of assignments) {
        if (a.patient_user_id) patientIds.push(a.patient_user_id);
      }
    }
  }

  // Caregivers can access their patients' data
  const { data: caregiverRelations } = await supabase
    .from("caregiver_invitations")
    .select("patient_user_id")
    .eq("caregiver_user_id", authContext.userId)
    .eq("status", "accepted");

  if (caregiverRelations && Array.isArray(caregiverRelations)) {
    for (const r of caregiverRelations) {
      if (r.patient_user_id) patientIds.push(r.patient_user_id);
    }
  }

  return [...new Set(patientIds)]; // Remove duplicates
}

// Convert internal medication to FHIR MedicationRequest
function toFHIRMedicationRequest(prescription: Record<string, unknown>): FHIRResource {
  return {
    resourceType: "MedicationRequest",
    id: prescription.id as string,
    meta: {
      lastUpdated: prescription.updated_at as string,
    },
    identifier: [
      {
        system: "urn:pillaxia:prescription",
        value: prescription.prescription_number as string,
      },
    ],
    status: mapPrescriptionStatus(prescription.status as string),
    intent: "order",
    medicationCodeableConcept: {
      coding: [
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          display: prescription.medication_name as string,
        },
      ],
      text: prescription.medication_name as string,
    },
    subject: {
      reference: `Patient/${prescription.patient_user_id}`,
    },
    requester: {
      reference: `Practitioner/${prescription.clinician_user_id}`,
    },
    authoredOn: prescription.date_written as string,
    dosageInstruction: [
      {
        text: prescription.sig as string,
        doseAndRate: [
          {
            doseQuantity: {
              value: parseFloat(prescription.dosage as string) || 0,
              unit: prescription.dosage_unit as string,
            },
          },
        ],
      },
    ],
    dispenseRequest: {
      quantity: {
        value: prescription.quantity as number,
        unit: prescription.form as string,
      },
      numberOfRepeatsAllowed: prescription.refills_authorized as number,
    },
    substitution: {
      allowedBoolean: !prescription.dispense_as_written,
    },
  };
}

// Convert internal patient profile to FHIR Patient
function toFHIRPatient(profile: Record<string, unknown>): FHIRResource {
  return {
    resourceType: "Patient",
    id: profile.user_id as string,
    meta: {
      lastUpdated: profile.updated_at as string,
    },
    identifier: [
      {
        system: "urn:pillaxia:user",
        value: profile.user_id as string,
      },
    ],
    name: [
      {
        use: "official",
        family: (profile.last_name as string) || "",
        given: profile.first_name ? [profile.first_name as string] : [],
      },
    ],
    telecom: [
      ...(profile.email
        ? [{ system: "email", value: profile.email as string, use: "home" }]
        : []),
      ...(profile.phone
        ? [{ system: "phone", value: profile.phone as string, use: "mobile" }]
        : []),
    ],
    address: profile.address_line1
      ? [
          {
            use: "home",
            line: [profile.address_line1, profile.address_line2].filter(Boolean) as string[],
            city: profile.city as string,
            state: profile.state as string,
            postalCode: profile.postal_code as string,
            country: profile.country as string,
          },
        ]
      : [],
  };
}

// Convert internal medication log to FHIR MedicationAdministration
function toFHIRMedicationAdministration(log: Record<string, unknown>, medication: Record<string, unknown> | null): FHIRResource {
  return {
    resourceType: "MedicationAdministration",
    id: log.id as string,
    meta: {
      lastUpdated: log.created_at as string,
    },
    status: log.status === "taken" ? "completed" : log.status === "missed" ? "not-done" : "in-progress",
    medicationCodeableConcept: {
      text: (medication?.name as string) || "Unknown",
    },
    subject: {
      reference: `Patient/${log.user_id}`,
    },
    effectiveDateTime: (log.taken_at || log.scheduled_time) as string,
    note: log.notes ? [{ text: log.notes as string }] : undefined,
  };
}

// Convert allergy to FHIR AllergyIntolerance
function toFHIRAllergyIntolerance(allergy: Record<string, unknown>): FHIRResource {
  return {
    resourceType: "AllergyIntolerance",
    id: allergy.id as string,
    meta: {
      lastUpdated: allergy.updated_at as string,
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
      text: allergy.allergen as string,
    },
    patient: {
      reference: `Patient/${allergy.user_id}`,
    },
    reaction: allergy.reaction_description
      ? [
          {
            description: allergy.reaction_description as string,
            severity: mapReactionSeverity(allergy.reaction_type as string | null),
          },
        ]
      : undefined,
  };
}

// Convert condition to FHIR Condition
function toFHIRCondition(condition: Record<string, unknown>): FHIRResource {
  return {
    resourceType: "Condition",
    id: condition.id as string,
    meta: {
      lastUpdated: condition.updated_at as string,
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
      text: condition.condition_name as string,
    },
    subject: {
      reference: `Patient/${condition.user_id}`,
    },
    onsetDateTime: condition.diagnosed_date as string,
    note: condition.notes ? [{ text: condition.notes as string }] : undefined,
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

serve(withSentry("fhir-api", async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return fhirErrorResponse("Authorization header required", "security", 401, corsHeaders);
    }

    // Create client with user's token for proper authorization
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate the JWT token and get user claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return fhirErrorResponse("Invalid or expired authentication token", "security", 401, corsHeaders);
    }

    const userId = claimsData.claims.sub as string;

    // Fetch user roles to determine access permissions
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      console.error("Failed to fetch user roles:", rolesError);
      return fhirErrorResponse("Failed to verify user permissions", "exception", 500, corsHeaders);
    }

    const roles = userRoles?.map((r: { role: string }) => r.role) || [];
    const authContext: AuthContext = {
      userId,
      roles,
      isAdmin: roles.includes("admin"),
      isClinician: roles.includes("clinician"),
      isPharmacist: roles.includes("pharmacist"),
      isPatient: roles.includes("patient"),
    };

    console.log(`FHIR API request from user ${userId} with roles: ${roles.join(", ")}`);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    // Expected paths: /fhir-api/{resourceType} or /fhir-api/{resourceType}/{id}
    // Remove 'fhir-api' from path
    const fhirPath = pathParts.slice(pathParts.indexOf("fhir-api") + 1);
    const resourceType = fhirPath[0];
    const resourceId = fhirPath[1];

    // Validate resourceId if provided (should be UUID)
    if (resourceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId)) {
      return fhirErrorResponse("Invalid resource ID format", "invalid", 400, corsHeaders);
    }

    // Extract patient ID from query params for scoped queries
    const patientId = url.searchParams.get("patient") || url.searchParams.get("subject");
    
    // Validate patient ID if provided
    if (patientId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) {
      return fhirErrorResponse("Invalid patient ID format", "invalid", 400, corsHeaders);
    }

    let bundle: FHIRBundle;

    switch (resourceType) {
      case "Patient": {
        if (resourceId) {
          // Check if user can access this specific patient
          const canAccess = await canAccessPatientData(supabase, authContext, resourceId);
          if (!canAccess) {
            return fhirErrorResponse("You do not have permission to access this patient's data", "forbidden", 403, corsHeaders);
          }

          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", resourceId)
            .single();

          if (error || !profile) {
            return fhirErrorResponse("Patient not found", "not-found", 404, corsHeaders);
          }

          return new Response(JSON.stringify(toFHIRPatient(profile as Record<string, unknown>)), {
            headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
          });
        }

        // For listing patients, admins see all, others see only authorized patients
        if (authContext.isAdmin) {
          const { data: profiles, error } = await supabase.from("profiles").select("*").limit(100);
          if (error) throw error;

          bundle = {
            resourceType: "Bundle",
            type: "searchset",
            total: profiles?.length || 0,
            entry: profiles?.map((p: Record<string, unknown>) => ({
              resource: toFHIRPatient(p),
              fullUrl: `${supabaseUrl}/functions/v1/fhir-api/Patient/${p.user_id}`,
            })),
          };
        } else {
          const authorizedPatientIds = await getAuthorizedPatientIds(supabase, authContext);
          
          if (authorizedPatientIds.length === 0) {
            bundle = {
              resourceType: "Bundle",
              type: "searchset",
              total: 0,
              entry: [],
            };
          } else {
            const { data: profiles, error } = await supabase
              .from("profiles")
              .select("*")
              .in("user_id", authorizedPatientIds)
              .limit(100);
            if (error) throw error;

            bundle = {
              resourceType: "Bundle",
              type: "searchset",
              total: profiles?.length || 0,
              entry: profiles?.map((p: Record<string, unknown>) => ({
                resource: toFHIRPatient(p),
                fullUrl: `${supabaseUrl}/functions/v1/fhir-api/Patient/${p.user_id}`,
              })),
            };
          }
        }
        break;
      }

      case "MedicationRequest": {
        // Check authorization for patient-scoped queries
        if (patientId) {
          const canAccess = await canAccessPatientData(supabase, authContext, patientId);
          if (!canAccess) {
            return fhirErrorResponse("You do not have permission to access this patient's prescriptions", "forbidden", 403, corsHeaders);
          }
        }

        let query = supabase.from("prescriptions").select("*");
        
        if (resourceId) {
          query = query.eq("id", resourceId);
        } else if (patientId) {
          query = query.eq("patient_user_id", patientId);
        } else if (!authContext.isAdmin) {
          // Non-admins can only see prescriptions for authorized patients
          const authorizedPatientIds = await getAuthorizedPatientIds(supabase, authContext);
          if (authorizedPatientIds.length === 0) {
            bundle = { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
            break;
          }
          query = query.in("patient_user_id", authorizedPatientIds);
        }

        const { data: prescriptions, error } = await query.limit(100);
        if (error) throw error;

        // For single resource request, verify access
        if (resourceId && prescriptions?.length === 1) {
          const prescription = prescriptions[0] as Record<string, unknown>;
          const canAccess = await canAccessPatientData(supabase, authContext, prescription.patient_user_id as string);
          if (!canAccess) {
            return fhirErrorResponse("You do not have permission to access this prescription", "forbidden", 403, corsHeaders);
          }
          return new Response(JSON.stringify(toFHIRMedicationRequest(prescription)), {
            headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
          });
        }

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: prescriptions?.length || 0,
          entry: prescriptions?.map((p: Record<string, unknown>) => ({
            resource: toFHIRMedicationRequest(p),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/MedicationRequest/${p.id}`,
          })),
        };
        break;
      }

      case "MedicationAdministration": {
        // Check authorization for patient-scoped queries
        if (patientId) {
          const canAccess = await canAccessPatientData(supabase, authContext, patientId);
          if (!canAccess) {
            return fhirErrorResponse("You do not have permission to access this patient's medication administration records", "forbidden", 403, corsHeaders);
          }
        }

        let query = supabase.from("medication_logs").select("*, medications(name)");
        
        if (patientId) {
          query = query.eq("user_id", patientId);
        } else if (!authContext.isAdmin) {
          const authorizedPatientIds = await getAuthorizedPatientIds(supabase, authContext);
          if (authorizedPatientIds.length === 0) {
            bundle = { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
            break;
          }
          query = query.in("user_id", authorizedPatientIds);
        }

        const { data: logs, error } = await query.limit(100);
        if (error) throw error;

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: logs?.length || 0,
          entry: logs?.map((log: Record<string, unknown>) => ({
            resource: toFHIRMedicationAdministration(log, log.medications as Record<string, unknown> | null),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/MedicationAdministration/${log.id}`,
          })),
        };
        break;
      }

      case "AllergyIntolerance": {
        // Check authorization for patient-scoped queries
        if (patientId) {
          const canAccess = await canAccessPatientData(supabase, authContext, patientId);
          if (!canAccess) {
            return fhirErrorResponse("You do not have permission to access this patient's allergy records", "forbidden", 403, corsHeaders);
          }
        }

        let query = supabase.from("patient_allergies").select("*");
        
        if (patientId) {
          query = query.eq("user_id", patientId);
        } else if (!authContext.isAdmin) {
          const authorizedPatientIds = await getAuthorizedPatientIds(supabase, authContext);
          if (authorizedPatientIds.length === 0) {
            bundle = { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
            break;
          }
          query = query.in("user_id", authorizedPatientIds);
        }

        const { data: allergies, error } = await query.limit(100);
        if (error) throw error;

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: allergies?.length || 0,
          entry: allergies?.map((a: Record<string, unknown>) => ({
            resource: toFHIRAllergyIntolerance(a),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/AllergyIntolerance/${a.id}`,
          })),
        };
        break;
      }

      case "Condition": {
        // Check authorization for patient-scoped queries
        if (patientId) {
          const canAccess = await canAccessPatientData(supabase, authContext, patientId);
          if (!canAccess) {
            return fhirErrorResponse("You do not have permission to access this patient's condition records", "forbidden", 403, corsHeaders);
          }
        }

        let query = supabase.from("patient_chronic_conditions").select("*");
        
        if (patientId) {
          query = query.eq("user_id", patientId);
        } else if (!authContext.isAdmin) {
          const authorizedPatientIds = await getAuthorizedPatientIds(supabase, authContext);
          if (authorizedPatientIds.length === 0) {
            bundle = { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
            break;
          }
          query = query.in("user_id", authorizedPatientIds);
        }

        const { data: conditions, error } = await query.limit(100);
        if (error) throw error;

        bundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: conditions?.length || 0,
          entry: conditions?.map((c: Record<string, unknown>) => ({
            resource: toFHIRCondition(c),
            fullUrl: `${supabaseUrl}/functions/v1/fhir-api/Condition/${c.id}`,
          })),
        };
        break;
      }

      case "metadata": {
        // FHIR Capability Statement - public endpoint
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
              security: {
                cors: true,
                service: [
                  {
                    coding: [
                      {
                        system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
                        code: "OAuth",
                        display: "OAuth"
                      }
                    ],
                    text: "OAuth2 Bearer Token authentication required. Access is scoped based on user roles and patient relationships."
                  }
                ],
                description: "Authenticated users can only access patient data they are authorized to view. Patients access their own data. Clinicians access assigned patients. Caregivers access patients who have granted access."
              },
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
        return fhirErrorResponse(`Resource type '${resourceType}' is not supported`, "not-supported", 400, corsHeaders);
    }

    return new Response(JSON.stringify(bundle), {
      headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
    });
  } catch (error) {
    console.error("FHIR API error:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    return fhirErrorResponse("An internal server error occurred", "exception", 500, corsHeaders);
  }
}));
