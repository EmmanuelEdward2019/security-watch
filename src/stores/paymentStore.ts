import { create } from 'zustand';
import type { Payment, PaymentProvider, PaymentStatus } from '@/types';
import { supabase } from '@/lib/supabase';

/**
 * Payment records — read only.
 *
 * `createPayment` is gone. The store used to insert rows with a client-chosen
 * amount and `status: 'completed'`, which meant a paid service could be unlocked
 * without money moving. Payments are created by the payments-initialize edge
 * function and settled by the Paystack webhook; client INSERT on the table has
 * been revoked and a trigger pins the status column.
 *
 * Use `startPayment()` from services/paymentService to begin a checkout.
 */
interface PaymentState {
  payments: Payment[];
  isLoading: boolean;
  error: string | null;
  filters: {
    status?: PaymentStatus;
    provider?: PaymentProvider;
    purpose?: string;
  };

  fetchPayments: (payerId?: string) => Promise<void>;
  /** Admin view: every payment, with the payer resolved. */
  fetchAllPayments: () => Promise<void>;
  setFilters: (filters: PaymentState['filters']) => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  isLoading: false,
  error: null,
  filters: {},

  fetchPayments: async (payerId) => {
    set({ isLoading: true, error: null });

    let query = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (payerId) query = query.eq('payer_id', payerId);

    const { status, provider, purpose } = get().filters;
    if (status) query = query.eq('status', status);
    if (provider) query = query.eq('provider', provider);
    if (purpose) query = query.eq('purpose', purpose);

    const { data, error } = await query;
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ payments: (data ?? []) as Payment[], isLoading: false });
  },

  fetchAllPayments: async () => {
    set({ isLoading: true, error: null });

    // RLS restricts this to admins; a non-admin simply sees their own rows.
    let query = supabase
      .from('payments')
      .select('*, payer:profiles!payer_id(user_id, full_name, email)')
      .order('created_at', { ascending: false })
      .limit(500);

    const { status, provider, purpose } = get().filters;
    if (status) query = query.eq('status', status);
    if (provider) query = query.eq('provider', provider);
    if (purpose) query = query.eq('purpose', purpose);

    const { data, error } = await query;
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ payments: (data ?? []) as Payment[], isLoading: false });
  },

  setFilters: (filters) => set({ filters }),
}));
