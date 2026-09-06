import { useCallback, useEffect, useState } from 'react';
import { Users, MapPin, Clock, Info } from 'lucide-react';
import { Card, CardHeader, CardContent, Spinner, Badge } from '@/components/ui';
import {
  fetchCaseCorroboration,
  corroborationStrength,
  type CaseCorroboration,
} from '@/services/corroborationService';

/**
 * Whether anyone else reported the same thing.
 *
 * WHAT THIS SHOWS AND WHY IT SHOWS SO LITTLE. Counts, a distance and a time
 * window. Never a title, a name, a case id or anything that could be resolved
 * back to a person. In a land dispute or a domestic matter, telling one party
 * that a neighbour also filed identifies the neighbour — and the people on the
 * other side of these cases are often known to each other.
 *
 * The wording is deliberately conservative. One nearby report is "possible",
 * not "confirmed". A complainant reading this is deciding whether to keep
 * going, and an investigator reading it is deciding where to spend a day;
 * overstating what a proximity match means costs both of them.
 */

const STRENGTH: Record<
  ReturnType<typeof corroborationStrength>,
  { label: string; tone: 'success' | 'warning' | 'default'; blurb: string }
> = {
  none: {
    label: 'No matching reports',
    tone: 'default',
    blurb:
      'Nobody else has reported something similar nearby in this time window. That does not weaken this case — most incidents are only ever reported once.',
  },
  possible: {
    label: 'Possibly related',
    tone: 'warning',
    blurb:
      'Someone else independently reported a related kind of incident nearby, around the same time. It may or may not be the same event.',
  },
  corroborated: {
    label: 'Independently corroborated',
    tone: 'success',
    blurb:
      'At least one other person, with no connection to this case, reported the same kind of incident in the same place and time window.',
  },
  strong: {
    label: 'Strongly corroborated',
    tone: 'success',
    blurb:
      'Several people independently reported the same kind of incident here, around the same time. Independent accounts carry weight that a single report cannot.',
  },
};

export interface CorroborationPanelProps {
  caseId: string;
}

export function CorroborationPanel({ caseId }: CorroborationPanelProps) {
  const [data, setData] = useState<CaseCorroboration | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { corroboration } = await fetchCaseCorroboration(caseId);
    setData(corroboration);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // No coordinates means nothing could be compared. Saying so is important:
  // a bare zero here reads as "nobody else reported it", which is a different
  // and much more discouraging claim than "we could not check".
  if (!data.hasCoordinates) {
    return (
      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 font-semibold text-surface-900">
            <Users size={18} className="text-brand-500" />
            Independent reports
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-surface-600">
            This case has no location on it, so we cannot check whether anyone else
            reported the same incident. Adding where it happened would let us look.
          </p>
        </CardContent>
      </Card>
    );
  }

  const strength = STRENGTH[corroborationStrength(data)];
  const total = data.directMatches + data.relatedMatches;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-surface-900">
          <Users size={18} className="text-brand-500" />
          Independent reports
        </h2>
        <Badge variant={strength.tone}>{strength.label}</Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-surface-700">{strength.blurb}</p>

        {total > 0 && (
          <dl className="grid grid-cols-2 gap-4 border-t border-surface-100 pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-surface-500">
                Same category
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-surface-900">
                {data.directMatches}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-surface-500">Related</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-surface-900">
                {data.relatedMatches}
              </dd>
            </div>
            {data.nearestKm !== null && (
              <div>
                <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-surface-500">
                  <MapPin size={11} />
                  Nearest
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-surface-900">
                  {data.nearestKm < 1
                    ? `${Math.round(data.nearestKm * 1000)}m`
                    : `${data.nearestKm}km`}
                </dd>
              </div>
            )}
            <div>
              <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-surface-500">
                <Clock size={11} />
                Window
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-surface-900">
                ±{data.windowHours}h
              </dd>
            </div>
          </dl>
        )}

        <p className="flex items-start gap-2 rounded-lg bg-surface-50 p-3 text-xs leading-relaxed text-surface-600">
          <Info size={14} className="mt-0.5 shrink-0 text-surface-400" />
          <span>
            Counted within {data.radiusKm}km and ±{data.windowHours} hours, from people
            with no connection to this case. We never show you who they are or what they
            wrote — their reports are as private as yours.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
