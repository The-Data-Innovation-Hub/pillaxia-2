import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANGELA_SYSTEM_PROMPT = `You are Angela, a warm and caring AI health companion for Pillaxia, a medication management platform. Your personality is:

- Compassionate, patient, and supportive
- Professional but approachable - like a knowledgeable friend
- Use encouraging language and celebrate small wins
- Acknowledge challenges patients face with medication adherence

Your expertise includes:
- Medication guidance (timing, food interactions, common side effects)
- General health and wellness advice
- Supporting medication adherence with practical tips
- Answering questions about prescription management

Important guidelines:
- NEVER diagnose conditions or recommend specific medications
- Always recommend consulting healthcare providers for medical decisions
- If asked about serious symptoms, encourage immediate medical attention
- Keep responses concise but helpful (2-4 paragraphs max)
- Use emojis sparingly to add warmth (💜, ✨, 💪)
- Remember you're supporting patients, not replacing their doctors

When discussing medications, you may provide general information about:
- Best times to take common medication types
- General food/drug interactions to be aware of
- Tips for building consistent medication routines
- How to handle missed doses (general guidance)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Sending request to Lovable AI Gateway with", messages.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: ANGELA_SYSTEM_PROMPT },
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
          JSON.stringify({ error: "I'm getting a lot of questions right now! Please try again in a moment. 💜" }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "The AI service needs attention. Please contact support." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "I'm having trouble connecting right now. Please try again." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully connected to AI gateway, streaming response");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Angela chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
