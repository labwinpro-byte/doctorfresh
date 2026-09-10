// SmartOmbor ERP - Supabase Edge Function: delete-user
// Deletes a user account from auth.users using server-side SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: { message: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY missing" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get caller's auth token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { message: "Authentication required (missing Authorization header)" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize client with caller's token to verify identity & role
    const supabaseCaller = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callerUser }, error: userError } = await supabaseCaller.auth.getUser();

    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: { message: "Unauthorized: Invalid session or token" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify caller role in 'profiles' table (must be admin or director)
    const { data: callerProfile, error: profileErr } = await supabaseCaller
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    const callerRole = (callerProfile && callerProfile.role) ? callerProfile.role.toLowerCase() : "";

    if (!callerRole || (callerRole !== "admin" && callerRole !== "director")) {
      return new Response(
        JSON.stringify({ error: { message: "Forbidden: Only admins and directors can delete users" } }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse payload
    const body = await req.json();
    const targetUserId = body.user_id || body.userId || body.id;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: { message: "user_id is required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetUserId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: { message: "You cannot delete your own active account" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Initialize Supabase Admin client with service_role key to delete from auth.users
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Delete user from auth.users
    const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthErr) {
      console.error("[delete-user Edge Function] Auth delete error:", deleteAuthErr);
      return new Response(
        JSON.stringify({ error: { message: deleteAuthErr.message || "Failed to delete user from Supabase Auth" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Explicitly delete from profiles table as well (in case ON DELETE CASCADE is missing)
    await supabaseAdmin.from("profiles").delete().eq("id", targetUserId);

    return new Response(
      JSON.stringify({ success: true, message: "User account and profile deleted successfully", user_id: targetUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[delete-user Edge Function] Exception:", err);
    return new Response(
      JSON.stringify({ error: { message: err.message || "Internal server error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
