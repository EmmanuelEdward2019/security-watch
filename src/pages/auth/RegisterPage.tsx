import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Scale,
  Stethoscope,
  Home,
  FileVideo,
  Building2,
  Shield,
  Eye,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { Card } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { USER_ROLE_LABELS, type UserRole } from '@/types';
import toast from 'react-hot-toast';

const roleIcons: Record<UserRole, React.ComponentType<{ size?: number; className?: string }>> = {
  complainant: User,
  investigator: Shield,
  lawyer: Scale,
  medical_expert: Stethoscope,
  witness: Eye,
  landlord: Building2,
  tenant: Home,
  media_agent: FileVideo,
  admin: Shield,
};

const step2Schema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    fullName: z.string().min(2, 'Full name is required'),
    phone: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const step3Schema = z.object({
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: 'You must accept the terms to continue',
  }),
});

type Step2Form = z.infer<typeof step2Schema>;
type Step3Form = z.infer<typeof step3Schema>;

export function RegisterPage() {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuthStore();

  const step2Form = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
    },
  });

  const step3Form = useForm<Step3Form>({
    resolver: zodResolver(step3Schema),
    defaultValues: { acceptTerms: false },
  });

  const onStep2Submit = () => {
    setStep(3);
  };

  const onStep3Submit = async () => {
    if (!selectedRole) return;
    const step2Data = step2Form.getValues();
    setIsLoading(true);
    const { error } = await signUp(
      step2Data.email,
      step2Data.password,
      selectedRole,
      step2Data.fullName
    );
    setIsLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    // Always go to OTP verification page — user must verify email before accessing dashboard
    toast.success('Account created! Check your email for your 6-digit verification code.');
    navigate(`/verify-otp?email=${encodeURIComponent(step2Data.email)}&mode=signup`);
  };

  const roles = (Object.entries(USER_ROLE_LABELS) as [UserRole, string][]).filter(
    ([role]) => role !== 'admin'
  );

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-forest-600">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          <Link to="/" className="flex items-center gap-3 mb-12">
            <img
              src="/assets/logo.png"
              alt=""
              className="h-14 w-14 rounded-xl object-cover shadow-lg"
            />
            <span className="text-2xl font-bold text-white">
              The Security Watch
            </span>
          </Link>
          <h2 className="text-4xl font-bold text-white leading-tight max-w-md">
            Join our community
          </h2>
          <p className="mt-4 text-xl text-forest-100 max-w-md">
            ...your concern
          </p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg">
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/assets/logo.png"
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
              <span className="font-semibold text-surface-900">
                The Security Watch
              </span>
            </Link>
          </div>

          {/* Progress */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step >= s ? 'bg-forest-600' : 'bg-surface-200'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-2xl font-bold text-surface-900">
                  Select your role
                </h1>
                <p className="mt-1 text-surface-500">
                  Choose how you&apos;ll use The Security Watch
                </p>
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {roles.map(([role, label]) => {
                    const Icon = roleIcons[role];
                    const isSelected = selectedRole === role;
                    return (
                      <motion.button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={`p-4 text-left transition-all ${
                            isSelected
                              ? 'ring-2 ring-forest-600 bg-forest-50 border-forest-200'
                              : 'hover:border-forest-300'
                          }`}
                        >
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg mb-2 ${
                              isSelected ? 'bg-forest-600 text-white' : 'bg-surface-100 text-surface-600'
                            }`}
                          >
                            <Icon size={20} />
                          </div>
                          <p className="text-sm font-medium text-surface-900">
                            {label}
                          </p>
                        </Card>
                      </motion.button>
                    );
                  })}
                </div>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedRole}
                  className="mt-6 w-full"
                  icon={ArrowRight}
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={step2Form.handleSubmit(onStep2Submit)}
                className="space-y-4"
              >
                <h1 className="text-2xl font-bold text-surface-900">
                  Create your account
                </h1>
                <p className="text-surface-500">
                  {selectedRole && USER_ROLE_LABELS[selectedRole]}
                </p>
                <Input
                  label="Full name"
                  icon={User}
                  placeholder="John Doe"
                  error={step2Form.formState.errors.fullName?.message}
                  {...step2Form.register('fullName')}
                />
                <Input
                  label="Email"
                  type="email"
                  icon={Mail}
                  placeholder="you@example.com"
                  error={step2Form.formState.errors.email?.message}
                  {...step2Form.register('email')}
                />
                <Input
                  label="Password"
                  type="password"
                  icon={Lock}
                  placeholder="••••••••"
                  error={step2Form.formState.errors.password?.message}
                  {...step2Form.register('password')}
                />
                <Input
                  label="Confirm password"
                  type="password"
                  icon={Lock}
                  placeholder="••••••••"
                  error={step2Form.formState.errors.confirmPassword?.message}
                  {...step2Form.register('confirmPassword')}
                />
                <Input
                  label="Phone (optional)"
                  type="tel"
                  icon={Phone}
                  placeholder="+234 800 000 0000"
                  error={step2Form.formState.errors.phone?.message}
                  {...step2Form.register('phone')}
                />
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" icon={ArrowRight}>
                    Continue
                  </Button>
                </div>
              </motion.form>
            )}

            {step === 3 && (
              <motion.form
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={step3Form.handleSubmit(onStep3Submit)}
                className="space-y-4"
              >
                <h1 className="text-2xl font-bold text-surface-900">
                  Terms & conditions
                </h1>
                <p className="text-surface-500">
                  Please review and accept our terms to complete registration
                </p>
                <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 max-h-40 overflow-y-auto">
                  <p>
                    By creating an account, you agree to our Terms of Service and
                    Privacy Policy. You consent to the collection and use of your
                    information as described. The Security Watch is committed to
                    protecting your data and ensuring a secure experience.
                  </p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-surface-300 text-forest-600 focus:ring-forest-500"
                    {...step3Form.register('acceptTerms')}
                  />
                  <span className="text-sm text-surface-700">
                    I have read and accept the terms and conditions
                  </span>
                </label>
                {step3Form.formState.errors.acceptTerms && (
                  <p className="text-sm text-accent-500">
                    {step3Form.formState.errors.acceptTerms.message}
                  </p>
                )}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    loading={isLoading}
                    icon={Check}
                  >
                    Create account
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-8 text-center text-sm text-surface-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-forest-600 hover:text-forest-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
