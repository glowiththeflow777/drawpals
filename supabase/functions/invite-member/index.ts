import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, name, role, phone, crew_name, project_id, redirect_url } = await req.json();

    if (!email || !name || !role) {
      return new Response(JSON.stringify({ error: "email, name, and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invite the user via Supabase Auth — redirect to the reset-password page so they can set up their password
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
      redirectTo: redirect_url || undefined,
    });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also create/update the team_members record
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("team_members")
      .upsert({
        email,
        name,
        role,
        phone: phone || '',
        crew_name: crew_name || null,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (memberError) {
      console.error("Team member upsert error:", memberError);
    }

    // If project_id is provided, auto-assign the team member to the project
    if (project_id && memberData) {
      const { error: assignError } = await supabaseAdmin
        .from("project_assignments")
        .upsert({
          project_id,
          team_member_id: memberData.id,
        }, { onConflict: 'project_id,team_member_id' })
        .select();

      if (assignError) {
        console.error("Project assignment error:", assignError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Invitation sent", user: inviteData.user, team_member: memberData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
