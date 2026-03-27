import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Investigator {
  id: string;
  user_id: string;
  specialization: string[];
  experience_years: number;
  service_area: string;
  rating: number;
  total_cases: number;
  verification_status: string;
}

interface CaseData {
  category: string;
  location: string;
  urgency: string;
}

function calculateMatchScore(investigator: Investigator, caseData: CaseData): number {
  let score = 0;

  // Specialization match (0-30 points)
  const categoryMap: Record<string, string[]> = {
    fraud: ['fraud', 'financial_crimes', 'cybercrime'],
    robbery: ['robbery', 'theft', 'property_crime'],
    murder: ['homicide', 'violent_crime'],
    assault: ['assault', 'violent_crime'],
    domestic_dispute: ['domestic', 'family_law', 'mediation'],
    land_dispute: ['property', 'land', 'real_estate'],
    cybercrime: ['cybercrime', 'digital_forensics', 'fraud'],
    corruption: ['corruption', 'public_sector', 'whistleblower'],
    kidnapping: ['kidnapping', 'missing_persons', 'violent_crime'],
    missing_person: ['missing_persons', 'search_rescue'],
  };

  const relevantSpecs = categoryMap[caseData.category] || [];
  const matchingSpecs = investigator.specialization.filter((s) =>
    relevantSpecs.some((rs) => s.toLowerCase().includes(rs))
  );
  score += Math.min(matchingSpecs.length * 10, 30);

  // Location proximity (0-25 points)
  if (investigator.service_area?.toLowerCase().includes(caseData.location?.toLowerCase() || '')) {
    score += 25;
  } else if (investigator.service_area && caseData.location) {
    const areaWords = investigator.service_area.toLowerCase().split(/[\s,]+/);
    const locWords = caseData.location.toLowerCase().split(/[\s,]+/);
    const overlap = areaWords.filter((w) => locWords.includes(w));
    score += Math.min(overlap.length * 8, 20);
  }

  // Experience (0-20 points)
  score += Math.min(investigator.experience_years * 2, 20);

  // Rating (0-15 points)
  score += (investigator.rating / 5) * 15;

  // Availability - fewer active cases = more available (0-10 points)
  const availabilityScore = Math.max(0, 10 - investigator.total_cases);
  score += availabilityScore;

  // Urgency bonus for highly rated agents
  if (caseData.urgency === 'critical' && investigator.rating >= 4) {
    score += 10;
  } else if (caseData.urgency === 'high' && investigator.rating >= 3.5) {
    score += 5;
  }

  return Math.round(score * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { case_id } = await req.json();
    if (!case_id) {
      return new Response(JSON.stringify({ error: 'case_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', case_id)
      .single();

    if (caseError || !caseData) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: investigators, error: invError } = await supabase
      .from('investigators')
      .select('*')
      .eq('verification_status', 'approved');

    if (invError || !investigators?.length) {
      return new Response(JSON.stringify({ error: 'No verified investigators available' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scored = investigators
      .map((inv: Investigator) => ({
        ...inv,
        match_score: calculateMatchScore(inv, caseData as CaseData),
      }))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5);

    // Auto-assign the top match if score is above threshold
    const topMatch = scored[0];
    let autoAssigned = false;

    if (topMatch.match_score >= 50 && caseData.status === 'submitted') {
      const { error: assignError } = await supabase
        .from('cases')
        .update({
          assigned_investigator_id: topMatch.user_id,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', case_id);

      if (!assignError) {
        autoAssigned = true;

        await supabase.from('notifications').insert({
          user_id: topMatch.user_id,
          title: 'New Case Assignment',
          message: `You have been assigned to case: ${caseData.title}`,
          type: 'success',
          link: `/cases/${case_id}`,
        });

        await supabase.from('audit_logs').insert({
          user_id: topMatch.user_id,
          action: 'case_auto_assigned',
          resource_type: 'case',
          resource_id: case_id,
          details: { match_score: topMatch.match_score },
        });
      }
    }

    return new Response(
      JSON.stringify({
        matches: scored,
        auto_assigned: autoAssigned,
        assigned_to: autoAssigned ? topMatch.user_id : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
