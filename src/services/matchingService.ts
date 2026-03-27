import { supabase } from '@/lib/supabase';

export async function matchInvestigator(caseId: string) {
  const { data, error } = await supabase.functions.invoke('match-investigator', {
    body: { case_id: caseId },
  });

  if (error) throw new Error(error.message);
  return data as {
    matches: Array<{
      id: string;
      user_id: string;
      specialization: string[];
      experience_years: number;
      service_area: string;
      rating: number;
      match_score: number;
    }>;
    auto_assigned: boolean;
    assigned_to: string | null;
  };
}

export async function generateInstitutionReport(institutionId: string, reportType = 'summary') {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { institution_id: institutionId, report_type: reportType },
  });

  if (error) throw new Error(error.message);
  return data as { report: Record<string, unknown>; html: string };
}

export async function sendNotificationEmail(to: string, subject: string, html: string) {
  const { data, error } = await supabase.functions.invoke('send-notification-email', {
    body: { to, subject, html },
  });

  if (error) throw new Error(error.message);
  return data;
}
