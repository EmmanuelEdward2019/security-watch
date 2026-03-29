import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase injects RECOVERY event after token exchange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if already in a session (user clicked link and was redirected)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
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
      setSuccess(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    }
  };

  return (
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
            Set a new password
          </h2>
          <p className="text-forest-100 max-w-sm">
            Choose a strong, unique password to keep your account secure.
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

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-surface-200 p-8"
          >
            {success ? (
              <div className="text-center py-6">
                <div className="mx-auto w-16 h-16 bg-forest-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-forest-600" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 mb-2">Password updated!</h1>
                <p className="text-surface-600 mb-6">
                  Your password has been successfully changed. You'll be redirected to the login page shortly.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-forest-600 font-medium hover:underline"
                >
                  Go to sign in <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-surface-900 mb-2">Reset your password</h1>
                <p className="text-surface-600 mb-6">
                  {sessionReady
                    ? 'Enter your new password below.'
                    : 'Verifying your reset link...'}
                </p>

                {!sessionReady ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">New password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter new password (min. 6 characters)"
                          className="w-full pl-10 pr-12 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
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
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Confirm password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                          placeholder="Re-enter your new password"
                          className="w-full pl-10 pr-4 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleReset}
                      className="w-full bg-forest-600 hover:bg-forest-700 text-white py-3"
                      loading={isLoading}
                      icon={Lock}
                    >
                      Update password
                    </Button>
                  </div>
                )}

                <p className="mt-6 text-center text-sm text-surface-600">
                  Remember your password?{' '}
                  <Link to="/login" className="text-forest-600 font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
