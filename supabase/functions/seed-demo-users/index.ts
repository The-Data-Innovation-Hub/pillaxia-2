import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results = [];

    // Get existing users once
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingEmails = new Set(existingUsers?.users?.map(u => u.email) || []);

    for (const user of DEMO_USERS) {
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
      } else {
        results.push({ email: user.email, status: "created", userId: data.user?.id });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
