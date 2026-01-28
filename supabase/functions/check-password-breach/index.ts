import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate SHA-1 hash of password
async function sha1Hash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    console.log(`Password breach check requested by user: ${userId}`);
    // ========== END AUTHENTICATION ==========

    const { password } = await req.json();

    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the password using SHA-1
    const hash = await sha1Hash(password);
    
    // Use k-anonymity: send only first 5 characters of hash
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    console.log(`Checking password breach with prefix: ${prefix}`);

    // Query HIBP API with hash prefix
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'Pillaxia-Healthcare-Platform',
        'Add-Padding': 'true', // Privacy enhancement
      },
    });

    if (!response.ok) {
      console.error('HIBP API error:', response.status, response.statusText);
      // On API error, fail open (allow the password) but log the issue
      return new Response(
        JSON.stringify({ breached: false, count: 0, apiError: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = await response.text();
    const lines = text.split('\n');

    // Check if our password hash suffix exists in the response
    let breachCount = 0;
    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim().toUpperCase() === suffix) {
        breachCount = parseInt(count.trim(), 10);
        break;
      }
    }

    const isBreached = breachCount > 0;
    
    if (isBreached) {
      console.log(`Password found in ${breachCount} breaches`);
    }

    return new Response(
      JSON.stringify({ 
        breached: isBreached, 
        count: breachCount,
        message: isBreached 
          ? `This password has been exposed in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`
          : 'Password not found in known breaches'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking password breach:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check password', breached: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
