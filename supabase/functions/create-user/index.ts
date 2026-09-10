// SmartOmbor ERP - Supabase Edge Function: create-user
// Creates a new user account in auth.users and profiles using server-side SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: { message: "Server error: SUPABASE_SERVICE_ROLE_KEY missing" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { message: "Authentication required" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseCaller = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callerUser }, error: userError } = await supabaseCaller.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: { message: "Unauthorized: Invalid caller session" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check caller role in profiles table
    const { data: callerProfile } = await supabaseCaller
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    const callerRole = (callerProfile && callerProfile.role) ? callerProfile.role.toLowerCase() : "";
    if (callerRole !== "admin" && callerRole !== "director") {
      return new Response(
        JSON.stringify({ error: { message: "Forbidden: Only admins/directors can add new users" } }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse input body
    const body = await req.json();
    const { full_name, email, password, role, region_id } = body;

    if (!full_name || !password) {
      return new Response(
        JSON.stringify({ error: { message: "Ism-sharif va parol kiritilishi shart" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanSlug = full_name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const finalEmail = email || `${cleanSlug || "xodim" + Date.now()}@smartup.uz`;
    const targetRole = (role || "agent").toLowerCase();

    // 4. Create user via Supabase Admin Client (service_role) with auto email confirmation
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name,
        role: targetRole,
        region_id: region_id || null
      }
    });

    if (createError || !authData || !authData.user) {
      console.error("[create-user Edge Function] Auth create error:", createError);
      return new Response(
        JSON.stringify({ error: { message: createError?.message || "Supabase Auth foydalanuvchi yaratishda xatolik" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = authData.user.id;

    // 5. Insert/upsert into profiles table
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      full_name: full_name,
      role: targetRole,
      updated_at: new Date().toISOString()
    });

    if (profileError) {
      console.warn("[create-user Edge Function] Profile upsert warning:", profileError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User created successfully in Supabase Auth & profiles",
        user: {
          id: newUserId,
          full_name: full_name,
          email: finalEmail,
          role: targetRole
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[create-user Edge Function] Exception:", err);
    return new Response(
      JSON.stringify({ error: { message: err.message || "Internal server error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
