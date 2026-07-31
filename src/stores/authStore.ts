import { create } from 'zustand';
import type { Profile, UserRole } from '@/types';
import { supabase, REMEMBER_ME_KEY } from '@/lib/supabase';

/**
 * Auth state.
 *
 * Tokens are deliberately NOT held here and NOT persisted by this store. The
 * store used to mirror the access and refresh tokens into localStorage under
 * `tsw-auth` alongside Supabase's own copy, which doubled the blast radius of
 * any XSS for no benefit. The Supabase client owns the session; this store only
 * tracks whether one exists and who it belongs to.
 *
 * Where the session is stored — localStorage or sessionStorage — is decided by
 * the "remember me" flag when the client is constructed (see lib/supabase.ts).
 */
interface AuthState {
  user: Profile | null;
  /** True when a Supabase session is active. Never holds token material. */
  hasSession: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Set when the account holds a role it has not been granted yet. */
  pendingRoleRequest: UserRole | null;

  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;

  signUp: (
    email: string,
    password: string,
    role: UserRole,
    fullName: string
  ) => Promise<{ error: string | null; needsVerification?: boolean }>;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ error: string | null; user?: Profile | null }>;
  verifyEmailOtp: (
    email: string,
    token: string
  ) => Promise<{ error: string | null; user?: Profile | null }>;
  resendEmailOtp: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestAccountDeletion: (reason?: string) => Promise<{ error: string | null }>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  initialize: () => Promise<void>;
}

/**
 * Fields a user is allowed to change on their own profile.
 *
 * `role` and `kyc_status` are pinned by a database trigger, so sending them
 * would be reverted server-side anyway — they are filtered here so the client
 * never generates a write that gets logged as an escalation attempt.
 */
const SELF_EDITABLE_FIELDS = [
  'full_name',
  'phone',
  'avatar_url',
  'bio',
  'location',
] as const;

function pickSelfEditable(updates: Partial<Profile>): Partial<Profile> {
  const out: Record<string, unknown> = {};
  for (const key of SELF_EDITABLE_FIELDS) {
    if (key in updates && updates[key] !== undefined) {
      out[key] = updates[key];
    }
  }
  return out as Partial<Profile>;
}

