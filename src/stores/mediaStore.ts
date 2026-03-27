import { create } from 'zustand';
import type { Institution, MediaReport, PerformanceScore } from '@/types';
import { supabase } from '@/lib/supabase';

interface MediaState {
  institutions: Institution[];
  mediaReports: MediaReport[];
  currentReport: MediaReport | null;
  scores: PerformanceScore[];
  isLoading: boolean;

  fetchInstitutions: () => Promise<void>;
  createInstitution: (institution: Partial<Institution>) => Promise<{ error: string | null }>;
  fetchMediaReports: (filters?: { institutionId?: string; status?: string; reporterId?: string }) => Promise<void>;
  fetchMediaReport: (id: string) => Promise<void>;
  createMediaReport: (report: Partial<MediaReport>) => Promise<{ id: string | null; error: string | null }>;
  updateMediaReport: (id: string, updates: Partial<MediaReport>) => Promise<{ error: string | null }>;
  fetchScores: (institutionId: string) => Promise<void>;
  addScore: (score: Partial<PerformanceScore>) => Promise<{ error: string | null }>;
  getInstitutionRanking: () => Promise<{ institution: Institution; avgScore: number }[]>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  institutions: [],
  mediaReports: [],
  currentReport: null,
  scores: [],
  isLoading: false,

  fetchInstitutions: async () => {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('name');

    if (!error && data) set({ institutions: data as Institution[] });
  },

  createInstitution: async (institution) => {
    const { error } = await supabase.from('institutions').insert(institution);
    if (error) return { error: error.message };
    await get().fetchInstitutions();
    return { error: null };
  },

  fetchMediaReports: async (filters) => {
    set({ isLoading: true });
    let query = supabase
      .from('media_reports')
      .select('*, institution:institutions(*), reporter:profiles!reporter_id(*)')
      .order('created_at', { ascending: false });

    if (filters?.institutionId) query = query.eq('institution_id', filters.institutionId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.reporterId) query = query.eq('reporter_id', filters.reporterId);

    const { data, error } = await query;
    if (!error && data) set({ mediaReports: data as MediaReport[] });
    set({ isLoading: false });
  },

  fetchMediaReport: async (id) => {
    const { data, error } = await supabase
      .from('media_reports')
      .select('*, institution:institutions(*), reporter:profiles!reporter_id(*)')
      .eq('id', id)
      .single();

    if (!error && data) set({ currentReport: data as MediaReport });
  },

  createMediaReport: async (report) => {
    const { data, error } = await supabase
      .from('media_reports')
      .insert(report)
      .select()
      .single();

    if (error) return { id: null, error: error.message };
    return { id: data.id, error: null };
  },

  updateMediaReport: async (id, updates) => {
    const { error } = await supabase
      .from('media_reports')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  },

  fetchScores: async (institutionId) => {
    const { data, error } = await supabase
      .from('performance_scores')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (!error && data) set({ scores: data as PerformanceScore[] });
  },

  addScore: async (score) => {
    const overall =
      ((score.punctuality || 0) +
        (score.professionalism || 0) +
        (score.cleanliness || 0) +
        (score.integrity || 0) +
        (score.service_delivery || 0)) /
      5;

    const { error } = await supabase
      .from('performance_scores')
      .insert({ ...score, overall_score: overall });

    if (error) return { error: error.message };
    return { error: null };
  },

  getInstitutionRanking: async () => {
    const { data, error } = await supabase
      .from('performance_scores')
      .select('institution_id, overall_score, institutions(*)');

    if (error || !data) return [];

    const grouped: Record<string, { institution: Institution; scores: number[] }> = {};
    for (const row of data as Record<string, unknown>[]) {
      const instId = row.institution_id as string;
      if (!grouped[instId]) {
        grouped[instId] = {
          institution: row.institutions as Institution,
          scores: [],
        };
      }
      grouped[instId].scores.push(row.overall_score as number);
    }

    return Object.values(grouped)
      .map(({ institution, scores }) => ({
        institution,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  },
}));
