import { useEffect, useState } from 'react';
import { BarChart3, Info } from 'lucide-react';
import { Spinner } from '@/components/ui';
import {
  fetchPublicOutcomes,
  fetchPublicScorecard,
  MIN_PUBLISHED_CELL,
  type PublicOutcomeRow,
  type ScorecardRow,
} from '@/services/outcomeService';

/**
 * The published figures.
 *
 * This is the civic dividend of collecting any of this: which categories go
 * somewhere, how long they take, and which bodies accept referrals rather than
 * refusing them. It is also what makes The Security Watch an accountability
 * institution rather than a service, which is the part that draws press,
 * donors, and the political cover a platform like this eventually needs.
 *
 * TWO DISCLOSURE RULES, BOTH ENFORCED IN THE DATABASE AND BOTH STATED ON THE
 * PAGE. Any group with fewer than five cases is withheld entirely — "one murder
 * case in Bayelsa, unresolved" is a person, not a statistic. And institutions
 * are named only from the curated register, never from the free-text field a
 * professional types into, because somebody will eventually put an officer's
 * name in there.
 *
 * The page states its own limitations prominently. Figures drawn from
 * self-selected reports are not crime statistics, and presenting them as though
 * they were would be the kind of overreach that discredits the whole exercise.
 */

const CATEGORY_LABEL: Record<string, string> = {
  fraud: 'Fraud',
  robbery: 'Robbery',
  murder: 'Murder',
  assault: 'Assault',
  domestic_dispute: 'Domestic',
  land_dispute: 'Land dispute',
  cybercrime: 'Cybercrime',
  corruption: 'Corruption',
  kidnapping: 'Kidnapping',
  missing_person: 'Missing person',
  other: 'Other',
};

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-200">
        <div className="h-full bg-forest-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-surface-600">{pct}%</span>
    </div>
  );
}

export default function AccountabilityPage() {
  const [outcomes, setOutcomes] = useState<PublicOutcomeRow[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([fetchPublicOutcomes(12), fetchPublicScorecard(12)]).then(
      ([o, s]) => {
        setOutcomes(o.rows);
        setScorecard(s.rows);
        setLoading(false);
      }
    );
  }, []);

  return (
    <div className="bg-surface-50">
      <header className="bg-forest-600 px-6 py-14 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">
            The Security Watch
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            Does reporting actually work?
          </h1>
          <p className="mt-3 max-w-2xl text-white/85">
            Every case on this platform has an outcome recorded against it, including the
            ones where nothing could be done. These are those figures for the last twelve
            months.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <>
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-surface-900">
                <BarChart3 size={18} className="text-brand-500" />
                By category
              </h2>

              {outcomes.length === 0 ? (
                <p className="mt-4 rounded-xl border border-surface-200 bg-white p-6 text-sm leading-relaxed text-surface-600">
                  There is not yet enough data to publish anything. Categories with fewer
                  than {MIN_PUBLISHED_CELL} cases are withheld, so figures appear here
                  once the platform has handled enough of them to report without
                  identifying anybody.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-surface-200 bg-white">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500">
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Cases</th>
                        <th className="px-4 py-3 font-medium">Resolved</th>
                        <th className="px-4 py-3 font-medium">Referred on</th>
                        <th className="px-4 py-3 font-medium">Still open</th>
                        <th className="px-4 py-3 font-medium">Typical days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {outcomes.map((r) => (
                        <tr key={r.category}>
                          <td className="px-4 py-3 font-medium text-surface-900">
                            {CATEGORY_LABEL[r.category] ?? r.category}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-surface-700">
                            {r.cases}
                          </td>
                          <td className="px-4 py-3">
                            <Bar value={r.resolved} total={r.cases} />
                          </td>
                          <td className="px-4 py-3 tabular-nums text-surface-700">
                            {r.referredOut}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-surface-700">
                            {r.stillOpen}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-surface-700">
                            {r.medianDays ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-surface-900">
                Bodies these cases were referred to
              </h2>
              <p className="mt-1 text-sm text-surface-600">
                How often a command or agency took a case on, and how often it refused or
                never answered.
              </p>

              {scorecard.length === 0 ? (
                <p className="mt-4 rounded-xl border border-surface-200 bg-white p-6 text-sm leading-relaxed text-surface-600">
                  Nothing to publish yet. A body appears here once at least{' '}
                  {MIN_PUBLISHED_CELL} cases have been referred to it and their outcomes
                  recorded.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-surface-200 bg-white">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500">
                        <th className="px-4 py-3 font-medium">Body</th>
                        <th className="px-4 py-3 font-medium">Location</th>
                        <th className="px-4 py-3 font-medium">Cases</th>
                        <th className="px-4 py-3 font-medium">Accepted</th>
                        <th className="px-4 py-3 font-medium">Refused</th>
                        <th className="px-4 py-3 font-medium">Typical days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {scorecard.map((r) => (
                        <tr key={`${r.institution}-${r.state ?? ''}`}>
                          <td className="px-4 py-3 font-medium text-surface-900">
                            {r.institution}
                          </td>
                          <td className="px-4 py-3 text-surface-600">{r.state ?? '—'}</td>
                          <td className="px-4 py-3 tabular-nums text-surface-700">
                            {r.cases}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-emerald-700">
                            {r.accepted}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-amber-700">
                            {r.refused}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-surface-700">
                            {r.medianDays ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-surface-200 bg-white p-6">
              <h2 className="flex items-center gap-2 font-semibold text-surface-900">
                <Info size={17} className="text-surface-400" />
                How to read these figures
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-surface-600">
                <p>
                  <strong className="text-surface-800">
                    These are not crime statistics.
                  </strong>{' '}
                  They describe cases brought to this platform by people who chose to
                  bring them. They say nothing about how much crime there is, only about
                  what happened to the matters we saw.
                </p>
                <p>
                  <strong className="text-surface-800">
                    Small groups are withheld entirely.
                  </strong>{' '}
                  Any category or body with fewer than {MIN_PUBLISHED_CELL} cases is
                  omitted rather than rounded, because a count that small can identify the
                  person behind it.
                </p>
                <p>
                  <strong className="text-surface-800">Nobody is named but bodies.</strong>{' '}
                  No complainant, professional, case or individual officer appears here,
                  and dates are never finer than a month. Bodies are named only from a
                  register we maintain by hand.
                </p>
                <p>
                  <strong className="text-surface-800">
                    &ldquo;Typical days&rdquo; is a median.
                  </strong>{' '}
                  Half of cases took less, half took more. One case that ran for years
                  would distort an average; it does not distort this.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
