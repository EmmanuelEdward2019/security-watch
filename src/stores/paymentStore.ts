import { create } from 'zustand';
import type { Payment, PaymentProvider, PaymentStatus } from '@/types';
import { supabase } from '@/lib/supabase';

interface PaymentState {
  payments: Payment[];
  isLoading: boolean;
  filters: {
    status?: PaymentStatus;
    provider?: PaymentProvider;
    payerId?: string;
  };

  fetchPayments: (payerId?: string) => Promise<void>;
  createPayment: (payment: Partial<Payment>) => Promise<{ id: string | null; error: string | null }>;
  setFilters: (filters: PaymentState['filters']) => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  isLoading: false,
  filters: {},

  fetchPayments: async (payerId) => {
    set({ isLoading: true });
    let query = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (payerId) query = query.eq('payer_id', payerId);

    const { status, provider } = get().filters;
    if (status) query = query.eq('status', status);
    if (provider) query = query.eq('provider', provider);

    const { data, error } = await query;
    if (!error && data) set({ payments: data as Payment[] });
    set({ isLoading: false });
  },

  createPayment: async (payment) => {
    const { data, error } = await supabase
      .from('payments')
      .insert(payment)
      .select()
      .single();

    if (error) return { id: null, error: error.message };
    set((state) => ({ payments: [data as Payment, ...state.payments] }));
    return { id: data.id, error: null };
  },

  setFilters: (filters) => set({ filters }),
}));
