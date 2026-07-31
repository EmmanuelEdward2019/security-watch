import { supabase } from '@/lib/supabase';

/** Matches `TransactionalTemplateId` in the send-notification-email function. */
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
 * Sends a branded transactional email.
 *
 * Recipients are addressed by user id, never by email address. The function
 * resolves the address server-side and refuses to mail anyone the caller does
 * not share a case, conversation or property enquiry with — which is what stops
 * the endpoint being usable as a general mailer. Passing a raw address is an
 * admin-only capability and is not exposed here.
 *
 * Delivery is best-effort by design: a failed notification email must never
 * fail the action that triggered it.
 */
export async function sendTemplatedEmail(
  recipientUserId: string,
  template: EmailTemplateId,
  data?: EmailTemplateData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: res, error } = await supabase.functions.invoke('send-notification-email', {
      body: { recipientUserId, template, data: data ?? {} },
    });

    if (error) {
      console.warn(`[email] ${template} to ${recipientUserId} failed:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: (res as { success?: boolean })?.success ?? true };
  } catch (e) {
    console.warn(`[email] ${template} threw:`, (e as Error).message);
    return { success: false, error: (e as Error).message };
  }
}

/** Fire-and-forget wrapper for notification paths that must not block. */
export function notifyByEmail(
  recipientUserId: string,
  template: EmailTemplateId,
  data?: EmailTemplateData
): void {
  void sendTemplatedEmail(recipientUserId, template, data);
}
