/**
 * ResetPasswordPage
 *
 * Reached after OTP verification in recovery mode (/verify-otp?mode=recovery).
 * At this point supabase.auth already has a valid session (established by verifyOtp).
 * The user just needs to set and confirm their new password.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { checkPassword, PASSWORD_MIN_LENGTH } from '@/lib/password';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  /**
   * Establish that we have a recovery session before offering the form.
   *
   * Two routes arrive here and they differ in timing:
   *
   *   Web    — /verify-otp calls verifyOtp and navigates here afterwards, so a
   *            session already exists by the time this mounts.
   *   Mobile — the emailed link hits Supabase's /auth/v1/verify, which redirects
   *            here with the session in the URL fragment. The client parses that
   *            asynchronously via detectSessionInUrl.
   *
   * A bare getSession() on mount serves the first case and races the second: it
   * can resolve null while the fragment is still being parsed, and told users
   * with a perfectly valid token that their session had expired.
   *
   * So we listen as well as ask, and only give up once the client has had a
   * chance to finish.
   */
  useEffect(() => {
    let settled = false;
    let timer: number | undefined;

    const accept = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      setHasSession(true);
      setCheckingSession(false);
    };

    // Fires when the recovery token in the URL is exchanged for a session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        accept();
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        accept();
        return;
      }

      // No session yet. If the URL carries recovery material, give the client
      // time to process it before declaring failure.
      const url = `${window.location.hash}${window.location.search}`;
      const looksLikeRecovery = /access_token=|token_hash=|type=recovery|code=/.test(url);

      timer = window.setTimeout(
        () => {
          if (settled) return;
          settled = true;
          setHasSession(false);
          setCheckingSession(false);
          toast.error(
            looksLikeRecovery
              ? 'That reset link could not be verified. It may have expired — request a new one.'
              : 'Session expired. Please start the password reset process again.'
          );
        },
        looksLikeRecovery ? 3000 : 0
      );
    });

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  // Password strength helpers
  const strength = getStrength(password);

  const handleReset = async () => {
    // Full policy, not just a length check — see lib/password.ts.
    const strength = checkPassword(password);
    if (!strength.acceptable) {
      toast.error(strength.issues[0]);
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      // Sign out so they log in fresh with their new credentials
      await supabase.auth.signOut();
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-forest-600 flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-3">
          <img src="/assets/logo.png" alt="The Security Watch" className="h-14 w-14 object-contain" />
          <div>
            <span className="text-xl font-semibold text-white">The Security Watch</span>
            <p className="text-sm text-forest-200">...your concern</p>
          </div>
        </Link>
        <div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Set a new password</h2>
          <p className="text-forest-100 max-w-sm">
            Choose a strong, unique password you haven't used before — at least{' '}
            {PASSWORD_MIN_LENGTH} characters, with upper and lower case, a number and a symbol.
          </p>
        </div>
        <p className="text-forest-200 text-sm">© The Security Watch. Built for everyday people.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/assets/logo.png" alt="Logo" className="h-16 w-16 object-contain" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-surface-200 p-8"
          >
            {checkingSession ? (
              /* Checking session */
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                <p className="text-sm text-surface-500">Verifying your session…</p>
              </div>
            ) : !hasSession ? (
              /* No session — OTP expired or skipped */
              <div className="text-center py-6 space-y-4">
                <p className="text-surface-600">
                  Your session has expired. Please go back and request a new reset code.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-brand-600 font-medium hover:underline"
                >
                  Back to sign in <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : success ? (
              /* Success */
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-brand-600" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900">Password updated!</h1>
                <p className="text-surface-600">
                  Your password has been changed successfully. Sign in with your new credentials.
                </p>
                <Button
                  onClick={() => navigate('/login', { replace: true })}
                  icon={ArrowRight}
                  className="w-full"
                >
                  Sign in now
                </Button>
              </div>
            ) : (
              /* Password form */
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold text-surface-900 mb-1">New password</h1>
                  <p className="text-surface-500 text-sm">
                    Enter and confirm your new password below.
                  </p>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-12 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-surface-900"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              strength >= level
                                ? level <= 1
                                  ? 'bg-red-500'
                                  : level === 2
                                  ? 'bg-amber-500'
                                  : level === 3
                                  ? 'bg-yellow-400'
                                  : 'bg-green-500'
                                : 'bg-surface-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-surface-500">
                        Strength:{' '}
                        <span className={strength >= 3 ? 'text-green-600 font-medium' : 'text-amber-600'}>
                          {['', 'Weak', 'Fair', 'Good', 'Strong'][strength]}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 outline-none text-surface-900 ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-red-400 focus:ring-red-300 focus:border-red-400'
                          : confirmPassword && confirmPassword === password
                          ? 'border-green-400 focus:ring-green-300 focus:border-green-400'
                          : 'border-surface-300 focus:ring-brand-500 focus:border-brand-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="mt-1 text-xs text-red-500">Passwords don't match</p>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleReset}
                  className="w-full"
                  loading={isLoading}
                  disabled={
                    !password ||
                    !confirmPassword ||
                    password !== confirmPassword ||
                    password.length < PASSWORD_MIN_LENGTH
                  }
                  icon={Lock}
                >
                  Save new password
                </Button>

                <p className="text-center text-sm text-surface-500">
                  Remember your password?{' '}
                  <Link to="/login" className="text-brand-600 font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** Returns 1–4 strength score for a password */
function getStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score) as 1 | 2 | 3 | 4;
}
