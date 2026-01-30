import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

/**
 * Seed Demo Users
 * 
 * Creates or resets demo user accounts for testing.
 * ADMIN-ONLY: Requires admin role to execute.
 * 
 * Security:
 * - Validates JWT and checks for admin role
 * - Only operates on @demo.pillaxia.com emails
 * - Rate limited by Supabase infrastructure
 */

const DEMO_USERS = [
  { email: "patient@demo.pillaxia.com", password: "DemoPatient2026!", role: "patient", firstName: "Demo", lastName: "Patient" },
  { email: "clinician@demo.pillaxia.com", password: "DemoClinician2026!", role: "clinician", firstName: "Demo", lastName: "Clinician" },
  { email: "pharmacist@demo.pillaxia.com", password: "DemoPharmacist2026!", role: "pharmacist", firstName: "Demo", lastName: "Pharmacist" },
  { email: "admin@demo.pillaxia.com", password: "DemoAdmin2026!", role: "admin", firstName: "Demo", lastName: "Admin" },
  { email: "manager@demo.pillaxia.com", password: "DemoManager2026!", role: "manager", firstName: "Demo", lastName: "Manager" },
  // Additional mock patients for testing
  { email: "alice.johnson@demo.pillaxia.com", password: "DemoAlice2026!", role: "patient", firstName: "Alice", lastName: "Johnson" },
  { email: "bob.smith@demo.pillaxia.com", password: "DemoBob2026!", role: "patient", firstName: "Bob", lastName: "Smith" },
  { email: "carol.williams@demo.pillaxia.com", password: "DemoCarol2026!", role: "patient", firstName: "Carol", lastName: "Williams" },
  { email: "david.brown@demo.pillaxia.com", password: "DemoDavid2026!", role: "patient", firstName: "David", lastName: "Brown" },
];

// Validate that an email is a demo email
function isDemoEmail(email: string): boolean {
  return email.endsWith("@demo.pillaxia.com");
}

Deno.serve(withSentry("seed-demo-users", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Create admin client for user management
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.warn(`Non-admin user ${userId} attempted to seed demo users`);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Admin ${userId} initiating demo user seed`);

    const results: Array<{ email: string; status: string; error?: string; userId?: string }> = [];

    // Get existing users once
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingEmails = new Set(existingUsers?.users?.map(u => u.email) || []);

    for (const user of DEMO_USERS) {
      // Double-check email is a demo email (defense in depth)
      if (!isDemoEmail(user.email)) {
        console.error(`Attempted to create non-demo user: ${user.email}`);
        continue;
      }

      if (existingEmails.has(user.email)) {
        // Reset password for existing demo users
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);
        if (existingUser) {
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            existingUser.id,
            { password: user.password }
          );
          if (updateError) {
            results.push({ email: user.email, status: "password reset failed", error: updateError.message });
            captureException(new Error(`Demo user password reset failed: ${updateError.message}`));
          } else {
            results.push({ email: user.email, status: "password reset" });
          }
        }
        continue;
      }

      // Create the user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role,
        },
      });

      if (error) {
        results.push({ email: user.email, status: "error", error: error.message });
        captureException(new Error(`Demo user creation failed: ${error.message}`));
      } else {
        results.push({ email: user.email, status: "created", userId: data.user?.id });
      }
    }

    console.log(`Demo user seed complete: ${results.filter(r => r.status === "created").length} created, ${results.filter(r => r.status === "password reset").length} reset`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in seed-demo-users:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
