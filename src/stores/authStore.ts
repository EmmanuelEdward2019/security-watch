import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, UserRole } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: Profile | null;
  session: { access_token: string; refresh_token: string } | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: Profile | null) => void;
  setSession: (session: { access_token: string; refresh_token: string } | null) => void;
  setLoading: (loading: boolean) => void;

  signUp: (email: string, password: string, role: UserRole, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; user?: Profile | null }>;
  signInWithOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null; user?: Profile | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),

      signUp: async (email, password, role, fullName) => {
        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
            },
            emailRedirectTo: `${siteUrl}/login`,
          },
        });
        if (error) return { error: error.message };
        if (!data.user) return { error: 'Signup failed' };

        if (data.session) {
          set({
            session: {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            },
            isAuthenticated: true,
          });
          await get().fetchProfile(data.user.id);
        }
        return { error: null };
      },

      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        if (!data.user) return { error: 'Login failed' };

        set({
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
          isAuthenticated: true,
        });

        await get().fetchProfile(data.user.id);
        return { error: null, user: get().user };
      },

      signInWithOtp: async (phone) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) return { error: error.message };
        return { error: null };
      },

      verifyOtp: async (phone, token) => {
        const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        if (error) return { error: error.message };
        if (data.user) {
          set({ isAuthenticated: true });
          await get().fetchProfile(data.user.id);
        }
        return { error: null, user: get().user };
      },

      resetPassword: async (email) => {
        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/reset-password`,
        });
        if (error) return { error: error.message };
        return { error: null };
      },

      signOut: async () => {
        set({ user: null, session: null, isAuthenticated: false });
        try {
          await supabase.auth.signOut();
        } catch {
          // State already cleared above
        }
      },

      fetchProfile: async (userId) => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (!error && data) {
            set({ user: data as Profile, isAuthenticated: true });
          } else {
            const { data: authData } = await supabase.auth.getUser();
            const meta = authData?.user?.user_metadata;
            set({
              user: {
                id: userId,
                user_id: userId,
                email: meta?.email || authData?.user?.email || '',
                full_name: meta?.full_name || '',
                role: (meta?.role as UserRole) || 'complainant',
                kyc_status: 'pending' as const,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              isAuthenticated: true,
            });
          }
        } catch {
          set({ isAuthenticated: true });
        }
      },

      updateProfile: async (updates) => {
        const user = get().user;
        if (!user) return { error: 'Not authenticated' };

        const { error } = await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('user_id', user.user_id);

        if (error) return { error: error.message };

        set({ user: { ...user, ...updates } });
        return { error: null };
      },

      initialize: async () => {
        set({ isLoading: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            set({
              session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              },
              isAuthenticated: true,
            });
            await get().fetchProfile(session.user.id);
          }
        } finally {
          set({ isLoading: false });
        }

        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            set({
              session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              },
              isAuthenticated: true,
            });
            await get().fetchProfile(session.user.id);
          } else {
            set({ user: null, session: null, isAuthenticated: false });
          }
        });
      },
    }),
    {
      name: 'tsw-auth',
      partialize: (state) => ({ session: state.session }),
    }
  )
);
