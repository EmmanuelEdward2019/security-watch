import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Mail, ArrowRight, Eye, EyeOff, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { ROLE_HOME } from '@/lib/rbac';
import type { UserRole } from '@/types';

function getDashboardPath(role?: UserRole): string {
  return ROLE_HOME[role ?? 'complainant'];
}

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});


type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const path = getDashboardPath(user?.role);
      navigate(path, { replace: true });
    }
  }, [isAuthenticated, authLoading, user, navigate]);

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
    setValue,
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    const savedEmail = localStorage.getItem('tsw-remember-email');
    if (savedEmail) {
      setValue('email', savedEmail);
      setRememberMe(true);
    }
  }, [setValue]);


  const onEmailSubmit = async (data: LoginForm) => {
    setIsLoading(true);

    if (rememberMe) {
      localStorage.setItem('tsw-remember-email', data.email);
    } else {
      localStorage.removeItem('tsw-remember-email');
    }

    const result = await signIn(data.email, data.password);
    setIsLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Welcome back!');
      const path = getDashboardPath(result.user?.role);
      navigate(path, { replace: true });
    }
  };



  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setForgotLoading(true);
    // Send OTP via magic-link flow (shouldCreateUser: false ensures no new account is created)
    const { error } = await supabase.auth.signInWithOtp({
      email: forgotEmail.trim(),
      options: { shouldCreateUser: false },
    });
    setForgotLoading(false);
    if (error) {
      // Common error: user not found — show a generic message to prevent email enumeration
      toast.error(
        error.message.includes('not found') || error.message.includes('Invalid')
          ? 'If that email is registered, a reset code has been sent.'
          : error.message
      );
      return;
    }
    setShowForgot(false);
    setForgotEmail('');
    toast.success('Check your email for a 6-digit reset code.');
    navigate(`/verify-otp?email=${encodeURIComponent(forgotEmail.trim())}&mode=recovery`);
  };

  return (
    <>
    {/* Forgot Password Modal */}
    <AnimatePresence>
      {showForgot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowForgot(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-surface-200 p-8 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-surface-900">Reset password</h2>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="p-1 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-surface-600 text-sm mb-6">
              Enter the email address associated with your account and we'll send you a 6-digit reset code.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 mb-1">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleForgotPassword}
              className="w-full bg-forest-600 hover:bg-forest-700 text-white py-3"
              loading={forgotLoading}
              icon={Mail}
            >
              Send reset code
            </Button>
            <p className="mt-4 text-center text-xs text-surface-500">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="text-forest-600 font-medium hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <div className="min-h-screen bg-surface-50 flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-forest-600 flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-3">
          <img src="/assets/logo.png" alt="The Security Watch" className="h-14 w-14 object-contain" />
          <div>
            <span className="text-xl font-semibold text-white">The Security Watch</span>
            <p className="text-sm text-forest-200">...your concern</p>
          </div>
        </Link>
        <div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Your safety matters
          </h2>
          <p className="text-forest-100 max-w-sm">
            Sign in to report cases, track investigations, or manage your property listings. 
            We're here to help.
          </p>
        </div>
        <p className="text-forest-200 text-sm">
          © The Security Watch. Built for everyday people.
        </p>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/assets/logo.png" alt="Logo" className="h-16 w-16 object-contain" />
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-surface-200 p-8">
            <h1 className="text-2xl font-bold text-surface-900 mb-2">Sign in</h1>
            <p className="text-surface-600 mb-6">Welcome back. Enter your details to continue.</p>



            <form
                  onSubmit={handleEmailSubmit(onEmailSubmit)}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input
                        {...registerEmail('email')}
                        type="email"
                        autoComplete="username"
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                      />
                    </div>
                    {emailErrors.email && (
                      <p className="mt-1 text-sm text-accent-600">{emailErrors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input
                        {...registerEmail('password')}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="w-full pl-10 pr-12 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {emailErrors.password && (
                      <p className="mt-1 text-sm text-accent-600">{emailErrors.password.message}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-surface-300 text-forest-600" 
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-forest-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-forest-600 hover:bg-forest-700 text-white py-3"
                    loading={isLoading}
                    icon={ArrowRight}
                  >
                    Sign in
                  </Button>
                </form>

            <p className="mt-6 text-center text-sm text-surface-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-forest-600 font-medium hover:underline">
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
