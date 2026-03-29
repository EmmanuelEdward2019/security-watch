import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Mail, Smartphone, ArrowRight, Eye, EyeOff, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';
import { ROLE_HOME } from '@/lib/rbac';
import type { UserRole } from '@/types';

function getDashboardPath(role?: UserRole): string {
  return ROLE_HOME[role ?? 'complainant'];
}

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const otpSchema = z.object({
  phone: z.string().min(10, 'Please enter a valid phone number'),
  otp: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;
type OTPForm = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const [isPhoneMode, setIsPhoneMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithOtp = useAuthStore((s) => s.signInWithOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
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
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const {
    register: registerPhone,
    handleSubmit: handlePhoneSubmit,
    formState: { errors: phoneErrors },
    getValues: getPhoneValues,
  } = useForm<OTPForm>({ resolver: zodResolver(otpSchema) });

  const onEmailSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    const result = await signIn(data.email, data.password);
    setIsLoading(false);
    if (result.error) {
      toast.error('Invalid email or password. Please try again.');
    } else {
      toast.success('Welcome back!');
      const path = getDashboardPath(result.user?.role);
      navigate(path, { replace: true });
    }
  };

  const onSendOtp = async (data: OTPForm) => {
    setIsLoading(true);
    const result = await signInWithOtp(data.phone);
    setIsLoading(false);
    if (result.error) {
      toast.error('Could not send code. Please try again.');
    } else {
      setOtpSent(true);
      toast.success('Check your phone for the code.');
    }
  };

  const onVerifyOtp = async (data: OTPForm) => {
    if (!data.otp) return;
    setIsLoading(true);
    const result = await verifyOtp(getPhoneValues('phone'), data.otp);
    setIsLoading(false);
    if (result.error) {
      toast.error('Invalid code. Please try again.');
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
    const { error } = await resetPassword(forgotEmail.trim());
    setForgotLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Password reset email sent. Please check your inbox.');
      setShowForgot(false);
      setForgotEmail('');
    }
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
              Enter the email address associated with your account and we'll send you a link to reset your password.
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
              Send reset link
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

            <div className="flex p-1 bg-surface-100 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => setIsPhoneMode(false)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  !isPhoneMode ? 'bg-white text-surface-900 shadow' : 'text-surface-600'
                )}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setIsPhoneMode(true)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  isPhoneMode ? 'bg-white text-surface-900 shadow' : 'text-surface-600'
                )}
              >
                Phone
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!isPhoneMode ? (
                <motion.form
                  key="email"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
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
                      <input type="checkbox" className="rounded border-surface-300 text-forest-600" />
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
                </motion.form>
              ) : (
                <motion.form
                  key="phone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handlePhoneSubmit(otpSent ? onVerifyOtp : onSendOtp)}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Phone number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input
                        {...registerPhone('phone')}
                        type="tel"
                        placeholder="+234 800 000 0000"
                        disabled={otpSent}
                        className="w-full pl-10 pr-4 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none disabled:opacity-60"
                      />
                    </div>
                    {phoneErrors.phone && (
                      <p className="mt-1 text-sm text-accent-600">{phoneErrors.phone.message}</p>
                    )}
                  </div>
                  {otpSent && (
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Verification code</label>
                      <input
                        {...registerPhone('otp')}
                        type="text"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="w-full px-4 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none text-center tracking-widest"
                      />
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-forest-600 hover:bg-forest-700 text-white py-3"
                    loading={isLoading}
                    icon={otpSent ? ArrowRight : Smartphone}
                  >
                    {otpSent ? 'Verify' : 'Send code'}
                  </Button>
                  {otpSent && (
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="w-full text-sm text-surface-500 hover:text-surface-700 mt-2"
                    >
                      Use a different number
                    </button>
                  )}
                </motion.form>
              )}
            </AnimatePresence>

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
