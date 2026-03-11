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
    let inviteData = null;
    const { data: inviteResult, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
      redirectTo: redirect_url || undefined,
    });

    if (inviteError) {
      // If user already exists, send them a password reset email instead
      if (inviteError.message.includes("already been registered")) {
        console.log("User already registered, sending password reset instead:", email);
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: {
            redirectTo: redirect_url || undefined,
          },
        });
        if (resetError) {
          console.error("Password reset link error:", resetError);
        }
      } else {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      inviteData = inviteResult;
    }

    // Check if team member already exists by email
    let memberData = null;
    const { data: existingMember } = await supabaseAdmin
      .from("team_members")
      .select()
      .eq("email", email)
      .maybeSingle();

    if (existingMember) {
      // Update existing record
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("team_members")
        .update({ name, role, phone: phone || '', crew_name: crew_name || null })
        .eq("id", existingMember.id)
        .select()
        .single();
      if (updateError) console.error("Team member update error:", updateError);
      memberData = updated || existingMember;
    } else {
      // Insert new record
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("team_members")
        .insert({ email, name, role, phone: phone || '', crew_name: crew_name || null })
        .select()
        .single();
      if (insertError) console.error("Team member insert error:", insertError);
      memberData = inserted;
    }

    // If project_id is provided, auto-assign the team member to the project
    if (project_id && memberData) {
      // Check if assignment already exists
      const { data: existingAssignment } = await supabaseAdmin
        .from("project_assignments")
        .select()
        .eq("project_id", project_id)
        .eq("team_member_id", memberData.id)
        .maybeSingle();

      if (!existingAssignment) {
        const { error: assignError } = await supabaseAdmin
          .from("project_assignments")
          .insert({ project_id, team_member_id: memberData.id });
        if (assignError) console.error("Project assignment error:", assignError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Invitation sent", user: inviteData?.user || null, team_member: memberData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
