import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Shield, Home, Film, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
  Spinner,
  EmptyState,
  Badge,
} from '@/components/ui';
import { fetchAllServicePrices, updateServicePrice } from '@/services/adminService';
import { formatCurrency } from '@/services/paymentService';
import { PRICE_MODULE_LABELS, type ServicePrice, type PriceModule } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const MODULE_ICONS: Record<PriceModule, typeof Shield> = {
  investigation: Shield,
  property: Home,
  media: Film,
  security: DollarSign,
};

/**
 * Pricing control.
 *
 * The three "Save changes" buttons on this page had no click handler at all, and
 * no pricing table existed — every figure was local component state that vanished
 * on reload, while checkout let the user type any amount they liked.
 *
 * Prices now live in `service_prices`, which is what the payments-initialize
 * function reads when it prices a checkout. A change here changes what people are
 * actually charged, so every edit is written to the audit log at warning
 * severity.
 */
export default function PricingControlPage() {
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { amount: string; label: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { prices: list, error } = await fetchAllServicePrices();
    if (error) toast.error(error);
    setPrices(list);
    setDrafts(
      Object.fromEntries(
        list.map((p) => [p.id, { amount: String(p.amount), label: p.label }])
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const out = new Map<PriceModule, ServicePrice[]>();
    for (const price of prices) {
      const list = out.get(price.module) ?? [];
      list.push(price);
      out.set(price.module, list);
    }
    return [...out.entries()];
  }, [prices]);

  const isDirty = (price: ServicePrice) => {
    const draft = drafts[price.id];
    if (!draft) return false;
    return Number(draft.amount) !== Number(price.amount) || draft.label !== price.label;
  };

  const handleSave = async (price: ServicePrice) => {
    const draft = drafts[price.id];
    if (!draft) return;

    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (!draft.label.trim()) {
      toast.error('The service needs a name.');
      return;
    }

    setSaving(price.id);
    const { error } = await updateServicePrice(price.id, {
      amount,
      label: draft.label.trim(),
    });
    setSaving(null);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`${draft.label.trim()} is now ${formatCurrency(amount, price.currency)}.`);
    await load();
  };

  const handleToggleActive = async (price: ServicePrice) => {
    setSaving(price.id);
    const { error } = await updateServicePrice(price.id, { is_active: !price.is_active });
    setSaving(null);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      price.is_active
        ? `${price.label} is no longer purchasable.`
        : `${price.label} is available again.`
    );
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Pricing control</h1>
        <p className="text-surface-500 mt-1">
          What the platform charges for each service. These figures are used at checkout and shown on
          the public pricing page.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <AlertTriangle size={20} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-0.5">These prices are live</p>
          <p>
            A payment is priced from this table on the server, so a change takes effect on the next
            checkout. Every edit is recorded in the audit log against your account.
          </p>
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No services configured"
          description="Run the seed in migration 005 to populate the default catalogue."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([module, items]) => {
            const Icon = MODULE_ICONS[module];
            return (
              <Card key={module}>
                <CardHeader>
                  <h2 className="font-semibold text-surface-900 flex items-center gap-2">
                    <Icon size={16} className="text-brand-600" />
                    {PRICE_MODULE_LABELS[module]}
                  </h2>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-surface-100">
                    {items.map((price) => {
                      const draft = drafts[price.id] ?? {
                        amount: String(price.amount),
                        label: price.label,
                      };
                      const dirty = isDirty(price);

                      return (
                        <li key={price.id} className="py-4 first:pt-0 last:pb-0">
                          <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                            <div className="sm:col-span-5">
                              <Input
                                label="Service"
                                value={draft.label}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [price.id]: { ...draft, label: e.target.value },
                                  }))
                                }
                                maxLength={120}
                              />
                              <p className="text-xs text-surface-400 mt-1 font-mono">{price.key}</p>
                            </div>

                            <div className="sm:col-span-3">
                              <Input
                                label={`Amount (${price.currency})`}
                                type="number"
                                min="0"
                                step="500"
                                value={draft.amount}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [price.id]: { ...draft, amount: e.target.value },
                                  }))
                                }
                                className="tabular-nums"
                              />
                              {price.unit && (
                                <p className="text-xs text-surface-400 mt-1">{price.unit}</p>
                              )}
                            </div>

                            <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                icon={Save}
                                disabled={!dirty || saving === price.id}
                                loading={saving === price.id}
                                onClick={() => void handleSave(price)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={price.is_active ? EyeOff : Eye}
                                disabled={saving === price.id}
                                onClick={() => void handleToggleActive(price)}
                              >
                                {price.is_active ? 'Withdraw' : 'Publish'}
                              </Button>
                              {!price.is_active && <Badge variant="warning">Not purchasable</Badge>}
                            </div>
                          </div>

                          {price.description && (
                            <p className="text-sm text-surface-500 mt-2">{price.description}</p>
                          )}

                          <p className="text-xs text-surface-400 mt-1">
                            Currently {formatCurrency(Number(price.amount), price.currency)} · last
                            changed {format(new Date(price.updated_at), 'd MMM yyyy, HH:mm')}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
