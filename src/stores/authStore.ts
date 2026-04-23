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
  deleteAccount: () => Promise<{ error: string | null }>;
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
        try {
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
            });
            await get().fetchProfile(data.user.id);
          }
          return { error: null };
        } catch (e: any) {
          return { error: e?.message || 'An unexpected error occurred during signup' };
        }
      },

      signIn: async (email, password) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) return { error: error.message };
          if (!data.user) return { error: 'Login failed' };

          if (data.session) {
            set({
              session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
              },
            });
          }

          await get().fetchProfile(data.user.id);
          return { error: null, user: get().user };
        } catch (e: any) {
          return { error: e?.message || 'An unexpected error occurred during login' };
        }
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

      deleteAccount: async () => {
        const user = get().user;
        if (!user) return { error: 'Not authenticated' };
        try {
          // Insert a deletion request record so admins can process it
          const { error: reqErr } = await supabase
            .from('account_deletion_requests')
            .insert({
              user_id: user.user_id,
              email: user.email,
              full_name: user.full_name,
              requested_at: new Date().toISOString(),
              status: 'pending',
            });

          if (reqErr) {
            // Table may not exist yet — fall back to a notification to admin
            await supabase.from('notifications').insert({
              user_id: user.user_id,
              title: 'Account Deletion Requested',
              message: `User ${user.email} has requested account deletion. Please process via admin panel.`,
              type: 'warning',
              read: false,
              created_at: new Date().toISOString(),
            });
          }

          // Sign out immediately so user can't continue using the account
          await get().signOut();
          return { error: null };
        } catch (e: unknown) {
          return { error: e instanceof Error ? e.message : 'Failed to submit deletion request' };
        }
      },

      signOut: async () => {
        set({ user: null, session: null, isAuthenticated: false });
        try {
          // Attempt graceful sign out
          await supabase.auth.signOut();
        } catch (e) {
          console.error('Sign out error:', e);
        } finally {
          // Force clear local storage to prevent auto-login loops if network fails
          try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
          } catch (storageErr) {
            console.error('Local storage cleanup error:', storageErr);
          }
        }
      },

      fetchProfile: async (userId) => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

          // Abort if the user logged out while we were fetching
          if (!get().session) return;

          if (!error && data) {
            set({ user: data as Profile, isAuthenticated: true });
          } else {
            const { data: authData } = await supabase.auth.getUser();
            if (!authData?.user) {
              set({ user: null, session: null, isAuthenticated: false });
              return;
            }
            const meta = authData.user.user_metadata;
            set({
              user: {
                id: userId,
                user_id: userId,
                email: meta?.email || authData.user.email || '',
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
          if (get().session) {
            set({ isAuthenticated: true });
          }
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
            });
            await get().fetchProfile(session.user.id);
          }
        } finally {
          set({ isLoading: false });
        }

        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            set({
              session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              },
            });
            // Detach from current execution to prevent Supabase internal session Mutex deadlock
            setTimeout(() => {
              get().fetchProfile(session.user.id);
            }, 0);
          } else {
            set({ user: null, session: null, isAuthenticated: false });
          }
        });

        if (typeof window !== 'undefined') {
          window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('sb-') && e.key.endsWith('-auth-token')) {
              if (!e.newValue) {
                set({ user: null, session: null, isAuthenticated: false });
              }
            }
            if (e.key === 'tsw-auth') {
              try {
                const newState = JSON.parse(e.newValue || '{}');
                if (!newState?.state?.session) {
                  set({ user: null, session: null, isAuthenticated: false });
                }
              } catch {
                // Ignore parse errors
              }
            }
          });

          // If "Remember me" was not checked, clear the session when the browser closes.
          // The flag is checked INSIDE the handler so it reflects whatever the user chose
          // during the session (not just the value at startup before they logged in).
          window.addEventListener('beforeunload', () => {
            try {
              const remembered = localStorage.getItem('tsw-remember-me') === '1';
              if (!remembered) {
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && ((key.startsWith('sb-') && key.endsWith('-auth-token')) || key === 'tsw-auth')) {
                    keysToRemove.push(key);
                  }
                }
                keysToRemove.forEach((k) => localStorage.removeItem(k));
              }
            } catch {
              // Non-critical — ignore storage errors
            }
          });
        }
      },
    }),
    {
      name: 'tsw-auth',
      partialize: (state) => ({ session: state.session }),
    }
  )
);
