import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, User, ShoppingBag, Heart, MapPin, CreditCard, Settings, LogOut, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { getOrders, getOrderItems, getAddresses, getPayments, updateProfile, addAddress, deleteAddress } from '../services/api';
import { formatNaira, formatDate, classNames } from '../utils/helpers';
import type { Order, OrderItem, Address, Payment } from '../types';

type Tab = 'dashboard' | 'profile' | 'orders' | 'wishlist' | 'addresses' | 'payments' | 'settings';

export default function Dashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // New address form
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({
    full_name: '', phone: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'Nigeria',
  });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getOrders(user.id),
      getAddresses(user.id),
      getPayments(user.id),
    ]).then(([o, a, p]) => {
      setOrders(o);
      setAddresses(a);
      setPayments(p);
      o.forEach((order) => {
        getOrderItems(order.id).then((items) => {
          setOrderItems((prev) => ({ ...prev, [order.id]: items }));
        });
      });
    }).finally(() => setLoading(false));

    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [user, profile]);

  if (!user) return <Navigate to="/login" replace />;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile(user.id, { full_name: fullName, phone });
      await refreshProfile();
      toast('Profile updated!');
    } catch {
      toast('Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAddress({ ...addrForm, user_id: user.id, is_default: false });
      const updated = await getAddresses(user.id);
      setAddresses(updated);
      setShowAddrForm(false);
      setAddrForm({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'Nigeria' });
      toast('Address added!');
    } catch {
      toast('Failed to add address', 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast('Address removed');
    } catch {
      toast('Failed to remove address', 'error');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast('Signed out successfully');
  };

  const menuItems = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'orders' as Tab, label: 'Orders', icon: ShoppingBag },
    { id: 'wishlist' as Tab, label: 'Wishlist', icon: Heart },
    { id: 'addresses' as Tab, label: 'Addresses', icon: MapPin },
    { id: 'payments' as Tab, label: 'Payment History', icon: CreditCard },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  const totalSpent = payments.filter((p) => p.status === 'success').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="section-padding py-8 lg:py-12">
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-28">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
              <div className="w-12 h-12 rounded-full bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-400 font-bold text-lg">
                {(profile?.full_name?.[0] ?? user.email[0]).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'Member'}</p>
                <p className="text-xs text-ink-400 truncate">{user.email}</p>
              </div>
            </div>

            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={classNames(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    tab === item.id ? 'bg-gold-400/10 text-gold-400 font-medium' : 'text-ink-300 hover:text-white hover:bg-white/5',
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {item.id === 'wishlist' && wishlistItems.length > 0 && (
                    <span className="ml-auto text-xs bg-gold-400/20 text-gold-400 px-2 py-0.5 rounded-full">
                      {wishlistItems.length}
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="lg:col-span-3">
          {tab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Dashboard</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Orders', value: orders.length, icon: Package, color: 'text-blue-400' },
                  { label: 'Total Spent', value: formatNaira(totalSpent), icon: CreditCard, color: 'text-gold-400' },
                  { label: 'Wishlist Items', value: wishlistItems.length, icon: Heart, color: 'text-red-400' },
                  { label: 'Saved Addresses', value: addresses.length, icon: MapPin, color: 'text-green-400' },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-2xl p-5"
                  >
                    <stat.icon className={classNames('w-6 h-6 mb-3', stat.color)} />
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-ink-400 mt-1">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-white mb-4">Recent Orders</h2>
                {loading ? (
                  <div className="glass rounded-2xl p-6 animate-pulse h-32" />
                ) : orders.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <Package className="w-10 h-10 text-ink-500 mx-auto mb-3" />
                    <p className="text-ink-400 text-sm mb-4">No orders yet</p>
                    <Link to="/shop" className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider inline-block">
                      Start Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((order) => (
                      <div key={order.id} className="glass rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white font-mono">{order.order_number}</p>
                          <p className="text-xs text-ink-400">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={classNames(
                            'text-xs font-medium px-3 py-1 rounded-full',
                            order.status === 'paid' || order.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                            order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400',
                          )}>
                            {order.status}
                          </span>
                          <span className="text-sm font-bold text-gold-400">{formatNaira(order.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">My Profile</h1>
              <div className="glass rounded-2xl p-6 max-w-lg">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Email (read-only)</label>
                    <input type="email" value={user.email} disabled className="input-field opacity-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Phone</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="+234..." />
                  </div>
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider disabled:opacity-50">
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'orders' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">My Orders</h1>
              {loading ? (
                <div className="glass rounded-2xl p-6 animate-pulse h-32" />
              ) : orders.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <Package className="w-10 h-10 text-ink-500 mx-auto mb-3" />
                  <p className="text-ink-400 text-sm mb-4">No orders yet</p>
                  <Link to="/shop" className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider inline-block">Start Shopping</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="glass rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                        <div>
                          <p className="text-sm font-mono font-medium text-white">{order.order_number}</p>
                          <p className="text-xs text-ink-400">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={classNames(
                            'text-xs font-medium px-3 py-1 rounded-full',
                            order.status === 'paid' || order.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                            order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400',
                          )}>{order.status}</span>
                          <span className="text-lg font-bold text-gold-400">{formatNaira(order.total)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(orderItems[order.id] ?? []).map((item) => (
                          <div key={item.id} className="flex items-center gap-3">
                            {item.image_url && <img src={item.image_url} alt="" className="w-10 h-12 object-cover rounded" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{item.name}</p>
                              <p className="text-xs text-ink-500">{item.size} / {item.color} x{item.quantity}</p>
                            </div>
                            <span className="text-sm text-ink-300">{formatNaira(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'wishlist' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">My Wishlist</h1>
              {wishlistItems.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <Heart className="w-10 h-10 text-ink-500 mx-auto mb-3" />
                  <p className="text-ink-400 text-sm mb-4">Your wishlist is empty</p>
                  <Link to="/shop" className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider inline-block">Browse Products</Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {wishlistItems.map((p) => (
                    <Link key={p.id} to={`/product/${p.slug}`} className="glass rounded-2xl overflow-hidden group">
                      <div className="aspect-[3/4] overflow-hidden">
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-medium text-white truncate">{p.name}</h3>
                        <p className="text-sm text-gold-400 font-medium">{formatNaira(p.price)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'addresses' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl font-bold text-white">My Addresses</h1>
                <button onClick={() => setShowAddrForm((v) => !v)} className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider">
                  Add New
                </button>
              </div>

              {showAddrForm && (
                <form onSubmit={handleAddAddress} className="glass rounded-2xl p-6 mb-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" required placeholder="Full Name" value={addrForm.full_name} onChange={(e) => setAddrForm({ ...addrForm, full_name: e.target.value })} className="input-field" />
                    <input type="tel" required placeholder="Phone" value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} className="input-field" />
                  </div>
                  <input type="text" required placeholder="Address Line 1" value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })} className="input-field" />
                  <input type="text" placeholder="Address Line 2 (Optional)" value={addrForm.line2} onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })} className="input-field" />
                  <div className="grid grid-cols-3 gap-4">
                    <input type="text" required placeholder="City" value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} className="input-field" />
                    <input type="text" required placeholder="State" value={addrForm.state} onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })} className="input-field" />
                    <input type="text" placeholder="Postal Code" value={addrForm.postal_code} onChange={(e) => setAddrForm({ ...addrForm, postal_code: e.target.value })} className="input-field" />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider">Save Address</button>
                    <button type="button" onClick={() => setShowAddrForm(false)} className="btn-outline rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider">Cancel</button>
                  </div>
                </form>
              )}

              {addresses.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <MapPin className="w-10 h-10 text-ink-500 mx-auto mb-3" />
                  <p className="text-ink-400 text-sm">No saved addresses</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="glass rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <MapPin className="w-5 h-5 text-gold-400" />
                        <button onClick={() => handleDeleteAddress(addr.id)} className="text-xs text-ink-500 hover:text-red-400 transition-colors">Remove</button>
                      </div>
                      <p className="text-sm font-medium text-white">{addr.full_name}</p>
                      <p className="text-sm text-ink-400 mt-1">{addr.line1}{addr.line2 && `, ${addr.line2}`}</p>
                      <p className="text-sm text-ink-400">{addr.city}, {addr.state}</p>
                      <p className="text-sm text-ink-400">{addr.country} {addr.postal_code}</p>
                      <p className="text-xs text-ink-500 mt-2">{addr.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'payments' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Payment History</h1>
              {payments.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <CreditCard className="w-10 h-10 text-ink-500 mx-auto mb-3" />
                  <p className="text-ink-400 text-sm">No payment history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="glass rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-gold-400" />
                        <div>
                          <p className="text-sm font-mono text-white">{payment.reference}</p>
                          <p className="text-xs text-ink-400">{formatDate(payment.created_at)} · {payment.channel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={classNames(
                          'text-xs font-medium px-3 py-1 rounded-full',
                          payment.status === 'success' ? 'bg-green-500/20 text-green-400' :
                          payment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400',
                        )}>{payment.status}</span>
                        <span className="text-sm font-bold text-white">{formatNaira(payment.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'settings' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Account Settings</h1>
              <div className="glass rounded-2xl p-6 max-w-lg space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Email Notifications</h3>
                  <p className="text-xs text-ink-400 mb-3">Manage your email preferences</p>
                  {['Order updates', 'New product alerts', 'Newsletter', 'Promotional offers'].map((item) => (
                    <label key={item} className="flex items-center gap-3 py-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-gold-400 w-4 h-4" />
                      <span className="text-sm text-ink-300">{item}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-sm font-semibold text-white mb-2">Danger Zone</h3>
                  <button onClick={handleSignOut} className="text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign out of all devices
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
