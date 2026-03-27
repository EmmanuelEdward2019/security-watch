import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Shield, Moon, Smartphone, Trash2, Lock } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [caseUpdates, setCaseUpdates] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [twoFactor, setTwoFactor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
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

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    toast.error('Account deletion is not implemented. Contact support.');
    setDeleting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Settings</h1>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Bell size={20} /> Notification Preferences
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-surface-700">Email notifications</span>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-surface-700">Push notifications</span>
            <input
              type="checkbox"
              checked={pushNotifications}
              onChange={(e) => setPushNotifications(e.target.checked)}
              className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-surface-700">Case updates</span>
            <input
              type="checkbox"
              checked={caseUpdates}
              onChange={(e) => setCaseUpdates(e.target.checked)}
              className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-surface-700">Payment alerts</span>
            <input
              type="checkbox"
              checked={paymentAlerts}
              onChange={(e) => setPaymentAlerts(e.target.checked)}
              className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
        </CardContent>
      </Card>

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
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button onClick={handleChangePassword} loading={changingPassword} disabled={!newPassword || !confirmPassword}>
            Update Password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Shield size={20} /> Privacy
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-surface-700">Show my activity to others</span>
            <input
              type="checkbox"
              checked={showActivity}
              onChange={(e) => setShowActivity(e.target.checked)}
              className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Moon size={20} /> Theme
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  theme === t ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-sm text-surface-500 mt-2">Theme preference (placeholder)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Smartphone size={20} /> Two-Factor Authentication
          </h2>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-surface-700">Enable 2FA</span>
            <input
              type="checkbox"
              checked={twoFactor}
              onChange={(e) => setTwoFactor(e.target.checked)}
              className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <p className="text-sm text-surface-500 mt-2">2FA toggle (placeholder)</p>
        </CardContent>
      </Card>

      <Card className="border-accent-200">
        <CardHeader>
          <h2 className="font-semibold text-accent-700 flex items-center gap-2">
            <Trash2 size={20} /> Delete Account
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-surface-600">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Input
            placeholder="Type DELETE to confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="danger" onClick={handleDeleteAccount} loading={deleting} disabled={deleteConfirm !== 'DELETE'}>
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
