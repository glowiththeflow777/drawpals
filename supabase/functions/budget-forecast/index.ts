import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Get user role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = profile?.role || "subcontractor";

    // Fetch projects (RLS filters automatically)
    const { data: projects = [] } = await supabase.from("projects").select("*");

    // Fetch recent invoices for trend analysis
    const { data: invoices = [] } = await supabase
      .from("invoices")
      .select("id, project_id, grand_total, status, created_at, subcontractor_name")
      .order("created_at", { ascending: false })
      .limit(200);

    // Build financial summary for AI
    const projectSummaries = projects.map((p: any) => {
      const projInvoices = invoices.filter((i: any) => i.project_id === p.id);
      const approvedTotal = projInvoices
        .filter((i: any) => i.status === "approved")
        .reduce((s: number, i: any) => s + Number(i.grand_total), 0);
      const pendingTotal = projInvoices
        .filter((i: any) => i.status === "submitted" || i.status === "pending")
        .reduce((s: number, i: any) => s + Number(i.grand_total), 0);
      const invoiceCount = projInvoices.length;
      const budget = Number(p.total_budget);
      const remaining = budget - Number(p.amount_invoiced);
      const percentUsed = budget > 0 ? ((Number(p.amount_invoiced) / budget) * 100).toFixed(1) : "0";

      return {
        name: p.name,
        status: p.status,
        totalBudget: budget,
        amountInvoiced: Number(p.amount_invoiced),
        amountPaid: Number(p.amount_paid),
        remaining,
        percentUsed,
        pendingInvoices: pendingTotal,
        invoiceCount,
        savings: Math.max(0, budget - Number(p.amount_paid)),
      };
    });

    const totalBudget = projectSummaries.reduce((s: number, p: any) => s + p.totalBudget, 0);
    const totalPaid = projectSummaries.reduce((s: number, p: any) => s + p.amountPaid, 0);
    const totalSavings = Math.max(0, totalBudget - totalPaid);
    const pmBonus = totalSavings * 0.3;

    const prompt = `You are a construction project financial analyst AI. Analyze this data and return a JSON response.

PROJECT DATA:
${JSON.stringify(projectSummaries, null, 2)}

ROLE: ${role} (${role === "admin" ? "sees all projects" : role === "project-manager" ? "sees assigned projects, earns 30% bonus on savings" : "subcontractor"})

CURRENT TOTALS:
- Total Budget: $${totalBudget.toLocaleString()}
- Total Paid: $${totalPaid.toLocaleString()}
- Total Savings: $${totalSavings.toLocaleString()}
- PM Bonus (30% of savings): $${pmBonus.toLocaleString()}

Return ONLY valid JSON with this exact structure:
{
  "forecast": {
    "estimatedCostAtCompletion": <number>,
    "confidenceLevel": "<high|medium|low>",
    "projectedSavings": <number>,
    "cashFlowNext30Days": <number>,
    "cashFlowNext60Days": <number>,
    "cashFlowNext90Days": <number>,
    "summary": "<2-3 sentence forecast summary>"
  },
  "alerts": [
    {
      "type": "<budget_warning|overrun_risk|low_remaining|bonus_update|spending_velocity>",
      "severity": "<critical|warning|info>",
      "project": "<project name or 'Portfolio'>",
      "message": "<concise alert message>",
      "metric": "<relevant number as string>"
    }
  ],
  "bonusProjection": {
    "currentSavings": <number>,
    "projectedSavings": <number>,
    "currentBonus": <number>,
    "projectedBonus": <number>,
    "trend": "<up|down|stable>",
    "insight": "<1 sentence about bonus trajectory>"
  }
}

Include 3-6 alerts. Always include at least one bonus_update alert for PMs/admins. Flag any project over 75% budget consumed. Flag low remaining budgets under $10,000.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a financial forecasting AI for construction projects. Return only valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (strip markdown fences if present)
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI JSON:", jsonStr);
      // Return fallback
      parsed = {
        forecast: {
          estimatedCostAtCompletion: totalPaid,
          confidenceLevel: "low",
          projectedSavings: totalSavings,
          cashFlowNext30Days: 0,
          cashFlowNext60Days: 0,
          cashFlowNext90Days: 0,
          summary: "Unable to generate detailed forecast. Review project data for accuracy.",
        },
        alerts: projectSummaries
          .filter((p: any) => parseFloat(p.percentUsed) > 75)
          .map((p: any) => ({
            type: "budget_warning",
            severity: parseFloat(p.percentUsed) > 90 ? "critical" : "warning",
            project: p.name,
            message: `${p.percentUsed}% of budget consumed. $${p.remaining.toLocaleString()} remaining.`,
            metric: `${p.percentUsed}%`,
          })),
        bonusProjection: {
          currentSavings: totalSavings,
          projectedSavings: totalSavings,
          currentBonus: pmBonus,
          projectedBonus: pmBonus,
          trend: "stable",
          insight: "Bonus projection based on current spending patterns.",
        },
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("budget-forecast error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
