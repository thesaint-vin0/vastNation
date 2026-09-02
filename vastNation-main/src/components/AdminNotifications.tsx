import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { classNames } from '../utils/helpers';

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export default function AdminNotifications() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user || profile?.role !== 'admin') return;
    const { data } = await supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(30);
    if (data) setItems(data as AdminNotification[]);
  }, [user, profile?.role]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;
    const channel = supabase.channel(`admin-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, (payload: unknown) => {
        const notification = (payload as { new: AdminNotification }).new;
        setItems((current: AdminNotification[]) => [notification, ...current].slice(0, 30));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, profile?.role]);

  const unread = items.filter((item) => !item.read_at).length;

  const markRead = async (id: string) => {
    const { error } = await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (!error) setItems((current: AdminNotification[]) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  };

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    if (!error) setItems((current: AdminNotification[]) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  };

  if (profile?.role !== 'admin') return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className="relative min-w-10 min-h-10 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-ink-300 hover:text-white flex items-center justify-center touch-manipulation"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-gold-400 text-ink-950 text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed left-2 right-2 top-16 z-[100] w-auto max-w-none glass rounded-2xl shadow-2xl overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[380px] sm:max-w-[calc(100vw-2rem)]"
          role="dialog"
          aria-label="Admin notifications"
        >
          <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate">Notifications</h3>
              <p className="text-xs text-ink-400 truncate">Live admin activity</p>
            </div>

            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!unread}
              className="shrink-0 text-xs text-gold-400 hover:text-gold-300 disabled:text-ink-600 disabled:cursor-not-allowed flex items-center gap-1 min-h-9 px-2 touch-manipulation"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Read all</span>
            </button>
          </div>

          <div className="max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain">
            {!items.length && (
              <div className="p-8 text-center text-sm text-ink-400">
                No notifications yet.
              </div>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void markRead(item.id)}
                className={classNames(
                  'w-full text-left p-3 sm:p-4 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition touch-manipulation',
                  !item.read_at && 'bg-gold-400/5',
                )}
              >
                <div className="flex gap-3">
                  <div
                    className="mt-1.5 w-2 h-2 rounded-full bg-gold-400 shrink-0"
                    style={{ opacity: item.read_at ? 0 : 1 }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-white text-sm leading-5 break-words">
                        {item.title}
                      </span>
                      {item.read_at && (
                        <Check className="w-3.5 h-3.5 text-ink-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    <p className="text-xs text-ink-400 mt-1 leading-5 break-words">
                      {item.message}
                    </p>

                    <p className="text-[10px] text-ink-500 mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
