import { create } from 'zustand';
import type { Case, CaseStatus, CaseUrgency, Evidence } from '@/types';
import { supabase } from '@/lib/supabase';
import { sendTemplatedEmail } from '@/lib/email';
import { CASE_STATUS_LABELS } from '@/types';

interface CaseState {
  cases: Case[];
  currentCase: Case | null;
  evidence: Evidence[];
  isLoading: boolean;
  filters: {
    status?: CaseStatus;
    category?: string;
    urgency?: CaseUrgency;
    search?: string;
  };

  fetchCases: (userId?: string, role?: string) => Promise<void>;
  fetchCase: (id: string) => Promise<void>;
  createCase: (caseData: Partial<Case>) => Promise<{ id: string | null; error: string | null }>;
  updateCase: (id: string, updates: Partial<Case>) => Promise<{ error: string | null }>;
  fetchEvidence: (caseId: string) => Promise<void>;
  addEvidence: (evidence: Partial<Evidence>) => Promise<{ error: string | null }>;
  setFilters: (filters: CaseState['filters']) => void;
  assignInvestigator: (caseId: string, investigatorId: string) => Promise<{ error: string | null }>;
}

/** Create an in-app notification for a user */
async function createNotification(payload: {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  link?: string;
}) {
  await supabase.from('notifications').insert({
    user_id: payload.userId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    read: false,
    link: payload.link,
    created_at: new Date().toISOString(),
  });
}

/** Look up a user's email from their profile */
async function getUserEmail(userId: string): Promise<{ email: string; full_name: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  currentCase: null,
  evidence: [],
  isLoading: false,
  filters: {},

  fetchCases: async (userId, role) => {
    set({ isLoading: true });
    let query = supabase
      .from('cases')
      .select('*, complainant:profiles!complainant_id(*), investigator:profiles!assigned_investigator_id(*)')
      .order('created_at', { ascending: false });

    if (userId && role === 'complainant') {
      query = query.eq('complainant_id', userId);
    } else if (userId && role === 'investigator') {
      query = query.eq('assigned_investigator_id', userId);
    } else if (userId && role === 'lawyer') {
      query = query.eq('assigned_lawyer_id', userId);
    }

    const { status, search, category, urgency } = get().filters;
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (urgency) query = query.eq('urgency', urgency);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (!error && data) set({ cases: data as Case[] });
    set({ isLoading: false });
  },

  fetchCase: async (id) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('cases')
      .select('*, complainant:profiles!complainant_id(*), investigator:profiles!assigned_investigator_id(*)')
      .eq('id', id)
      .single();

    if (!error && data) set({ currentCase: data as Case });
    set({ isLoading: false });
  },

  createCase: async (caseData) => {
    const { data, error } = await supabase
      .from('cases')
      .insert(caseData)
      .select()
      .single();

    if (error) return { id: null, error: error.message };
    return { id: data.id, error: null };
  },

  updateCase: async (id, updates) => {
    const { error } = await supabase
      .from('cases')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { error: error.message };

    const currentCase = get().currentCase;
    if (currentCase?.id === id) {
      set({ currentCase: { ...currentCase, ...updates } });
    }

    // Fire notification + email if status changed
    if (updates.status) {
      const caseTitle = currentCase?.title ?? 'Your case';
      const statusLabel = CASE_STATUS_LABELS[updates.status] ?? updates.status;
      const complainantId = currentCase?.complainant_id;

      if (complainantId) {
        // Notify complainant about status change
        createNotification({
          userId: complainantId,
          title: 'Case Status Updated',
          message: `"${caseTitle}" status changed to: ${statusLabel}.`,
          type: 'info',
          link: `/app/cases/${id}`,
        });

        // Email complainant (non-blocking)
        getUserEmail(complainantId).then((profile) => {
          if (profile) {
            sendTemplatedEmail(profile.email, 'case_status_update', {
              recipientName: profile.full_name,
              caseTitle,
              caseId: id,
              status: statusLabel,
              actionUrl: `${window.location.origin}/app/cases/${id}`,
            }).catch(() => {/* ignore */});
          }
        });
      }
    }

    return { error: null };
  },

  fetchEvidence: async (caseId) => {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (!error && data) set({ evidence: data as Evidence[] });
  },

  addEvidence: async (evidence) => {
    const { error } = await supabase.from('evidence').insert(evidence);
    if (error) return { error: error.message };
    if (evidence.case_id) await get().fetchEvidence(evidence.case_id);
    return { error: null };
  },

  setFilters: (filters) => set({ filters }),

  assignInvestigator: async (caseId, investigatorId) => {
    // Fetch the case to get its title + complainant before updating
    const { data: caseData } = await supabase
      .from('cases')
      .select('title, complainant_id')
      .eq('id', caseId)
      .maybeSingle();

    const { error } = await supabase
      .from('cases')
      .update({
        assigned_investigator_id: investigatorId,
        status: 'assigned' as CaseStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId);

    if (error) return { error: error.message };

    const caseTitle = caseData?.title ?? 'A case';
    const complainantId = caseData?.complainant_id;

    // 1. Notify investigator
    createNotification({
      userId: investigatorId,
      title: 'New Case Assigned',
      message: `You have been assigned to: "${caseTitle}". Please review and begin your investigation.`,
      type: 'success',
      link: `/app/cases/${caseId}`,
    });

    // 2. Notify complainant
    if (complainantId) {
      createNotification({
        userId: complainantId,
        title: 'Investigator Assigned',
        message: `An investigator has been assigned to your case: "${caseTitle}".`,
        type: 'success',
        link: `/app/cases/${caseId}`,
      });
    }

    // 3. Send emails (non-blocking)
    const dashboardUrl = `${window.location.origin}/app/cases/${caseId}`;

    getUserEmail(investigatorId).then((profile) => {
      if (profile) {
        sendTemplatedEmail(profile.email, 'investigator_matched', {
          recipientName: profile.full_name,
          caseTitle,
          caseId,
          actionUrl: dashboardUrl,
        }).catch(() => {});
      }
    });

    if (complainantId) {
      getUserEmail(complainantId).then((profile) => {
        if (profile) {
          sendTemplatedEmail(profile.email, 'case_status_update', {
            recipientName: profile.full_name,
            caseTitle,
            caseId,
            status: 'Assigned — Investigator is on the case',
            actionUrl: dashboardUrl,
          }).catch(() => {});
        }
      });
    }

    await get().fetchCase(caseId);
    return { error: null };
  },
}));
