import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, ShieldCheck, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardContent, Input, Button, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

/**
 * Where a professional's payouts are sent.
 *
 * Until now there was nowhere on the platform to record this. Paying an
 * investigator meant an administrator asking for bank details over a message
 * and transferring by hand, with nothing written down — no record of who was
 * paid, to which account, or on whose authority.
 *
 * `payout_accounts` is deliberately its own table with its own policies: an
 * account number is readable by its owner and administrators and nobody else,
 * and it must never travel along with a professional profile that case and
 * matching queries already join more widely.
 */
export default function PayoutAccountPage() {
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [existing, setExisting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('payout_accounts')
      .select('bank_name, account_number, account_name')
      .eq('user_id', user.user_id)
      .maybeSingle();

    if (data) {
      setBankName(data.bank_name ?? '');
      setAccountNumber(data.account_number ?? '');
      setAccountName(data.account_name ?? '');
      setExisting(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!user) return;

    const number = accountNumber.trim();

    // Mirrors the CHECK on the column. Catching it here means a typo gets a
    // sentence rather than a Postgres constraint error.
    if (!/^[0-9]{10}$/.test(number)) {
      toast.error('A Nigerian account number is exactly 10 digits.');
      return;
    }
    if (!bankName.trim() || !accountName.trim()) {
      toast.error('Bank name and account name are both required.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('payout_accounts').upsert(
      {
        user_id: user.user_id,
        bank_name: bankName.trim(),
        account_number: number,
        account_name: accountName.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setExisting(true);
    toast.success('Payout account saved.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Payout account</h1>
        <p className="mt-1 text-surface-500">
          Where The Security Watch sends your share of an engagement.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 font-semibold text-surface-900">
              <Landmark size={18} className="text-brand-500" />
              Bank details
            </h2>
          </CardHeader>

          <CardContent className="space-y-4">
            <Input
              label="Bank name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Guaranty Trust Bank"
            />
            <Input
              label="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10 digits"
              inputMode="numeric"
            />
            <Input
              label="Account name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="As it appears on the account"
            />

            <div className="flex items-start gap-2 rounded-lg bg-surface-50 p-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" />
              <p className="text-xs text-surface-600">
                Visible only to you and to administrators processing a payout. It is
                never shown on a case, in matching results, or to a complainant.
              </p>
            </div>

            <Button onClick={() => void save()} loading={saving} icon={Save}>
              {existing ? 'Update account' : 'Save account'}
            </Button>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
