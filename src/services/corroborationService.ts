import { supabase } from '@/lib/supabase';

/**
 * Independent reports of the same thing.
 *
 * A single account, however detailed, is one person's word. Two strangers who
 * do not know each other reporting the same incident in the same place within
 * the same hours is a different class of evidence — and it is the one property
 * a lone report can never acquire, no matter how good its photographs are.
 *
 * TWO SHAPES, AND THE DIFFERENCE IS THE POINT. `fetchCaseCorroboration` is for
 * a case participant and returns nothing but counts, distances and times. It
 * must never carry another complainant's title, name or case id: in a land
 * dispute or a domestic matter, telling one party that a neighbour also filed
 * identifies the neighbour. `fetchCorroborationClusters` is for administrators,
 * who can already read every case, and returns the cluster itself — because
 * acting on one means knowing which cases are in it.
 *
 * Both exclude reports from the same complainant. Without that rule the feature
 * is a machine for manufacturing credibility by filing five times.
 */

export interface CaseCorroboration {
  /** Independent reports in the same category, nearby, in the same window. */
  directMatches: number;
  /** Same family of category — a robbery alongside an assault, say. */
  relatedMatches: number;
  nearestKm: number | null;
  firstReportAt: string | null;
  lastReportAt: string | null;
  radiusKm: number;
  windowHours: number;
  /** False when the case has no coordinates, so nothing could be compared. */
  hasCoordinates: boolean;
}

export interface CorroborationCluster {
  caseId: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
  corroborations: number;
  /** The number that matters — ten reports from two people is a dispute. */
  distinctReporters: number;
  nearestKm: number | null;
}

export async function fetchCaseCorroboration(
  caseId: string,
  radiusKm = 2,
  windowHours = 24
): Promise<{ corroboration: CaseCorroboration | null; error: string | null }> {
  const { data, error } = await supabase.rpc('case_corroboration', {
    p_case_id: caseId,
    p_radius_km: radiusKm,
    p_window_hours: windowHours,
  });

  if (error) return { corroboration: null, error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { corroboration: null, error: null };

  return {
    corroboration: {
      directMatches: row.direct_matches ?? 0,
      relatedMatches: row.related_matches ?? 0,
      nearestKm: row.nearest_km ?? null,
      firstReportAt: row.first_report_at ?? null,
      lastReportAt: row.last_report_at ?? null,
      radiusKm: row.radius_km ?? radiusKm,
      windowHours: row.window_hours ?? windowHours,
      hasCoordinates: Boolean(row.has_coordinates),
    },
    error: null,
  };
}

interface RawCluster {
  case_id: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  occurred_at: string;
  corroborations: number;
  distinct_reporters: number;
  nearest_km: number | null;
}

export async function fetchCorroborationClusters(options?: {
  days?: number;
  radiusKm?: number;
  windowHours?: number;
  limit?: number;
}): Promise<{ clusters: CorroborationCluster[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_corroboration_clusters', {
    p_days: options?.days ?? 30,
    p_radius_km: options?.radiusKm ?? 2,
    p_window_hours: options?.windowHours ?? 24,
    p_limit: options?.limit ?? 50,
  });

  if (error) return { clusters: [], error: error.message };

  return {
    clusters: ((data ?? []) as RawCluster[]).map((r) => ({
      caseId: r.case_id,
      title: r.title,
      category: r.category,
      urgency: r.urgency,
      status: r.status,
      location: r.location ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      occurredAt: r.occurred_at,
      corroborations: r.corroborations ?? 0,
      distinctReporters: r.distinct_reporters ?? 0,
      nearestKm: r.nearest_km ?? null,
    })),
    error: null,
  };
}

/**
 * How much weight the corroboration carries, in one word.
 *
 * Deliberately conservative. A single nearby report is "possible", not
 * "confirmed" — overstating this on a screen a complainant reads would set an
 * expectation the case cannot meet, and overstating it on a screen an
 * investigator reads is worse.
 */
export function corroborationStrength(
  c: CaseCorroboration
): 'none' | 'possible' | 'corroborated' | 'strong' {
  const total = c.directMatches + c.relatedMatches;
  if (total === 0) return 'none';
  if (c.directMatches >= 3) return 'strong';
  if (c.directMatches >= 1) return 'corroborated';
  return 'possible';
}
