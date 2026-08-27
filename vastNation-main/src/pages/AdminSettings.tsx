import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Bell, CreditCard, Settings, Store, User, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getStoreSettings,
  updateProfile,
  upsertStoreSettings,
  type StoreSettings,
} from '../services/api';

const DEFAULTS: Omit<StoreSettings, 'id' | 'updated_by' | 'updated_at'> = {
  store_name: 'Vast Nation',
  store_email: '',
  store_phone: '',
  store_address: '',
  currency: 'NGN',
  shipping_threshold: 100000,
  default_shipping_fee: 2500,
  express_shipping_fee: 5000,
  tax_rate: 0,
  maintenance_mode: false,
  notify_new_order: true,
  notify_payment: true,
  notify_low_stock: true,
  notify_new_review: true,
};

export default function AdminSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [store, setStore] = useState(DEFAULTS);
  const [adminName, setAdminName] = useState(profile?.full_name ?? '');
  const [adminPhone, setAdminPhone] = useState(profile?.phone ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;

    setAdminName(profile.full_name ?? '');
    setAdminPhone(profile.phone ?? '');

    let mounted = true;
    (async () => {
      try {
        const result = await getStoreSettings();
        if (mounted && result) {
          setStore({
            store_name: result.store_name,
            store_email: result.store_email,
            store_phone: result.store_phone,
            store_address: result.store_address,
            currency: result.currency,
            shipping_threshold: Number(result.shipping_threshold),
            default_shipping_fee: Number(result.default_shipping_fee),
            express_shipping_fee: Number(result.express_shipping_fee),
            tax_rate: Number(result.tax_rate),
            maintenance_mode: result.maintenance_mode,
            notify_new_order: result.notify_new_order,
            notify_payment: result.notify_payment,
            notify_low_stock: result.notify_low_stock,
            notify_new_review: result.notify_new_review,
          });
        }
      } catch (error) {
        console.error(error);
        if (mounted) toast('Could not load store settings', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, profile, toast]);

  if (!user) return <Navigate to="/login" replace />;
  if (!profile || profile.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const saveAdminProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        full_name: adminName.trim() || null,
        phone: adminPhone.trim() || null,
      });
      await refreshProfile();
      toast('Admin profile updated');
    } catch (error) {
      console.error(error);
      toast('Could not update admin profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveStore = async () => {

    if (store.shipping_threshold < 0 || store.default_shipping_fee < 0 || store.express_shipping_fee < 0) {
      toast('Shipping values cannot be negative', 'error');
      return;
    }
    if (store.tax_rate < 0 || store.tax_rate > 100) {
      toast('Tax rate must be between 0 and 100', 'error');
      return;
    }

    setSaving(true);
    try {
      await upsertStoreSettings(store, user.id);
      toast('Store settings saved');
    } catch (error) {
      console.error(error);
      toast('Could not save store settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-ink-400">Loading admin settings…</div>;
  }

  const toggle = (key: 'maintenance_mode' | 'notify_new_order' | 'notify_payment' | 'notify_low_stock' | 'notify_new_review') => {
    setStore((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  return (
    <div className="section-padding py-8 lg:py-12">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <Link to="/admin" className="text-sm text-ink-400 hover:text-gold-400 inline-flex items-center gap-2 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-white">Admin Settings</h1>
          <p className="text-ink-400 mt-2 text-sm">Manage your administrator profile and store configuration.</p>
        </div>
        <Settings className="w-8 h-8 text-gold-400" />
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <form onSubmit={saveAdminProfile} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-gold-400" />
            <div>
              <h2 className="font-semibold text-white">Admin Profile</h2>
              <p className="text-xs text-ink-500">Your administrator identity.</p>
            </div>
          </div>
          <label className="block mb-4">
            <span className="text-xs text-ink-400">Admin email</span>
            <input className="input-field mt-2 opacity-70" value={user.email ?? ''} disabled />
          </label>
          <label className="block mb-4">
            <span className="text-xs text-ink-400">Full name</span>
            <input className="input-field mt-2" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </label>
          <label className="block mb-4">
            <span className="text-xs text-ink-400">Phone</span>
            <input className="input-field mt-2" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
          </label>
          <button disabled={savingProfile} className="btn-gold rounded-lg px-5 py-3 text-sm">
            {savingProfile ? 'Saving…' : 'Save Admin Profile'}
          </button>
        </form>

        <form onSubmit={(event) => { event.preventDefault(); void saveStore(); }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Store className="w-5 h-5 text-gold-400" />
            <div>
              <h2 className="font-semibold text-white">Store Information</h2>
              <p className="text-xs text-ink-500">Customer-facing business details.</p>
            </div>
          </div>
          <div className="space-y-4">
            <input className="input-field" placeholder="Store name" value={store.store_name} onChange={(e) => setStore((p) => ({ ...p, store_name: e.target.value }))} />
            <input className="input-field" type="email" placeholder="Store email" value={store.store_email} onChange={(e) => setStore((p) => ({ ...p, store_email: e.target.value }))} />
            <input className="input-field" placeholder="Store phone" value={store.store_phone} onChange={(e) => setStore((p) => ({ ...p, store_phone: e.target.value }))} />
            <textarea className="input-field resize-none" rows={3} placeholder="Store address" value={store.store_address} onChange={(e) => setStore((p) => ({ ...p, store_address: e.target.value }))} />
          </div>
        </form>

        <form onSubmit={(event) => { event.preventDefault(); void saveStore(); }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-5 h-5 text-gold-400" />
            <div>
              <h2 className="font-semibold text-white">Payments, Shipping & Tax</h2>
              <p className="text-xs text-ink-500">Defaults used by the storefront.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label><span className="text-xs text-ink-400">Currency</span><input className="input-field mt-2" value={store.currency} onChange={(e) => setStore((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} /></label>
            <label><span className="text-xs text-ink-400">Free shipping threshold (₦)</span><input className="input-field mt-2" type="number" min="0" value={store.shipping_threshold} onChange={(e) => setStore((p) => ({ ...p, shipping_threshold: Number(e.target.value) }))} /></label>
            <label><span className="text-xs text-ink-400">Standard shipping (₦)</span><input className="input-field mt-2" type="number" min="0" value={store.default_shipping_fee} onChange={(e) => setStore((p) => ({ ...p, default_shipping_fee: Number(e.target.value) }))} /></label>
            <label><span className="text-xs text-ink-400">Express shipping (₦)</span><input className="input-field mt-2" type="number" min="0" value={store.express_shipping_fee} onChange={(e) => setStore((p) => ({ ...p, express_shipping_fee: Number(e.target.value) }))} /></label>
            <label><span className="text-xs text-ink-400">Tax rate (%)</span><input className="input-field mt-2" type="number" min="0" max="100" step="0.01" value={store.tax_rate} onChange={(e) => setStore((p) => ({ ...p, tax_rate: Number(e.target.value) }))} /></label>
          </div>
          <button disabled={saving} className="btn-gold rounded-lg px-5 py-3 mt-6 text-sm">
            {saving ? 'Saving…' : 'Save Store Settings'}
          </button>
        </form>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-gold-400" />
            <div>
              <h2 className="font-semibold text-white">Notifications & Store Controls</h2>
              <p className="text-xs text-ink-500">Turn administrative notifications on or off.</p>
            </div>
          </div>
          {([
            ['notify_new_order', 'New order notifications'],
            ['notify_payment', 'Payment notifications'],
            ['notify_low_stock', 'Low stock notifications'],
            ['notify_new_review', 'New review notifications'],
            ['maintenance_mode', 'Maintenance mode'],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => toggle(key)} className="w-full flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <span className="text-sm text-white">{label}</span>
              <span className={`w-11 h-6 rounded-full p-1 ${store[key] ? 'bg-gold-400' : 'bg-ink-700'}`}>
                <span className={`block w-4 h-4 rounded-full bg-white transition ${store[key] ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          ))}
          <button onClick={() => void saveStore()} disabled={saving} className="btn-gold rounded-lg px-5 py-3 mt-6 text-sm">
            Save Controls
          </button>
        </div>

        <div className="glass rounded-2xl p-6 xl:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-5 h-5 text-gold-400" />
            <h2 className="font-semibold text-white">Payment Security</h2>
          </div>
          <p className="text-sm text-ink-400">
            Paystack secret keys remain inside Supabase Edge Functions. Never place the secret key in Vite environment variables or React code.
          </p>
        </div>
      </div>
    </div>
  );
}
