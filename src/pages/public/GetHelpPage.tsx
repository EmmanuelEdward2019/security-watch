import { useCallback, useEffect, useState } from 'react';
import { Phone, Globe, MapPin, LifeBuoy, AlertTriangle } from 'lucide-react';
import { Select, Spinner } from '@/components/ui';
import {
  findReferrals,
  KIND_LABEL,
  NIGERIAN_STATES,
  type Referral,
} from '@/services/referralService';

/**
 * Where to go tonight.
 *
 * Most people who reach this platform will never file a paid engagement, and
 * until now they got nothing. This page is for them: no account, no payment, no
 * form — which body handles this, and how to reach it.
 *
 * It is also the page that earns the platform its reputation. The paid work
 * comes out of trust built here, not the other way round.
 *
 * NOTHING UNVERIFIED APPEARS. `find_referrals` filters on `is_active`, which an
 * administrator sets only after checking the contact details against the
 * organisation's own published source. If the list is empty it says so plainly
 * rather than showing something plausible — a wrong number on this page is
 * somebody in trouble dialling into silence.
 */

const CATEGORIES = [
  { value: '', label: 'Anything' },
  { value: 'robbery', label: 'Robbery or armed attack' },
  { value: 'assault', label: 'Assault' },
  { value: 'domestic_dispute', label: 'Domestic violence' },
  { value: 'kidnapping', label: 'Kidnapping' },
  { value: 'missing_person', label: 'Missing person' },
  { value: 'murder', label: 'Death or killing' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'cybercrime', label: 'Online crime or blackmail' },
  { value: 'corruption', label: 'Corruption or a demand for a bribe' },
  { value: 'land_dispute', label: 'Land dispute' },
  { value: 'other', label: 'Something else' },
];

function ReferralCard({ r }: { r: Referral }) {
  const urgent = r.kind === 'emergency';

  return (
    <article
      className={
        urgent
          ? 'rounded-xl border-2 border-forest-600 bg-white p-5'
          : 'rounded-xl border border-surface-200 bg-white p-5'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-surface-900">{r.name}</h3>
        <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-xs text-surface-600">
          {KIND_LABEL[r.kind]}
        </span>
      </div>

      {r.guidance && (
        <p className="mt-2 text-sm leading-relaxed text-surface-700">{r.guidance}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {r.phone && (
          // A tel: link, not text. On the device most people will read this on,
          // the difference is whether they can call or have to transcribe.
          <a
            href={`tel:${r.phone.replace(/\s/g, '')}`}
            className="flex items-center gap-1.5 font-medium text-forest-700 underline underline-offset-4"
          >
            <Phone size={14} />
            {r.phone}
          </a>
        )}
        {r.altPhone && (
          <a
            href={`tel:${r.altPhone.replace(/\s/g, '')}`}
            className="flex items-center gap-1.5 text-forest-700 underline underline-offset-4"
          >
            <Phone size={14} />
            {r.altPhone}
          </a>
        )}
        {r.website && (
          <a
            href={r.website}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 text-surface-600 underline underline-offset-4"
          >
            <Globe size={14} />
            Website
          </a>
        )}
        {r.address && (
          <span className="flex items-center gap-1.5 text-surface-600">
            <MapPin size={14} />
            {r.address}
          </span>
        )}
      </div>

      {r.isLocal && (
        <p className="mt-3 text-xs text-forest-700">In {r.state}</p>
      )}
    </article>
  );
}

export default function GetHelpPage() {
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { referrals: rows } = await findReferrals({
      category: category || null,
      state: state || null,
      limit: 30,
    });
    setReferrals(rows);
    setLoading(false);
  }, [category, state]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="bg-surface-50">
      <header className="bg-forest-600 px-6 py-14 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">
            The Security Watch
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Where to get help</h1>
          <p className="mt-3 max-w-2xl text-white/85">
            You do not need an account, and you do not need to file anything. These are
            the bodies that handle these matters in Nigeria, and how to reach them.
          </p>

          <p className="mt-6 flex items-start gap-2 rounded-lg bg-white/10 p-4 text-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              If someone is in immediate danger, call <strong>112</strong> now. It is free
              from any phone and reaches the emergency centre for your state.
            </span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="What has happened?"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORIES}
          />
          <Select
            label="Where are you?"
            value={state}
            onChange={(e) => setState(e.target.value)}
            options={[
              { value: '', label: 'Anywhere in Nigeria' },
              ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>

        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : referrals.length === 0 ? (
            <div className="rounded-xl border border-surface-200 bg-white p-8 text-center">
              <LifeBuoy size={28} className="mx-auto text-surface-300" />
              <p className="mt-3 font-medium text-surface-900">
                Nothing listed here yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-surface-600">
                We only list contact details a person here has checked against the
                organisation&apos;s own published source. Rather than show you a number
                that might be wrong, we show you none. In an emergency, call{' '}
                <strong>112</strong>.
              </p>
            </div>
          ) : (
            referrals.map((r) => <ReferralCard key={r.id} r={r} />)
          )}
        </div>

        <p className="mt-10 border-t border-surface-200 pt-6 text-xs leading-relaxed text-surface-500">
          The Security Watch is not affiliated with the organisations listed here and
          cannot act on their behalf. Details are checked before they are published, but
          organisations move and numbers change — if something here is wrong, please tell
          us so we can correct it.
        </p>
      </main>
    </div>
  );
}
