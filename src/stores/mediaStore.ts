import { create } from 'zustand';
import type { Institution, MediaReport, MediaStatus, PerformanceScore } from '@/types';
import { supabase, STORAGE_BUCKETS, getSignedUrl } from '@/lib/supabase';

export interface RankedInstitution {
  institution: Institution;
  avgScore: number;
  evaluations: number;
  publishedReports: number;
}

interface MediaState {
  institutions: Institution[];
  mediaReports: MediaReport[];
  currentReport: MediaReport | null;
  scores: PerformanceScore[];
  isLoading: boolean;
  error: string | null;

  fetchInstitutions: () => Promise<void>;
  createInstitution: (institution: Partial<Institution>) => Promise<{ error: string | null }>;
  fetchMediaReports: (filters?: { institutionId?: string; status?: string; reporterId?: string }) => Promise<void>;
  fetchMediaReport: (id: string) => Promise<void>;
  createMediaReport: (report: Partial<MediaReport>) => Promise<{ id: string | null; error: string | null }>;
  updateMediaReport: (id: string, updates: Partial<MediaReport>) => Promise<{ error: string | null }>;
  reviewMediaReport: (id: string, status: MediaStatus, note?: string) => Promise<{ error: string | null }>;
  getMediaUrl: (report: MediaReport) => Promise<string | null>;
  recordView: (id: string) => Promise<void>;
  fetchScores: (institutionId: string) => Promise<void>;
  addScore: (score: Partial<PerformanceScore>) => Promise<{ error: string | null }>;
  getInstitutionRanking: () => Promise<RankedInstitution[]>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  institutions: [],
  mediaReports: [],
  currentReport: null,
  scores: [],
  isLoading: false,
  error: null,

  fetchInstitutions: async () => {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('name');

    if (error) {
      set({ error: error.message });
      return;
    }
    set({ institutions: (data ?? []) as Institution[] });
  },

  createInstitution: async (institution) => {
    const { error } = await supabase.from('institutions').insert(institution);
    if (error) return { error: error.message };
    await get().fetchInstitutions();
    return { error: null };
  },

  fetchMediaReports: async (filters) => {
    set({ isLoading: true, error: null });
    let query = supabase
      .from('media_reports')
      .select('*, institution:institutions(*), reporter:profiles!reporter_id(user_id, full_name, avatar_url, role)')
      .order('created_at', { ascending: false });

    if (filters?.institutionId) query = query.eq('institution_id', filters.institutionId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.reporterId) query = query.eq('reporter_id', filters.reporterId);

    const { data, error } = await query;
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ mediaReports: (data ?? []) as MediaReport[], isLoading: false });
  },

  fetchMediaReport: async (id) => {
    const { data, error } = await supabase
      .from('media_reports')
      .select('*, institution:institutions(*), reporter:profiles!reporter_id(user_id, full_name, avatar_url, role)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      set({ error: error.message });
      return;
    }
    set({ currentReport: (data as MediaReport) ?? null });
  },

  /**
   * Signs a media file for playback.
   *
   * The bucket is private and the row stores an object path. Reads are allowed
   * for the uploader, for admins, and for anyone once the report is published —
   * so the public archive works without the bucket being open to the world.
   */
  getMediaUrl: async (report) => {
    const { url } = await getSignedUrl(STORAGE_BUCKETS.MEDIA_REPORTS, report.file_url, 3600);
    return url;
  },

  /** View counting goes through an RPC; the column itself is not writable. */
  recordView: async (id) => {
    await supabase.rpc('increment_media_views', { p_report_id: id });
  },

  createMediaReport: async (report) => {
    // status is forced to 'pending_review' by a trigger — a reporter can no
    // longer file something already marked published.
    const { data, error } = await supabase
      .from('media_reports')
      .insert({
        institution_id: report.institution_id,
        reporter_id: report.reporter_id,
        title: report.title,
        description: report.description,
        media_type: report.media_type,
        file_url: report.file_url,
        thumbnail_url: report.thumbnail_url ?? null,
        gps_latitude: report.gps_latitude ?? null,
        gps_longitude: report.gps_longitude ?? null,
        tags: report.tags ?? [],
      })
      .select('id')
      .single();

    if (error) return { id: null, error: error.message };
    return { id: data.id, error: null };
  },

  /** Reporter-side edits. Only title, description and tags, only pre-review. */
  updateMediaReport: async (id, updates) => {
    const { error } = await supabase
      .from('media_reports')
      .update({
        title: updates.title,
        description: updates.description,
        tags: updates.tags,
      })
      .eq('id', id);

    if (error) return { error: error.message };
    await get().fetchMediaReport(id);
    return { error: null };
  },

  /**
   * Moderation decision.
   *
   * Publication used to be a plain UPDATE that the reporter themselves was
   * allowed to make, so unreviewed allegations about named police stations and
   * hospitals could go live without an admin ever seeing them. It is now an
   * admin-only RPC that also notifies the reporter and writes the audit entry.
   */
  reviewMediaReport: async (id, status, note) => {
    const { error } = await supabase.rpc('admin_review_media_report', {
      p_report_id: id,
      p_status: status,
      p_note: note ?? null,
    });

    if (error) return { error: error.message };
    set({
      mediaReports: get().mediaReports.map((r) => (r.id === id ? { ...r, status } : r)),
    });
    return { error: null };
  },

  fetchScores: async (institutionId) => {
    const { data, error } = await supabase
      .from('performance_scores')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ error: error.message });
      return;
    }
    set({ scores: (data ?? []) as PerformanceScore[] });
  },

  /**
   * Rates an institution.
   *
   * `overall_score` is a generated column now, so it is computed by the database
   * from the five metrics rather than sent by the client — a caller used to be
   * able to submit fives on a row of ones, or a score of 9999. There is also a
   * unique constraint on (institution, scorer), so a single account can no longer
   * stuff the ballot: a repeat submission updates their existing rating.
   */
  addScore: async (score) => {
    const { error } = await supabase.from('performance_scores').upsert(
      {
        institution_id: score.institution_id,
        scorer_id: score.scorer_id,
        punctuality: score.punctuality,
        professionalism: score.professionalism,
        cleanliness: score.cleanliness,
        integrity: score.integrity,
        service_delivery: score.service_delivery,
        comment: score.comment ?? null,
      },
      { onConflict: 'institution_id,scorer_id' }
    );

    if (error) return { error: error.message };
    if (score.institution_id) await get().fetchScores(score.institution_id);
    return { error: null };
  },

  /**
   * Institution league table.
   *
   * Aggregated in SQL rather than by pulling every score row into the browser
   * and grouping in JavaScript.
   */
  getInstitutionRanking: async () => {
    const { data, error } = await supabase.rpc('institution_rankings');
    if (error || !data) return [];

    return (data as Array<Record<string, unknown>>).map((r) => ({
      institution: {
        id: r.institution_id as string,
        name: r.name as string,
        type: r.type as Institution['type'],
        location: r.location as string,
        address: '',
        supervising_authority: '',
        created_at: '',
      } as Institution,
      avgScore: Number(r.avg_score ?? 0),
      evaluations: Number(r.evaluations ?? 0),
      publishedReports: Number(r.published_reports ?? 0),
    }));
  },
}));
