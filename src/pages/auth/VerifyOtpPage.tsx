/**
 * VerifyOtpPage
 *
 * Shared OTP entry page for two modes:
 *   - mode=signup   → verifies email after registration (type: 'signup')
 *   - mode=recovery → verifies identity for password reset (type: 'email')
 *
 * URL: /verify-otp?email=user@example.com&mode=signup|recovery
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MailCheck, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { ROLE_HOME } from '@/lib/rbac';
import toast from 'react-hot-toast';

/**
 * Six digits, matching Supabase's default.
 *
 * It was eight, which is the maximum Supabase allows and which overflowed the
 * viewport on a narrow phone — eight boxes plus gaps exceeded 320px, so the row
 * ran off the edge. Six is the industry norm, still 10^6 combinations against a
 * short expiry and a rate limit, and fits comfortably.
 *
 * This must match Authentication → Providers → Email → OTP length in the
 * Supabase dashboard. If that is still 8, a valid code will not fit here.
 */
const CODE_LENGTH = 6;

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const email = params.get('email') ?? '';
  const mode = (params.get('mode') ?? 'signup') as 'signup' | 'recovery';

  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first empty box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // Auto-submit when all 6 digits are filled
  const code = digits.join('');
  useEffect(() => {
    if (code.length === CODE_LENGTH && !verifying) {
      handleVerify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleDigitChange = (idx: number, value: string) => {
    // Allow paste of full code into any box
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      const next = Array(CODE_LENGTH).fill('');
      pasted.split('').forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);

    // Advance focus
    if (digit && idx < CODE_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = '';
        setDigits(next);
      } else if (idx > 0) {
        const next = [...digits];
        next[idx - 1] = '';
        setDigits(next);
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < CODE_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleVerify = useCallback(async (otp: string) => {
    if (otp.length !== CODE_LENGTH || !email) return;
    setVerifying(true);
    try {
      const type = mode === 'signup' ? 'signup' : 'email';
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type,
      });

      if (error) {
        toast.error(error.message === 'Token has expired or is invalid'
          ? 'Invalid or expired code. Please check and try again.'
          : error.message);
        setDigits(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }

      if (mode === 'signup') {
        // Fetch full profile then go to role dashboard
        if (data.user) {
          await fetchProfile(data.user.id);
        }
        const user = useAuthStore.getState().user;
        setVerified(true);
        toast.success('Email verified! Welcome aboard.');
        setTimeout(() => {
          navigate(ROLE_HOME[user?.role ?? 'complainant'], { replace: true });
        }, 1200);
      } else {
        // Recovery mode: OTP verified → go set new password
        // Session is now active; ResetPasswordPage will call updateUser()
        setVerified(true);
        toast.success('Identity verified. Set your new password.');
        setTimeout(() => navigate('/reset-password', { replace: true }), 1200);
      }
    } finally {
      setVerifying(false);
    }
  }, [email, mode, fetchProfile, navigate]);

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setResending(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
      }
      toast.success('A new code has been sent to your email.');
      setResendCooldown(60);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not resend code. Try again.');
    } finally {
      setResending(false);
    }
  };

  const title = mode === 'signup' ? 'Verify your email' : 'Enter your reset code';
  const subtitle =
    mode === 'signup'
      ? 'We sent a 6-digit verification code to'
      : 'We sent a 6-digit password reset code to';

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
            <MailCheck size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            {mode === 'signup' ? 'One last step' : "Prove it's you"}
          </h2>
          <p className="text-forest-100 max-w-sm">
            {mode === 'signup'
              ? 'Enter the code we emailed you to activate your account and access your dashboard.'
              : 'Enter the code we emailed you to verify your identity before setting a new password.'}
          </p>
        </div>
        <p className="text-forest-200 text-sm">© The Security Watch. Built for everyday people.</p>
      </div>

      {/* Right: OTP form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/assets/logo.png" alt="Logo" className="h-16 w-16 object-contain" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-surface-200 p-8"
          >
            <AnimatePresence mode="wait">
              {verified ? (
                /* Success state */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-6 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center">
                    <CheckCircle2 size={44} className="text-brand-500" />
                  </div>
                  <h2 className="text-xl font-bold text-surface-900">
                    {mode === 'signup' ? 'Email verified!' : 'Identity confirmed!'}
                  </h2>
                  <p className="text-surface-500 text-sm">
                    {mode === 'signup' ? 'Redirecting you to your dashboard…' : 'Redirecting to password reset…'}
                  </p>
                </motion.div>
              ) : (
                /* OTP entry state */
                <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold text-surface-900 mb-1">{title}</h1>
                    <p className="text-surface-500 text-sm">
                      {subtitle}{' '}
                      <span className="font-medium text-surface-700">{email || 'your email'}</span>.
                      Check your inbox (and spam folder).
                    </p>
                  </div>

                  {/* 6-box digit input */}
                  <div className="mb-6 flex w-full justify-center gap-1.5 sm:gap-2">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]"
                        maxLength={CODE_LENGTH}
                        value={d}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onFocus={(e) => e.target.select()}
                        disabled={verifying}
                        className={`
                          h-12 w-full max-w-[3rem] min-w-0 flex-1
                          text-center text-lg font-bold rounded-lg border-2 outline-none
                          transition-all select-all
                          ${d ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-300 text-surface-900'}
                          focus:border-brand-500 focus:ring-2 focus:ring-brand-200
                          disabled:opacity-60 disabled:cursor-not-allowed
                        `}
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>

                  {/* Loading / submit indicator */}
                  {verifying && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-2 mb-4 text-sm text-surface-500"
                    >
                      <div className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                      Verifying…
                    </motion.div>
                  )}

                  {/* Manual submit (backup if auto-submit didn't fire) */}
                  <Button
                    className="w-full"
                    disabled={code.length !== CODE_LENGTH || verifying}
                    loading={verifying}
                    onClick={() => handleVerify(code)}
                  >
                    Verify Code
                  </Button>

                  {/* Resend */}
                  <div className="mt-5 flex items-center justify-center gap-1.5 text-sm text-surface-500">
                    <span>Didn't receive a code?</span>
                    {resendCooldown > 0 ? (
                      <span className="font-medium text-surface-400">
                        Resend in {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="font-medium text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 disabled:opacity-60"
                      >
                        {resending && <RefreshCw size={13} className="animate-spin" />}
                        Resend code
                      </button>
                    )}
                  </div>

                  {/* Back link */}
                  <div className="mt-4 flex justify-center">
                    <Link
                      to={mode === 'signup' ? '/register' : '/login'}
                      className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 transition-colors"
                    >
                      <ArrowLeft size={14} />
                      {mode === 'signup' ? 'Back to sign up' : 'Back to sign in'}
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
