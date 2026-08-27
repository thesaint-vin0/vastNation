import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Lock,
  Mail,
  Moon,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getUserSettings,
  updateProfile,
  upsertUserSettings,
  type UserSettings,
} from '../services/api';
import { supabase } from '../lib/supabase';

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id' | 'updated_at'> = {
  order_updates: true,
  payment_updates: true,
  shipping_updates: true,
  product_alerts: false,
  newsletter: true,
  promotional_offers: false,
  theme: 'dark',
};

export default function AccountSettings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;

    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');

    let mounted = true;
    (async () => {
      try {
        const result = await getUserSettings(user.id);
        if (mounted && result) {
          setSettings({
            order_updates: result.order_updates,
            payment_updates: result.payment_updates,
            shipping_updates: result.shipping_updates,
            product_alerts: result.product_alerts,
            newsletter: result.newsletter,
            promotional_offers: result.promotional_offers,
            theme: result.theme,
          });
        }
      } catch (error) {
        console.error('Failed to load account settings:', error);
        if (mounted) toast('Failed to load settings', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, profile, toast]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      await refreshProfile();
      toast('Profile updated successfully');
    } catch (error) {
      console.error(error);
      toast('Could not update your profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    if (key === 'theme') return;
    setSettings((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const saveSettings = async () => {
    if (!user) return;

    setSavingSettings(true);
    try {
      await upsertUserSettings(user.id, settings);
      toast('Preferences saved');
    } catch (error) {
      console.error(error);
      toast('Could not save your preferences', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('Complete all password fields', 'error');
      return;
    }
    if (newPassword.length < 8) {
      toast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }

    setSavingPassword(true);
    try {
      if (!user?.email) throw new Error('No email is associated with this account.');

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error('Your current password is incorrect.');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password changed successfully');
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : 'Could not change password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const signOutEverywhere = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      await signOut();
    } catch (error) {
      console.error(error);
      toast('Could not sign out of all sessions', 'error');
    }
  };

  const deleteAccount = async () => {
    if (!user || deleteConfirm !== 'DELETE') return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: 'DELETE' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Account deletion failed.');

      await supabase.auth.signOut({ scope: 'global' });
      toast('Your account has been deleted');
      window.location.href = '/';
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : 'Could not delete your account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const preferenceRows: Array<{
    key: keyof typeof settings;
    label: string;
    description: string;
  }> = [
    { key: 'order_updates', label: 'Order updates', description: 'Receive updates when your order status changes.' },
    { key: 'payment_updates', label: 'Payment updates', description: 'Receive payment confirmation and payment status alerts.' },
    { key: 'shipping_updates', label: 'Shipping updates', description: 'Get notified when your order ships or is delivered.' },
    { key: 'product_alerts', label: 'Product alerts', description: 'Hear about restocks and new products.' },
    { key: 'newsletter', label: 'Newsletter', description: 'Receive the Vast Nation newsletter.' },
    { key: 'promotional_offers', label: 'Promotional offers', description: 'Receive discounts and promotional campaigns.' },
  ];

  if (loading) {
    return <div className="glass rounded-2xl p-8 text-center text-ink-400">Loading account settings…</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Account Settings</h1>
        <p className="text-ink-400 text-sm mt-2">Manage your profile, notifications, security and account preferences.</p>
      </div>

      <form onSubmit={saveProfile} className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-gold-400" />
          <div>
            <h2 className="font-semibold text-white">Profile</h2>
            <p className="text-xs text-ink-500">Your customer information</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-ink-400">Full name</span>
            <input className="input-field mt-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-ink-400">Phone</span>
            <input className="input-field mt-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs text-ink-400">Email</span>
            <div className="input-field mt-2 flex items-center gap-2 opacity-70">
              <Mail className="w-4 h-4" />
              {user?.email}
            </div>
            <p className="text-[11px] text-ink-500 mt-2">Email changes should be handled through Supabase email confirmation.</p>
          </label>
        </div>

        <button disabled={savingProfile} className="btn-gold rounded-lg px-5 py-3 mt-5 text-sm">
          {savingProfile ? 'Saving…' : 'Save Profile'}
        </button>
      </form>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-gold-400" />
          <div>
            <h2 className="font-semibold text-white">Notifications</h2>
            <p className="text-xs text-ink-500">Choose what Vast Nation can send you.</p>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {preferenceRows.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleSetting(item.key)}
              className="w-full flex items-center justify-between gap-4 py-4 text-left"
            >
              <span>
                <span className="block text-sm text-white">{item.label}</span>
                <span className="block text-xs text-ink-500 mt-1">{item.description}</span>
              </span>
              <span className={`w-11 h-6 rounded-full p-1 transition ${settings[item.key] ? 'bg-gold-400' : 'bg-ink-700'}`}>
                <span className={`block w-4 h-4 rounded-full bg-white transition ${settings[item.key] ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          ))}
        </div>

        <button onClick={saveSettings} disabled={savingSettings} className="btn-gold rounded-lg px-5 py-3 mt-5 text-sm">
          {savingSettings ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>

      <form onSubmit={changePassword} className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-5 h-5 text-gold-400" />
          <div>
            <h2 className="font-semibold text-white">Security</h2>
            <p className="text-xs text-ink-500">Change your account password.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <input className="input-field" type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <input className="input-field" type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input className="input-field" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button disabled={savingPassword} className="btn-outline rounded-lg px-5 py-3 mt-5 text-sm">
          {savingPassword ? 'Updating…' : 'Change Password'}
        </button>
      </form>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-gold-400" />
          <div>
            <h2 className="font-semibold text-white">Sessions</h2>
            <p className="text-xs text-ink-500">Sign out everywhere if you no longer trust a session.</p>
          </div>
        </div>
        <button type="button" onClick={() => void signOutEverywhere()} className="btn-outline rounded-lg px-5 py-3 text-sm">
          Sign out of all devices
        </button>
      </div>

      <div className="glass rounded-2xl p-6 border border-red-500/20">
        <div className="flex items-center gap-3 mb-3">
          <Trash2 className="w-5 h-5 text-red-400" />
          <h2 className="font-semibold text-white">Delete account</h2>
        </div>
        <p className="text-sm text-ink-400 mb-4">This permanently deletes your profile, addresses, orders and account access.</p>
        {!showDelete ? (
          <button type="button" onClick={() => setShowDelete(true)} className="text-sm text-red-400 hover:text-red-300">
            Delete my account
          </button>
        ) : (
          <div className="space-y-3 max-w-md">
            <p className="text-xs text-ink-500">Type DELETE to confirm.</p>
            <input className="input-field" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowDelete(false); setDeleteConfirm(''); }} className="btn-outline rounded-lg px-4 py-2 text-sm">
                <X className="w-4 h-4 inline mr-1" /> Cancel
              </button>
              <button type="button" disabled={deleteConfirm !== 'DELETE' || deleting} onClick={() => void deleteAccount()} className="rounded-lg px-4 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                <Trash2 className="w-4 h-4 inline mr-1" /> {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Moon className="w-5 h-5 text-gold-400" />
          <div>
            <h2 className="font-semibold text-white">Theme preference</h2>
            <p className="text-xs text-ink-500">Saved for future UI theme support.</p>
          </div>
        </div>
        <select
          className="input-field max-w-xs"
          value={settings.theme}
          onChange={(e) => setSettings((p) => ({ ...p, theme: e.target.value as UserSettings['theme'] }))}
        >
          <option value="dark">Dark</option>
          <option value="system">System</option>
          <option value="light">Light</option>
        </select>
      </div>
    </motion.div>
  );
}