function setRememberMe(remember: boolean) {
  try {
    if (remember) {
      window.localStorage.setItem(REMEMBER_ME_KEY, '1');
    } else {
      window.localStorage.removeItem(REMEMBER_ME_KEY);
    }
  } catch {
    /* private mode — the default (do not remember) applies */
  }
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'That email and password do not match an account.';
  }
  if (m.includes('email not confirmed')) {
    return 'Confirm your email address first — check your inbox for the code.';
  }
  if (m.includes('token has expired') || m.includes('expired')) {
    return 'That code has expired. Request a new one.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (m.includes('user already registered')) {
    return 'An account with that email already exists. Sign in instead.';
  }
  return message;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  hasSession: false,
  isLoading: true,
  isAuthenticated: false,
  pendingRoleRequest: null,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      pendingRoleRequest:
        user && user.requested_role && user.requested_role !== user.role
          ? (user.requested_role as UserRole)
          : null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  signUp: async (email, password, role, fullName) => {
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // The role here is a *request*, not a grant. The database trigger
          // only honours self-service roles and records the rest for admin
          // review — see migration 004. Sending 'admin' achieves nothing.
          data: { full_name: fullName, role },
          emailRedirectTo: `${siteUrl}/login`,
        },
      });

      if (error) return { error: friendlyAuthError(error.message) };
      if (!data.user) return { error: 'Signup failed. Please try again.' };

      if (data.session) {
        set({ hasSession: true });
        await get().fetchProfile(data.user.id);
        return { error: null, needsVerification: false };
      }

      return { error: null, needsVerification: true };
    } catch (e: unknown) {
      return {
        error: e instanceof Error ? friendlyAuthError(e.message) : 'Unexpected error during signup',
      };
    }
  },

  signIn: async (email, password, rememberMe = false) => {
    try {
      // Recorded before sign-in so the client picks the right storage on the
      // next page load.
      setRememberMe(rememberMe);

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: friendlyAuthError(error.message) };
      if (!data.user) return { error: 'Sign in failed. Please try again.' };

      set({ hasSession: !!data.session });
      await get().fetchProfile(data.user.id);
      return { error: null, user: get().user };
    } catch (e: unknown) {
      return {
        error: e instanceof Error ? friendlyAuthError(e.message) : 'Unexpected error during sign in',
      };
    }
  },

  verifyEmailOtp: async (email, token) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: 'email',
      });
      if (error) return { error: friendlyAuthError(error.message) };

      set({ hasSession: !!data.session });
      if (data.user) {
        await get().fetchProfile(data.user.id);
      }
      return { error: null, user: get().user };
    } catch (e: unknown) {
      return { error: e instanceof Error ? friendlyAuthError(e.message) : 'Could not verify that code' };
    }
  },

  resendEmailOtp: async (email) => {
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${siteUrl}/login` },
      });
      if (error) return { error: friendlyAuthError(error.message) };
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? friendlyAuthError(e.message) : 'Could not resend the code' };
    }
  },

  resetPassword: async (email) => {
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  },

  requestAccountDeletion: async (reason) => {
    const user = get().user;
    if (!user) return { error: 'You need to be signed in.' };

    // Goes through an RPC that notifies every administrator. The old client-side
    // insert failed silently and then "notified" the departing user, so erasure
    // requests were dropped on the floor.
    const { error } = await supabase.rpc('request_account_deletion', {
      p_reason: reason ?? null,
    });

    if (error) return { error: error.message };

    await get().signOut();
    return { error: null };
  },

  signOut: async () => {
    set({ user: null, hasSession: false, isAuthenticated: false, pendingRoleRequest: null });
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      // If the network call failed, the client may still hold a session in
      // storage. Clear both stores so a failed sign-out cannot leave the next
      // visitor signed in.
      for (const store of [window.localStorage, window.sessionStorage]) {
        try {
          const keys: string[] = [];
          for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              keys.push(key);
            }
          }
          keys.forEach((k) => store.removeItem(k));
        } catch {
          /* storage unavailable — nothing to clear */
        }
      }
      try {
        // Legacy key from when this store persisted tokens itself.
        window.localStorage.removeItem('tsw-auth');
        window.localStorage.removeItem(REMEMBER_ME_KEY);
      } catch {
        /* nothing to do */
      }
    }
  },

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Could not load profile:', error.message);
      }

      if (data) {
        get().setUser(data as Profile);
        return;
      }

      // No profile row yet — the signup trigger may not have run. Fall back to
      // the auth record so the app can still route, but never trust metadata
      // for the role: default to the least privileged value.
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        set({ user: null, hasSession: false, isAuthenticated: false });
        return;
      }

      get().setUser({
        id: userId,
        user_id: userId,
        email: authData.user.email ?? '',
        full_name: (authData.user.user_metadata?.full_name as string) ?? '',
        role: 'complainant',
        kyc_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Profile fetch failed:', e);
    }
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return { error: 'You need to be signed in.' };

    const safe = pickSelfEditable(updates);
    if (Object.keys(safe).length === 0) {
      return { error: null };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(safe)
      .eq('user_id', user.user_id)
      .select()
      .maybeSingle();

    if (error) return { error: error.message };

    // Trust what came back rather than the optimistic merge — the database may
    // legitimately have pinned a field we tried to send.
    get().setUser((data as Profile) ?? { ...user, ...safe });
    return { error: null };
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        set({ hasSession: true });
        await get().fetchProfile(session.user.id);
      }
    } finally {
      set({ isLoading: false });
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        set({ hasSession: true });
        // Deferred to a macrotask: calling back into the Supabase client from
        // inside this handler deadlocks its internal session mutex.
        setTimeout(() => {
          void get().fetchProfile(session.user.id);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, hasSession: false, isAuthenticated: false, pendingRoleRequest: null });
      }
    });

    if (typeof window !== 'undefined') {
      // Signing out in one tab signs out the others.
      window.addEventListener('storage', (e) => {
        if (!e.key) return;
        if (e.key.startsWith('sb-') && e.key.endsWith('-auth-token') && !e.newValue) {
          set({ user: null, hasSession: false, isAuthenticated: false, pendingRoleRequest: null });
        }
      });
    }
  },
}));
