import { create } from 'zustand';
import type { Case, CaseStatus, CaseUrgency, Evidence } from '@/types';
import { supabase } from '@/lib/supabase';

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
    const { error } = await supabase
      .from('cases')
      .update({
        assigned_investigator_id: investigatorId,
        status: 'assigned' as CaseStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId);

    if (error) return { error: error.message };
    await get().fetchCase(caseId);
    return { error: null };
  },
}));
