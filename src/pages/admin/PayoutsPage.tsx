import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Banknote, Send, ShieldCheck, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  StatsCard, Card, CardHeader, CardContent, Button, Badge, Spinner, Modal, Input, TextArea, EmptyState,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fetchPayoutQueue, releasePayout, type PayoutRow } from '@/services/engagementService';

/**
 * What The Security Watch owes professionals, and recording that it has paid.
 *
 * Deliberately does NOT move money. Releasing here records a transfer that an
 * administrator has already made — by bank transfer or through Paystack — with
 * the reference that proves it. Automating the transfer itself would mean this
 * screen could disburse funds on a single click, and payouts are the one place
 * where a person confirming is worth more than a saved step.
 */

const STATUS_VARIANT: Record<PayoutRow['status'], 'success' | 'warning' | 'danger' | 'default'> = {
  released: 'success',
  approved: 'warning',
  accrued: 'default',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<PayoutRow['status'], string> = {
  released: 'Paid',
  approved: 'Approved',
  accrued: 'Owed',
  cancelled: 'Cancelled',
};

const REASON_LABEL: Record<PayoutRow['reason'], string> = {
  deposit_share: 'Mobilisation deposit',
  balance_share: 'Balance on completion',
  adjustment: 'Adjustment',
};

interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
}

export default function PayoutsPage() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayoutRow | null>(null);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { payouts, error } = await fetchPayoutQueue();
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    setRows(payouts);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Bank details are fetched only when a specific payout is opened, never with
   * the list. An account number has no business being in a table of thirty
   * rows on screen, and `payout_accounts` is admin-readable precisely so it can
   * be looked at deliberately rather than in bulk.
   */
  useEffect(() => {
    if (!selected) {
      setBank(null);
      return;
    }

    let cancelled = false;
    setBankLoading(true);

    void supabase
      .from('payout_accounts')
      .select('bank_name, account_number, account_name')
      .eq('user_id', selected.professional_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBank((data as BankDetails) ?? null);
        setBankLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const owed = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'accrued' || r.status === 'approved')
        .reduce((sum, r) => sum + Number(r.amount), 0),
    [rows]
  );

  const paid = useMemo(
    () => rows.filter((r) => r.status === 'released').reduce((sum, r) => sum + Number(r.amount), 0),
    [rows]
  );

  const currency = rows[0]?.currency ?? 'NGN';

  const submit = async () => {
    if (!selected) return;

    if (!reference.trim()) {
      toast.error('Enter the transfer reference before recording this payout.');
      return;
    }

    setSaving(true);
    const { error } = await releasePayout(selected.id, reference.trim(), note.trim() || undefined);
    setSaving(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success('Payout recorded. The professional has been notified.');
    setSelected(null);
    setReference('');
    setNote('');
    void load();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Payouts</h1>
        <p className="mt-1 text-surface-500">
          What is owed to professionals, and what has been sent.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          icon={Banknote}
          label="Owed"
          value={`${currency} ${owed.toLocaleString()}`}
          variant="warning"
        />
        <StatsCard
          icon={ShieldCheck}
          label="Paid out"
          value={`${currency} ${paid.toLocaleString()}`}
          variant="success"
        />
        <StatsCard
          icon={Send}
          label="Awaiting release"
          value={rows.filter((r) => r.status === 'accrued' || r.status === 'approved').length}
          variant="teal"
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900">Ledger</h2>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Banknote}
              tint="teal"
              title="Nothing owed"
              description="A payout appears here once a complainant funds an engagement."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 text-left">
                    <th className="px-6 py-3 font-medium text-surface-500">Date</th>
                    <th className="px-6 py-3 font-medium text-surface-500">Professional</th>
                    <th className="px-6 py-3 font-medium text-surface-500">Tranche</th>
                    <th className="px-6 py-3 font-medium text-surface-500">Amount</th>
                    <th className="px-6 py-3 font-medium text-surface-500">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-surface-50 last:border-0">
                      <td className="whitespace-nowrap px-6 py-3 text-surface-600">
                        {format(new Date(r.created_at), 'd MMM yyyy')}
                      </td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-surface-900">
                          {r.professional?.full_name ?? 'Unknown'}
                        </p>
                        {r.professional?.email &&
                          r.professional.email !== r.professional.full_name && (
                            <p className="text-xs text-surface-500">{r.professional.email}</p>
                          )}
                      </td>
                      <td className="px-6 py-3 text-surface-600">{REASON_LABEL[r.reason]}</td>
                      <td className="whitespace-nowrap px-6 py-3 font-medium tabular-nums text-surface-900">
                        {r.currency} {Number(r.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {r.status === 'accrued' || r.status === 'approved' ? (
                          <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>
                            Record payout
                          </Button>
                        ) : (
                          <span className="font-mono text-xs text-surface-400">
                            {r.transfer_reference ?? '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Record a payout" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-3">
              <p className="text-sm text-surface-600">
                {REASON_LABEL[selected.reason]} to{' '}
                <span className="font-medium text-surface-900">
                  {selected.professional?.full_name ?? 'this professional'}
                </span>
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-surface-900">
                {selected.currency} {Number(selected.amount).toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-surface-200 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-surface-700">
                <Landmark className="h-3.5 w-3.5" /> Send to
              </p>
              {bankLoading ? (
                <Spinner size="sm" />
              ) : bank ? (
                <div className="space-y-0.5 text-sm">
                  <p className="font-medium text-surface-900">{bank.account_name}</p>
                  <p className="font-mono text-surface-700">{bank.account_number}</p>
                  <p className="text-surface-500">{bank.bank_name}</p>
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  This professional has not added a payout account yet. Ask them to
                  add one before transferring.
                </p>
              )}
            </div>

            <Input
              label="Transfer reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="From your bank or Paystack"
            />

            <TextArea
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />

            <p className="rounded-lg bg-surface-50 p-3 text-xs text-surface-500">
              This records a transfer you have already made. It does not move money.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button onClick={() => void submit()} loading={saving} icon={Send}>
                Record payout
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
