import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  Shield,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Trash2,
  Lock,
  CheckCircle2,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { checkPassword, PASSWORD_MIN_LENGTH } from '@/lib/password';

// ── Theme helpers ──────────────────────────────────────────────────────────
type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('tsw-theme', theme);
}

// ── Notification prefs ─────────────────────────────────────────────────────
const PREFS_KEY = 'tsw-notification-prefs';

interface NotificationPrefs {
  emailNotifications: boolean;
  pushNotifications: boolean;
  caseUpdates: boolean;
  paymentAlerts: boolean;
}

function loadPrefs(): NotificationPrefs {
  try {
    return { emailNotifications: true, pushNotifications: true, caseUpdates: true, paymentAlerts: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch { return { emailNotifications: true, pushNotifications: true, caseUpdates: true, paymentAlerts: true }; }
}

function savePrefs(p: NotificationPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// ── 2FA TOTP helpers ───────────────────────────────────────────────────────
interface MfaFactor { id: string; factor_type: string; status: string; }

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const requestAccountDeletion = useAuthStore((s) => s.requestAccountDeletion);
  const navigate = useNavigate();

  // --- Notification prefs ---
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // --- Theme ---
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('tsw-theme') as Theme) ?? 'system'
  );

  // --- Password ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // --- 2FA ---
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrollData, setEnrollData] = useState<{ qrCode: string; secret: string; factorId: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [verifyingTotp, setVerifyingTotp] = useState(false);

  // --- Account deletion ---
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sync theme on mount
  useEffect(() => { applyTheme(theme); }, []);

  // Check if 2FA is already enabled
  useEffect(() => {
    async function checkMfa() {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = (data?.totp ?? []).filter((f: MfaFactor) => f.status === 'verified');
      setMfaEnabled(verified.length > 0);
    }
    checkMfa();
  }, []);

  // ── Notification prefs ────────────────────────────────────────────────
  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    savePrefs(prefs);
    await new Promise((r) => setTimeout(r, 300)); // small visual feedback
    setSavingPrefs(false);
    toast.success('Notification preferences saved.');
  };

  const updatePref = (key: keyof NotificationPrefs, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
  };

  // ── Theme ─────────────────────────────────────────────────────────────
  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    toast.success(`Theme set to ${t}.`);
  };

  // ── Password ──────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    const strength = checkPassword(newPassword);
    if (!strength.acceptable) {
      toast.error(strength.issues[0]);
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // ── 2FA enroll ────────────────────────────────────────────────────────
  const handleEnable2FA = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'The Security Watch',
      });
      if (error) throw error;
      setEnrollData({
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not start 2FA setup');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyTotp = async () => {
    if (!enrollData) return;
    setVerifyingTotp(true);
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challengeData.id,
        code: totpCode,
      });
      if (verifyErr) throw verifyErr;

      setMfaEnabled(true);
      setEnrollData(null);
      setTotpCode('');
      toast.success('Two-factor authentication enabled!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invalid code. Try again.');
    } finally {
      setVerifyingTotp(false);
    }
  };

  const handleDisable2FA = async () => {
    setMfaLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const factors = (data?.totp ?? []) as MfaFactor[];
      for (const f of factors) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      setMfaEnabled(false);
      toast.success('Two-factor authentication disabled.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to disable 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  // ── Account deletion ──────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    // Raised through an RPC that notifies every administrator. The previous
    // client-side insert failed silently and "notified" the departing user, so
    // erasure requests were dropped without anyone seeing them.
    const { error } = await requestAccountDeletion();
    setDeleting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(
        'Your deletion request has been sent to our administrators and you have been signed out. We will confirm by email once your data is erased.'
      );
      navigate('/login');
    }
  };

  const THEME_OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Settings</h1>

      {/* ── Notification preferences ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Bell size={20} /> Notification Preferences
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              { key: 'emailNotifications', label: 'Email notifications' },
              { key: 'pushNotifications', label: 'In-app push notifications' },
              { key: 'caseUpdates', label: 'Case status updates' },
              { key: 'paymentAlerts', label: 'Payment & payout alerts' },
            ] as { key: keyof NotificationPrefs; label: string }[]
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-surface-700">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => updatePref(key, !prefs[key])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                  prefs[key] ? 'bg-brand-500' : 'bg-surface-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    prefs[key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          ))}
          <Button size="sm" loading={savingPrefs} onClick={handleSavePrefs} className="mt-2">
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      {/* ── Theme ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Moon size={20} /> Appearance
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-surface-500 mb-3">
            Choose how The Security Watch looks on your device.
          </p>
          <div className="flex gap-3">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 py-4 text-sm font-medium transition-all ${
                  theme === value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-surface-200 hover:border-surface-300 text-surface-600'
                }`}
              >
                <Icon size={20} />
                {label}
                {theme === value && <CheckCircle2 size={14} className="text-brand-500" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Change password ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Lock size={20} /> Change Password
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="New Password"
            type="password"
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button
            onClick={handleChangePassword}
            loading={changingPassword}
            disabled={!newPassword || !confirmPassword}
          >
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* ── Two-factor authentication ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Smartphone size={20} /> Two-Factor Authentication (2FA)
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-brand-600">
                <CheckCircle2 size={18} />
                <span className="font-medium">2FA is enabled on your account</span>
              </div>
              <p className="text-sm text-surface-500">
                Your account is protected with an authenticator app (TOTP).
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisable2FA}
                loading={mfaLoading}
              >
                Disable 2FA
              </Button>
            </div>
          ) : enrollData ? (
            <div className="space-y-4">
              <p className="text-sm text-surface-600">
                Scan the QR code below with your authenticator app (Google Authenticator,
                Authy, etc.), then enter the 6-digit code to confirm.
              </p>
              <div className="flex flex-col items-center gap-3 p-4 bg-surface-50 rounded-xl border">
                <img src={enrollData.qrCode} alt="TOTP QR code" className="w-40 h-40" />
                <div className="flex items-center gap-2 text-xs text-surface-500 font-mono bg-white border rounded px-3 py-1.5">
                  <span className="truncate max-w-[200px]">{enrollData.secret}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(enrollData.secret);
                      toast.success('Secret copied');
                    }}
                    aria-label="Copy secret"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  label="6-digit code"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleVerifyTotp}
                  loading={verifyingTotp}
                  disabled={totpCode.length !== 6}
                >
                  Verify &amp; Enable
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setEnrollData(null); setTotpCode(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">
                Add an extra layer of security. Once enabled, you will need a code from your
                authenticator app every time you sign in.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnable2FA}
                loading={mfaLoading}
              >
                Set Up 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Privacy ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Shield size={20} /> Privacy
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-surface-500">
            Your data is encrypted in transit and at rest. We never share personally identifiable
            information without your explicit consent.
          </p>
          <div className="flex items-center gap-2 text-sm text-surface-600">
            <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
            End-to-end encrypted case communications
          </div>
          <div className="flex items-center gap-2 text-sm text-surface-600">
            <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
            Evidence files stored in private, access-controlled buckets
          </div>
          <div className="flex items-center gap-2 text-sm text-surface-600">
            <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
            Payments processed by Paystack — card details never reach our servers
          </div>
        </CardContent>
      </Card>

      {/* ── Delete account ────────────────────────────────────────────── */}
      <Card className="border-red-200">
        <CardHeader>
          <h2 className="font-semibold text-red-700 flex items-center gap-2">
            <Trash2 size={20} /> Delete Account
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              Requesting deletion will immediately sign you out and submit a deletion request to
              our team. Your data will be permanently removed within 30 days. This action cannot
              be undone.
            </p>
          </div>
          <p className="text-sm text-surface-600">
            Deleting as: <strong>{user?.email}</strong>
          </p>
          <Button
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
          >
            Request Account Deletion
          </Button>
        </CardContent>
      </Card>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
        title="Confirm Account Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            This is a permanent and irreversible action. Type{' '}
            <strong className="font-mono">DELETE</strong> below to confirm.
          </p>
          <Input
            placeholder="Type DELETE to confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={deleting}
              disabled={deleteConfirm !== 'DELETE'}
              className="flex-1"
            >
              Delete My Account
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
