import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedMedication {
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  instructions: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.info("Analyzing prescription image with AI vision...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a medical prescription analyzer. Extract medication information from prescription labels or medication boxes.
            
For each medication found, extract:
- name: The medication name (generic or brand)
- dosage: The numeric dosage amount
- dosage_unit: The unit (mg, g, ml, mcg, etc.)
- form: The form (tablet, capsule, liquid, injection, cream, drops, inhaler)
- instructions: Any dosing instructions visible
- confidence: Your confidence level from 0 to 1

Return a JSON object with a "medications" array. If you cannot find any medications, return an empty array.
Only extract what you can clearly read. Do not guess or make up information.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this prescription or medication image and extract all medication information you can find. Return the results as JSON.",
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_medications",
              description: "Extract medication information from a prescription image",
              parameters: {
                type: "object",
                properties: {
                  medications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Medication name" },
                        dosage: { type: "string", description: "Numeric dosage amount" },
                        dosage_unit: { type: "string", description: "Dosage unit (mg, g, ml, etc.)" },
                        form: { type: "string", description: "Medication form (tablet, capsule, etc.)" },
                        instructions: { type: "string", description: "Dosing instructions" },
                        confidence: { type: "number", description: "Confidence level 0-1" },
                      },
                      required: ["name", "dosage", "dosage_unit", "form", "confidence"],
                    },
                  },
                },
                required: ["medications"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_medications" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.info("AI response received");

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.info("No tool call in response, returning empty medications");
      return new Response(
        JSON.stringify({ medications: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const medications: ExtractedMedication[] = JSON.parse(toolCall.function.arguments).medications || [];
    console.info(`Extracted ${medications.length} medication(s)`);

    return new Response(
      JSON.stringify({ medications }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in extract-medication-ocr:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
