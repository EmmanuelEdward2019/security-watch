import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ToggleLeft, ToggleRight, MapPin, Briefcase, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card, CardHeader, CardContent, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const SPECIALIZATIONS = [
  'Fraud',
  'Cybercrime',
  'Missing Persons',
  'Land Disputes',
  'Domestic',
  'Corruption',
  'Theft',
  'Kidnapping',
  'Assault',
  'Murder',
] as const;

export default function AvailabilityPage() {
  const user = useAuthStore((s) => s.user);
  const [isAvailable, setIsAvailable] = useState(true);
  const [region, setRegion] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [investigatorId, setInvestigatorId] = useState<string | null>(null);

  // Load existing settings from Supabase
  useEffect(() => {
    if (!user) return;

    async function load() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('investigators')
        .select('id, service_area, specialization, is_available')
        .eq('user_id', user!.user_id)
        .maybeSingle();

      if (!error && data) {
        setInvestigatorId(data.id);
        setRegion(data.service_area ?? '');
        setSelected(new Set(data.specialization ?? []));
        setIsAvailable((data as { is_available?: boolean }).is_available ?? true);
      }
      setIsLoading(false);
    }

    load();
  }, [user]);

  const toggleSpec = (spec: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(spec)) next.delete(spec);
      else next.add(spec);
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const payload = {
        service_area: region,
        specialization: Array.from(selected),
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      };

      if (investigatorId) {
        // Update existing record
        const { error } = await supabase
          .from('investigators')
          .update(payload)
          .eq('id', investigatorId);
        if (error) throw error;
      } else {
        // Create a new investigator record for this user
        const { data, error } = await supabase
          .from('investigators')
          .insert({
            user_id: user.user_id,
            experience_years: 0,
            rating: 0,
            total_cases: 0,
            verification_status: 'pending',
            ...payload,
          })
          .select('id')
          .single();
        if (error) throw error;
        setInvestigatorId(data.id);
      }

      toast.success('Availability settings saved.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Availability Settings</h1>
        <p className="text-surface-500 mt-1">
          Manage your availability, working region, and areas of specialization.
        </p>
      </div>

      {/* Availability toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {isAvailable ? (
              <ToggleRight size={20} className="text-brand-600" />
            ) : (
              <ToggleLeft size={20} className="text-surface-400" />
            )}
            <h2 className="font-semibold text-surface-900">Availability Status</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-900">
                {isAvailable ? 'Available for assignments' : 'Unavailable'}
              </p>
              <p className="text-sm text-surface-500">
                {isAvailable
                  ? 'You will receive new case assignments.'
                  : 'You will not receive new assignments until you re-enable availability.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAvailable((v) => !v)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                isAvailable ? 'bg-brand-500' : 'bg-surface-300'
              }`}
              aria-label="Toggle availability"
              aria-checked={isAvailable}
              role="switch"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  isAvailable ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Working region */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-brand-600" />
            <h2 className="font-semibold text-surface-900">Working Region</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            label="Region / City"
            placeholder="E.g. Lagos, Abuja, Port Harcourt"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Specialization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase size={20} className="text-brand-600" />
            <h2 className="font-semibold text-surface-900">Specialization</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-surface-500 mb-3">
            Select the types of cases you specialize in. This helps us match you to relevant assignments.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SPECIALIZATIONS.map((spec) => {
              const isChecked = selected.has(spec);
              return (
                <label
                  key={spec}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSpec(spec)}
                    className="accent-brand-600 h-4 w-4"
                  />
                  <span className="text-sm font-medium">{spec}</span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button icon={Save} loading={isSaving} onClick={handleSave}>
          Save Settings
        </Button>
      </div>
    </motion.div>
  );
}
