import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Bell, Save, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatNaira } from '../utils/helpers';

type StoreSettings = {
  id: string; store_name: string; store_email: string; store_phone: string; store_address: string;
  currency: string; free_shipping_threshold: number; standard_shipping_fee: number; express_shipping_fee: number;
  tax_rate: number; maintenance_mode: boolean; notify_new_order: boolean; notify_payment: boolean; notify_low_stock: boolean; notify_new_review: boolean;
};
const defaults: StoreSettings = { id: '', store_name: 'Vast Nation', store_email: '', store_phone: '', store_address: '', currency: 'NGN', free_shipping_threshold: 100, standard_shipping_fee: 2500, express_shipping_fee: 5000, tax_rate: 0, maintenance_mode: false, notify_new_order: true, notify_payment: true, notify_low_stock: true, notify_new_review: true };

export default function AdminSettings() {
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<StoreSettings>(defaults);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  useEffect(() => { if (!user || profile?.role !== 'admin') return; (async () => { const { data, error } = await supabase.from('store_settings').select('*').limit(1).maybeSingle(); if (error) toast('Failed to load store settings', 'error'); else if (data) setSettings(data as StoreSettings); setLoading(false); })(); }, [user, profile?.role, toast]);

  const update = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const save = async () => { if (!user) return; setSaving(true); const payload = { ...settings, id: settings.id || undefined, updated_by: user.id }; const { data, error } = await supabase.from('store_settings').upsert(payload, { onConflict: 'id' }).select().single(); setSaving(false); if (error) toast(error.message, 'error'); else { setSettings(data as StoreSettings); toast('Store settings saved successfully', 'success'); } };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center text-ink-400">Loading settings…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return <div className="section-padding py-10 min-h-screen"><div className="max-w-4xl mx-auto">
    <div className="flex items-center justify-between gap-4 mb-8"><div><Link to="/admin" className="text-xs text-ink-400 hover:text-gold-400 flex items-center gap-1 mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Back to Admin</Link><h1 className="font-display text-3xl font-bold text-white">Store Settings</h1><p className="text-sm text-ink-400 mt-1">Control store behavior and admin notifications.</p></div><button onClick={() => void save()} disabled={saving} className="btn-gold px-5 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}</button></div>
    <section className="glass rounded-2xl p-6 mb-6"><div className="flex items-center gap-3 mb-5"><Store className="text-gold-400" /><div><h2 className="font-semibold text-white">Store Information</h2><p className="text-xs text-ink-400">These values can be used throughout checkout and customer communications.</p></div></div><div className="grid sm:grid-cols-2 gap-4">{([['store_name','Store name'],['store_email','Store email'],['store_phone','Store phone'],['currency','Currency']] as const).map(([key,label]) => <label key={key} className="text-sm text-ink-300">{label}<input className="input-field mt-2" value={settings[key] as string} onChange={(e) => update(key,e.target.value)} /></label>)}<label className="sm:col-span-2 text-sm text-ink-300">Store address<textarea className="input-field mt-2 min-h-24" value={settings.store_address} onChange={(e) => update('store_address',e.target.value)} /></label></div></section>
    <section className="glass rounded-2xl p-6 mb-6"><h2 className="font-semibold text-white mb-5">Shipping & Tax</h2><div className="grid sm:grid-cols-2 gap-4">{([['free_shipping_threshold','Free shipping threshold'],['standard_shipping_fee','Standard shipping fee'],['express_shipping_fee','Express shipping fee'],['tax_rate','Tax rate (%)']] as const).map(([key,label]) => <label key={key} className="text-sm text-ink-300">{label}<input type="number" min="0" className="input-field mt-2" value={settings[key] as number} onChange={(e) => update(key,Number(e.target.value))} /><span className="text-[11px] text-ink-500 mt-1 block">{key !== 'tax_rate' ? formatNaira(Number(settings[key])) : `${settings[key]}%`}</span></label>)}</div></section>
    <section className="glass rounded-2xl p-6"><div className="flex items-center gap-3 mb-5"><Bell className="text-gold-400" /><div><h2 className="font-semibold text-white">Admin Notifications</h2><p className="text-xs text-ink-400">These switches control whether database events create admin notifications.</p></div></div>{([['notify_new_order','New orders','Notify when a new order is created.'],['notify_payment','Successful payments','Notify when Paystack payment is confirmed.'],['notify_low_stock','Low stock','Notify when a product reaches low stock.'],['notify_new_review','New reviews','Notify when a customer submits a review.']] as const).map(([key,title,desc]) => <label key={key} className="flex items-center justify-between gap-4 py-4 border-b last:border-0 border-white/5 cursor-pointer"><div><div className="text-sm text-white font-medium">{title}</div><div className="text-xs text-ink-500 mt-1">{desc}</div></div><input type="checkbox" className="accent-gold-400 w-5 h-5" checked={settings[key]} onChange={(e) => update(key,e.target.checked)} /></label>)}<label className="flex items-center justify-between gap-4 py-4 cursor-pointer"><div><div className="text-sm text-white font-medium">Maintenance mode</div><div className="text-xs text-ink-500 mt-1">Enable this only when you intentionally want to take the storefront offline.</div></div><input type="checkbox" className="accent-gold-400 w-5 h-5" checked={settings.maintenance_mode} onChange={(e) => update('maintenance_mode',e.target.checked)} /></label></section>
  </div></div>;
}
