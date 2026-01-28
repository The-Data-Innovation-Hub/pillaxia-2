import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { ip_address, user_agent, action = 'login' } = body;

    // Get IP from header if not provided
    const clientIp = ip_address || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 'unknown';

    console.log(`Getting geolocation for IP: ${clientIp}`);

    // Query free IP geolocation API (ip-api.com - 45 requests/minute limit)
    let geoData: Partial<GeoLocation> = {};
    
    if (clientIp && clientIp !== 'unknown' && !clientIp.startsWith('127.') && !clientIp.startsWith('192.168.')) {
      try {
        const geoResponse = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
        const geoJson = await geoResponse.json();
        
        if (geoJson.status === 'success') {
          geoData = geoJson;
        } else {
          console.warn('Geolocation lookup failed:', geoJson.message);
        }
      } catch (geoError) {
        console.error('Geolocation API error:', geoError);
      }
    }

    // Check if this is a new location for this user
    const { data: existingLocations } = await supabase
      .from('user_login_locations')
      .select('id, city, country_code, is_trusted')
      .eq('user_id', user.id);

    const isNewLocation = !existingLocations?.some(
      loc => loc.city === geoData.city && loc.country_code === geoData.countryCode
    );

    const isNewCountry = !existingLocations?.some(
      loc => loc.country_code === geoData.countryCode
    );

    // Insert new login location record
    const { error: insertError } = await supabase
      .from('user_login_locations')
      .insert({
        user_id: user.id,
        ip_address: clientIp,
        city: geoData.city || 'Unknown',
        region: geoData.regionName || 'Unknown',
        country: geoData.country || 'Unknown',
        country_code: geoData.countryCode || 'XX',
        latitude: geoData.lat || null,
        longitude: geoData.lon || null,
        timezone: geoData.timezone || null,
        isp: geoData.isp || null,
        user_agent: user_agent || null,
        is_trusted: !isNewLocation, // Existing locations are trusted
        action: action,
      });

    if (insertError) {
      console.error('Failed to insert login location:', insertError);
    }

    // If new location or new country, trigger security alert
    if (isNewLocation || isNewCountry) {
      console.log(`New ${isNewCountry ? 'country' : 'location'} detected for user ${user.id}`);

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'new_login_location',
        p_event_category: 'authentication',
        p_severity: isNewCountry ? 'warning' : 'info',
        p_description: isNewCountry 
          ? `Login from new country: ${geoData.city}, ${geoData.country}`
          : `Login from new location: ${geoData.city}, ${geoData.regionName}`,
        p_ip_address: clientIp,
        p_user_agent: user_agent,
        p_metadata: {
          city: geoData.city,
          region: geoData.regionName,
          country: geoData.country,
          country_code: geoData.countryCode,
          is_new_country: isNewCountry,
          lat: geoData.lat,
          lon: geoData.lon,
        },
      });

      // Send security alert email for new country logins
      if (isNewCountry) {
        try {
          await supabase.functions.invoke('send-security-alert', {
            body: {
              userId: user.id,
              email: user.email,
              eventType: 'new_login_location',
              severity: 'warning',
              title: 'New Login Location Detected',
              description: `A login to your account was detected from a new location: ${geoData.city}, ${geoData.country}. If this wasn't you, please secure your account immediately.`,
              metadata: {
                ip_address: clientIp,
                city: geoData.city,
                country: geoData.country,
                isp: geoData.isp,
                timestamp: new Date().toISOString(),
              },
            },
          });
        } catch (emailError) {
          console.error('Failed to send new location alert email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        location: {
          city: geoData.city,
          region: geoData.regionName,
          country: geoData.country,
          countryCode: geoData.countryCode,
        },
        isNewLocation,
        isNewCountry,
        isTrusted: !isNewLocation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-ip-geolocation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
