import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CDS_SYSTEM_PROMPT = `You are a Clinical Decision Support AI assistant integrated into Pillaxia, a healthcare platform. You assist clinicians by analyzing patient data and providing evidence-based insights.

**Your Role:**
- Analyze symptoms, vitals, lab results, medications, and health history
- Suggest possible diagnoses based on clinical presentation
- Recommend evidence-based treatment options
- Flag potential drug interactions and contraindications
- Identify red flags requiring urgent attention

**Critical Guidelines:**
- Always state that these are AI-generated suggestions requiring clinical judgment
- Never provide definitive diagnoses - always phrase as "Consider..." or "Possible..."
- Highlight any critical findings that need immediate attention
- Reference relevant clinical guidelines when applicable
- Consider the patient's existing conditions and medications
- Flag any potential drug-drug or drug-condition interactions

**Response Format:**
Structure your response with clear sections:
1. **Clinical Summary** - Brief overview of the patient presentation
2. **Differential Diagnoses** - Ranked list of possible conditions to consider
3. **Recommended Investigations** - Additional tests or assessments
4. **Treatment Considerations** - Evidence-based treatment options
5. **Safety Alerts** - Any interactions, contraindications, or red flags
6. **Follow-up Recommendations** - Monitoring and next steps

Always end with a reminder that clinical judgment should guide final decisions.`;

interface PatientContext {
  symptoms?: Array<{
    name: string;
    severity: number;
    duration?: string;
    notes?: string;
  }>;
  vitals?: {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
  };
  labResults?: Array<{
    test_name: string;
    result_value: string;
    reference_range?: string;
    is_abnormal?: boolean;
  }>;
  medications?: Array<{
    name: string;
    dosage: string;
    form: string;
  }>;
  healthProfile?: {
    conditions?: string[];
    allergies?: Array<{ allergen: string; severity?: string }>;
    age?: number;
    gender?: string;
  };
  clinicalQuestion?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: 'Unauthorized - authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`CDS request authenticated for user: ${userId}`);
    // ========== END AUTHENTICATION ==========

    const { patientContext, conversationHistory } = await req.json() as {
      patientContext: PatientContext;
      conversationHistory?: Array<{ role: string; content: string }>;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the patient context message
    let contextMessage = "## Patient Information\n\n";

    if (patientContext.healthProfile) {
      contextMessage += "### Demographics & History\n";
      if (patientContext.healthProfile.age) {
        contextMessage += `- Age: ${patientContext.healthProfile.age} years\n`;
      }
      if (patientContext.healthProfile.gender) {
        contextMessage += `- Gender: ${patientContext.healthProfile.gender}\n`;
      }
      if (patientContext.healthProfile.conditions?.length) {
        contextMessage += `- Chronic Conditions: ${patientContext.healthProfile.conditions.join(", ")}\n`;
      }
      if (patientContext.healthProfile.allergies?.length) {
        contextMessage += `- Allergies: ${patientContext.healthProfile.allergies.map(a => `${a.allergen}${a.severity ? ` (${a.severity})` : ""}`).join(", ")}\n`;
      }
      contextMessage += "\n";
    }

    if (patientContext.symptoms?.length) {
      contextMessage += "### Current Symptoms\n";
      patientContext.symptoms.forEach(s => {
        contextMessage += `- **${s.name}**: Severity ${s.severity}/10`;
        if (s.duration) contextMessage += `, Duration: ${s.duration}`;
        if (s.notes) contextMessage += ` - ${s.notes}`;
        contextMessage += "\n";
      });
      contextMessage += "\n";
    }

    if (patientContext.vitals) {
      contextMessage += "### Vital Signs\n";
      const v = patientContext.vitals;
      if (v.blood_pressure_systolic && v.blood_pressure_diastolic) {
        contextMessage += `- Blood Pressure: ${v.blood_pressure_systolic}/${v.blood_pressure_diastolic} mmHg\n`;
      }
      if (v.heart_rate) contextMessage += `- Heart Rate: ${v.heart_rate} bpm\n`;
      if (v.temperature) contextMessage += `- Temperature: ${v.temperature}°C\n`;
      if (v.respiratory_rate) contextMessage += `- Respiratory Rate: ${v.respiratory_rate}/min\n`;
      if (v.oxygen_saturation) contextMessage += `- SpO2: ${v.oxygen_saturation}%\n`;
      contextMessage += "\n";
    }

    if (patientContext.labResults?.length) {
      contextMessage += "### Recent Lab Results\n";
      patientContext.labResults.forEach(lab => {
        const abnormalFlag = lab.is_abnormal ? " ⚠️" : "";
        contextMessage += `- **${lab.test_name}**: ${lab.result_value}${abnormalFlag}`;
        if (lab.reference_range) contextMessage += ` (Ref: ${lab.reference_range})`;
        contextMessage += "\n";
      });
      contextMessage += "\n";
    }

    if (patientContext.medications?.length) {
      contextMessage += "### Current Medications\n";
      patientContext.medications.forEach(med => {
        contextMessage += `- ${med.name} ${med.dosage} (${med.form})\n`;
      });
      contextMessage += "\n";
    }

    if (patientContext.clinicalQuestion) {
      contextMessage += `### Clinical Question\n${patientContext.clinicalQuestion}\n`;
    } else {
      contextMessage += "### Request\nPlease provide a comprehensive clinical decision support analysis for this patient.\n";
    }

    // Build messages array
    const messages = [
      ...(conversationHistory || []),
      { role: "user", content: contextMessage }
    ];

    console.log("Sending CDS request to Lovable AI Gateway");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: CDS_SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "The AI service is busy. Please try again in a moment." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits exhausted. Please contact support." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to connect to AI service." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully connected to AI gateway, streaming CDS response");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Clinical decision support error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "An error occurred" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
