import { useState } from 'react';
import { motion } from 'framer-motion';
import { ToggleLeft, ToggleRight, MapPin, Briefcase, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
} from '@/components/ui';
const SPECIALIZATIONS = [
  'Fraud',
  'Cybercrime',
  'Missing Persons',
  'Land Disputes',
  'Domestic',
  'Corruption',
  'Theft',
] as const;

export default function AvailabilityPage() {
  const [isAvailable, setIsAvailable] = useState(true);
  const [region, setRegion] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const toggleSpec = (spec: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(spec)) next.delete(spec);
      else next.add(spec);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Availability settings saved.');
    } catch {
      toast.error('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {isAvailable ? (
              <ToggleRight size={20} className="text-forest-600" />
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
                  : 'You will not receive new assignments.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAvailable((v) => !v)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isAvailable ? 'bg-forest-600' : 'bg-surface-300'
              }`}
              aria-label="Toggle availability"
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-forest-600" />
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase size={20} className="text-forest-600" />
            <h2 className="font-semibold text-surface-900">Specialization</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-surface-500 mb-3">
            Select the types of cases you specialize in.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SPECIALIZATIONS.map((spec) => {
              const isChecked = selected.has(spec);
              return (
                <label
                  key={spec}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-forest-500 bg-forest-50 text-forest-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSpec(spec)}
                    className="accent-forest-600 h-4 w-4"
                  />
                  <span className="text-sm font-medium">{spec}</span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          icon={Save}
          loading={isSaving}
          onClick={handleSave}
          className="bg-forest-600 hover:bg-forest-700"
        >
          Save Settings
        </Button>
      </div>
    </motion.div>
  );
}
