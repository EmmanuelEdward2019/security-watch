import { supabase } from '@/lib/supabase';

/** Matches `TransactionalTemplateId` in Edge Function */
export type EmailTemplateId =
  | 'payment_received'
  | 'payment_failed'
  | 'case_assigned'
  | 'case_status_update'
  | 'new_message'
  | 'verification_submitted'
  | 'verification_approved'
  | 'verification_rejected'
  | 'security_service_request_received'
  | 'security_service_request_admin'
  | 'investigator_matched'
  | 'report_ready'
  | 'institution_report_published'
  | 'generic_notification';

export interface EmailTemplateData {
  recipientName?: string;
  amount?: string;
  currency?: string;
  reference?: string;
  caseTitle?: string;
  caseId?: string;
  status?: string;
  messagePreview?: string;
  conversationId?: string;
  serviceType?: string;
  companyName?: string;
  dashboardUrl?: string;
  actionUrl?: string;
  extraNote?: string;
}

/**
 * Send a branded transactional email via the `send-notification-email` Edge Function (Resend).
 */
export async function sendTemplatedEmail(
  to: string,
  template: EmailTemplateId,
  data?: EmailTemplateData
) {
  const { data: res, error } = await supabase.functions.invoke('send-notification-email', {
    body: { to, template, data: data ?? {} },
  });
  if (error) throw new Error(error.message);
  return res as { success?: boolean; id?: string; error?: string };
}

/**
 * Send raw HTML (legacy). Prefer `sendTemplatedEmail` for consistent branding.
 */
export async function sendRawEmail(to: string, subject: string, html: string) {
  const { data: res, error } = await supabase.functions.invoke('send-notification-email', {
    body: { to, subject, html },
  });
  if (error) throw new Error(error.message);
  return res as { success?: boolean; id?: string; error?: string };
}
