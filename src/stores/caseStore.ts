import { create } from 'zustand';
import type { Case, CaseStatus, CaseUrgency, Evidence } from '@/types';
import { supabase, STORAGE_BUCKETS, getSignedUrl, downloadAndVerify } from '@/lib/supabase';

interface CaseState {
  cases: Case[];
  currentCase: Case | null;
  evidence: Evidence[];
  isLoading: boolean;
  error: string | null;
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
  updateCaseStatus: (id: string, status: CaseStatus) => Promise<{ error: string | null }>;
  fetchEvidence: (caseId: string) => Promise<void>;
  addEvidence: (evidence: Partial<Evidence>) => Promise<{ error: string | null }>;
  getEvidenceUrl: (evidence: Evidence) => Promise<string | null>;
  downloadEvidence: (evidence: Evidence) => Promise<{
    blob: Blob | null;
    verified: boolean | null;
    error: string | null;
  }>;
  setFilters: (filters: CaseState['filters']) => void;
  clearError: () => void;
}

/** Descriptive fields a participant may edit directly. */
const EDITABLE_CASE_FIELDS = [
  'title',
  'description',
  'category',
  'urgency',
  'location',
  'latitude',
  'longitude',
] as const;

function pickEditable(updates: Partial<Case>): Partial<Case> {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_CASE_FIELDS) {
    if (key in updates && updates[key] !== undefined) out[key] = updates[key];
  }
  return out as Partial<Case>;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  currentCase: null,
  evidence: [],
  isLoading: false,
  error: null,
  filters: {},

  clearError: () => set({ error: null }),

  fetchCases: async (userId, role) => {
    set({ isLoading: true, error: null });

    // The embedded profile joins resolve for non-admins now: migration 004 lets
    // case participants read each other's profile. Before that, every one of
    // these came back null and case cards rendered blank.
    let query = supabase
      .from('cases')
      .select(
        '*, complainant:profiles!complainant_id(user_id, full_name, email, phone, avatar_url, role), investigator:profiles!assigned_investigator_id(user_id, full_name, email, avatar_url, role)'
      )
      .order('created_at', { ascending: false });

    if (userId && role === 'complainant') {
      query = query.eq('complainant_id', userId);
    } else if (userId && role === 'investigator') {
      query = query.eq('assigned_investigator_id', userId);
    } else if (userId && role === 'lawyer') {
      query = query.eq('assigned_lawyer_id', userId);
    } else if (userId && role === 'medical_expert') {
      query = query.eq('assigned_expert_id', userId);
    }

    const { status, search, category, urgency } = get().filters;
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (urgency) query = query.eq('urgency', urgency);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;

    if (error) {
      // Surface failures instead of leaving stale data with no explanation.
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ cases: (data ?? []) as Case[], isLoading: false });
  },

  fetchCase: async (id) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from('cases')
      .select(
        '*, complainant:profiles!complainant_id(user_id, full_name, email, phone, avatar_url, role), investigator:profiles!assigned_investigator_id(user_id, full_name, email, avatar_url, role)'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ currentCase: (data as Case) ?? null, isLoading: false });
  },

  createCase: async (caseData) => {
    // status and assignments are pinned server-side on insert, so there is no
    // point sending them.
    const { data, error } = await supabase
      .from('cases')
      .insert({
        title: caseData.title,
        description: caseData.description,
        category: caseData.category,
        urgency: caseData.urgency,
        location: caseData.location,
        latitude: caseData.latitude ?? null,
        longitude: caseData.longitude ?? null,
        complainant_id: caseData.complainant_id,
      })
      .select('id')
      .single();

    if (error) return { id: null, error: error.message };
    return { id: data.id, error: null };
  },

  updateCase: async (id, updates) => {
    const safe = pickEditable(updates);

    // A status change has to go through the state machine.
    if (updates.status) {
      const { error } = await get().updateCaseStatus(id, updates.status);
      if (error) return { error };
    }

    if (Object.keys(safe).length === 0) return { error: null };

    const { data, error } = await supabase
      .from('cases')
      .update(safe)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) return { error: error.message };

    const currentCase = get().currentCase;
    if (currentCase?.id === id && data) {
      set({ currentCase: { ...currentCase, ...(data as Case) } });
    }
    return { error: null };
  },

  /**
   * Moves a case through its lifecycle.
   *
   * Handled by an RPC that enforces which transitions each role may make — an
   * investigator can advance their own stage, a complainant can withdraw, only
   * an admin can go anywhere. Direct writes to `cases.status` are reverted by a
   * trigger and logged, because previously any participant (including the
   * complainant) could set any status and write themselves into the assignment
   * slots.
   *
   * The RPC also raises the notification and the audit entry, so those no longer
   * depend on the client remembering to.
   */
  updateCaseStatus: async (id, status) => {
    const { error } = await supabase.rpc('update_case_status', {
      p_case_id: id,
      p_status: status,
    });

    if (error) return { error: error.message };

    const currentCase = get().currentCase;
    if (currentCase?.id === id) {
      set({ currentCase: { ...currentCase, status } });
    }
    set({
      cases: get().cases.map((c) => (c.id === id ? { ...c, status } : c)),
    });
    return { error: null };
  },

  fetchEvidence: async (caseId) => {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ error: error.message });
      return;
    }
    set({ evidence: (data ?? []) as Evidence[] });
  },

  addEvidence: async (evidence) => {
    // chain_of_custody is written by a database trigger from the authenticated
    // identity, so the client cannot author its own provenance.
    const { error } = await supabase.from('evidence').insert({
      case_id: evidence.case_id,
      file_url: evidence.file_url,
      file_name: evidence.file_name,
      file_type: evidence.file_type,
      file_size: evidence.file_size,
      file_hash: evidence.file_hash,
      description: evidence.description ?? null,
      uploaded_by: evidence.uploaded_by,
    });

    if (error) return { error: error.message };
    if (evidence.case_id) await get().fetchEvidence(evidence.case_id);
    return { error: null };
  },

  /**
   * Signs an evidence file for viewing and records the access.
   *
   * Evidence lives in a private bucket. The old code stored a public URL that
   * never resolved, so evidence was unreadable by everyone including admins.
   */
  getEvidenceUrl: async (evidence) => {
    const { url } = await getSignedUrl(STORAGE_BUCKETS.EVIDENCE, evidence.file_url, 600);
    if (url) {
      void supabase.rpc('append_custody_entry', {
        p_evidence_id: evidence.id,
        p_action: 'viewed',
        p_notes: null,
      });
    }
    return url;
  },

  /**
   * Downloads evidence and re-checks its SHA-256 against what was recorded.
   *
   * A stored hash nobody verifies proves nothing — this is what makes the
   * integrity claim real.
   */
  downloadEvidence: async (evidence) => {
    const result = await downloadAndVerify(
      STORAGE_BUCKETS.EVIDENCE,
      evidence.file_url,
      evidence.file_hash
    );

    if (!result.error) {
      void supabase.rpc('append_custody_entry', {
        p_evidence_id: evidence.id,
        p_action: 'downloaded',
        p_notes:
          result.verified === false
            ? 'INTEGRITY WARNING: file hash does not match the recorded value'
            : 'Hash verified against the recorded value',
      });
    }
    return result;
  },

  setFilters: (filters) => set({ filters }),
}));
