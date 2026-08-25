import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  User,
  ShoppingBag,
  Heart,
  MapPin,
  CreditCard,
  Settings,
  LogOut,
  Package,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';

import {
  getOrders,
  getOrderItems,
  getAddresses,
  getPayments,
  updateProfile,
  addAddress,
  deleteAddress,
} from '../services/api';

import {
  formatNaira,
  formatDate,
  classNames,
} from '../utils/helpers';

import { supabase } from '../lib/supabase';

import type {
  Order,
  OrderItem,
  Address,
  Payment,
} from '../types';

type Tab =
  | 'dashboard'
  | 'profile'
  | 'orders'
  | 'wishlist'
  | 'addresses'
  | 'payments'
  | 'settings';

export default function Dashboard() {
  const {
    user,
    profile,
    signOut,
    refreshProfile,
  } = useAuth();

  const { items: wishlistItems } = useWishlist();
  const { toast } = useToast();

  const [tab, setTab] =
    useState<Tab>('dashboard');

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [orderItems, setOrderItems] =
    useState<Record<string, OrderItem[]>>({});

  const [loading, setLoading] =
    useState(true);

  const [fullName, setFullName] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [savingProfile, setSavingProfile] =
    useState(false);

  // New address form
  const [showAddrForm, setShowAddrForm] =
    useState(false);

  const [addrForm, setAddrForm] = useState({
    full_name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Nigeria',
  });

  /*
   * ============================================================
   * LOAD CUSTOMER DATA
   * ============================================================
   */

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    setLoading(true);

    Promise.all([
      getOrders(user.id),
      getAddresses(user.id),
      getPayments(user.id),
    ])
      .then(([o, a, p]) => {
        if (!mounted) return;

        setOrders(o);
        setAddresses(a);
        setPayments(p);

        o.forEach((order) => {
          getOrderItems(order.id)
            .then((items) => {
              if (!mounted) return;

              setOrderItems((prev) => ({
                ...prev,
                [order.id]: items,
              }));
            })
            .catch((error) => {
              console.error(
                'Failed to load order items:',
                error,
              );
            });
        });
      })
      .catch((error) => {
        console.error(
          'Failed to load dashboard data:',
          error,
        );

        if (mounted) {
          toast(
            'Failed to load dashboard data',
            'error',
          );
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    if (profile) {
      setFullName(
        profile.full_name ?? '',
      );

      setPhone(
        profile.phone ?? '',
      );
    }

    return () => {
      mounted = false;
    };
  }, [user, profile, toast]);

  /*
   * ============================================================
   * CUSTOMER ORDER REALTIME
   * ============================================================
   *
   * Keeps the customer's order status and payment status
   * synchronized with Supabase in realtime.
   */

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(
        `customer-orders-${user.id}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log(
            'CUSTOMER ORDER REALTIME:',
            payload,
          );

          /*
           * New order
           */
          if (payload.eventType === 'INSERT') {
            const newOrder =
              payload.new as Order;

            setOrders((currentOrders) => {
              if (
                currentOrders.some(
                  (order) =>
                    order.id === newOrder.id,
                )
              ) {
                return currentOrders;
              }

              return [
                newOrder,
                ...currentOrders,
              ];
            });
          }

          /*
           * Updated order
           *
           * This is especially important for:
           *
           * payment_status = paid
           *
           * and:
           *
           * status = processing/shipping/delivered
           */
          if (payload.eventType === 'UPDATE') {
            const updatedOrder =
              payload.new as Order;

            setOrders((currentOrders) =>
              currentOrders.map((order) =>
                order.id === updatedOrder.id
                  ? {
                      ...order,
                      ...updatedOrder,
                    }
                  : order,
              ),
            );
          }

          /*
           * Deleted order
           */
          if (payload.eventType === 'DELETE') {
            const deletedOrder =
              payload.old as Order;

            setOrders((currentOrders) =>
              currentOrders.filter(
                (order) =>
                  order.id !==
                  deletedOrder.id,
              ),
            );
          }
        },
      )
      .subscribe((status) => {
        console.log(
          `CUSTOMER ORDER REALTIME STATUS: ${status}`,
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /*
   * ============================================================
   * AUTH CHECK
   * ============================================================
   */

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
   * ============================================================
   * PROFILE
   * ============================================================
   */

  const handleSaveProfile = async () => {
    setSavingProfile(true);

    try {
      await updateProfile(user.id, {
        full_name: fullName,
        phone,
      });

      await refreshProfile();

      toast('Profile updated!');
    } catch (error) {
      console.error(
        'Failed to update profile:',
        error,
      );

      toast(
        'Failed to update profile',
        'error',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  /*
   * ============================================================
   * ADDRESS
   * ============================================================
   */

  const handleAddAddress = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    try {
      await addAddress({
        ...addrForm,
        user_id: user.id,
        is_default: false,
      });

      const updated =
        await getAddresses(user.id);

      setAddresses(updated);

      setShowAddrForm(false);

      setAddrForm({
        full_name: '',
        phone: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Nigeria',
      });

      toast('Address added!');
    } catch (error) {
      console.error(
        'Failed to add address:',
        error,
      );

      toast(
        'Failed to add address',
        'error',
      );
    }
  };

  const handleDeleteAddress = async (
    id: string,
  ) => {
    try {
      await deleteAddress(id);

      setAddresses((prev) =>
        prev.filter(
          (address) =>
            address.id !== id,
        ),
      );

      toast('Address removed');
    } catch (error) {
      console.error(
        'Failed to remove address:',
        error,
      );

      toast(
        'Failed to remove address',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * SIGN OUT
   * ============================================================
   */

  const handleSignOut = async () => {
    await signOut();

    toast(
      'Signed out successfully',
    );
  };

  /*
   * ============================================================
   * MENU
   * ============================================================
   */

  const menuItems = [
    {
      id: 'dashboard' as Tab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'profile' as Tab,
      label: 'Profile',
      icon: User,
    },
    {
      id: 'orders' as Tab,
      label: 'Orders',
      icon: ShoppingBag,
    },
    {
      id: 'wishlist' as Tab,
      label: 'Wishlist',
      icon: Heart,
    },
    {
      id: 'addresses' as Tab,
      label: 'Addresses',
      icon: MapPin,
    },
    {
      id: 'payments' as Tab,
      label: 'Payment History',
      icon: CreditCard,
    },
    {
      id: 'settings' as Tab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  /*
   * ============================================================
   * TOTAL SPENT
   * ============================================================
   */

  const totalSpent =
    payments
      .filter(
        (payment) =>
          payment.status ===
          'success',
      )
      .reduce(
        (sum, payment) =>
          sum + payment.amount,
        0,
      );

  /*
   * ============================================================
   * ORDER STATUS CLASS
   * ============================================================
   */

  const getOrderStatusClass = (
    status: Order['status'],
  ) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500/20 text-green-400';

      case 'shipping':
        return 'bg-blue-500/20 text-blue-400';

      case 'processing':
        return 'bg-purple-500/20 text-purple-400';

      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';

      case 'cancelled':
        return 'bg-red-500/20 text-red-400';

      default:
        return 'bg-ink-500/20 text-ink-300';
    }
  };

  /*
   * ============================================================
   * PAYMENT STATUS CLASS
   * ============================================================
   */

  const getPaymentStatusClass = (
    status: Order['payment_status'],
  ) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/20 text-green-400';

      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';

      case 'refunded':
        return 'bg-purple-500/20 text-purple-400';

      case 'failed':
        return 'bg-red-500/20 text-red-400';

      default:
        return 'bg-ink-500/20 text-ink-300';
    }
  };

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="section-padding py-8 lg:py-12">
      <div className="grid lg:grid-cols-4 gap-8">

        {/* ======================================================
            SIDEBAR
        ====================================================== */}

        <aside className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-28">

            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
              <div className="w-12 h-12 rounded-full bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-400 font-bold text-lg">
                {(
                  profile?.full_name?.[0] ??
                  user.email[0]
                ).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {profile?.full_name ||
                    'Member'}
                </p>

                <p className="text-xs text-ink-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    setTab(item.id)
                  }
                  className={classNames(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    tab === item.id
                      ? 'bg-gold-400/10 text-gold-400 font-medium'
                      : 'text-ink-300 hover:text-white hover:bg-white/5',
                  )}
                >
                  <item.icon className="w-4 h-4" />

                  {item.label}

                  {item.id ===
                    'wishlist' &&
                    wishlistItems.length >
                      0 && (
                      <span className="ml-auto text-xs bg-gold-400/20 text-gold-400 px-2 py-0.5 rounded-full">
                        {
                          wishlistItems.length
                        }
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

        {/* ======================================================
            CONTENT
        ====================================================== */}

        <div className="lg:col-span-3">

          {/* ====================================================
              DASHBOARD
          ==================================================== */}

          {tab === 'dashboard' && (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1 className="font-display text-3xl font-bold text-white mb-6">
                Dashboard
              </h1>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Total Orders',
                    value: orders.length,
                    icon: Package,
                    color: 'text-blue-400',
                  },
                  {
                    label: 'Total Spent',
                    value:
                      formatNaira(
                        totalSpent,
                      ),
                    icon: CreditCard,
                    color:
                      'text-gold-400',
                  },
                  {
                    label:
                      'Wishlist Items',
                    value:
                      wishlistItems.length,
                    icon: Heart,
                    color:
                      'text-red-400',
                  },
                  {
                    label:
                      'Saved Addresses',
                    value:
                      addresses.length,
                    icon: MapPin,
                    color:
                      'text-green-400',
                  },
                ].map(
                  (stat, index) => (
                    <motion.div
                      key={index}
                      initial={{
                        opacity: 0,
                        y: 20,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay:
                          index * 0.1,
                      }}
                      className="glass rounded-2xl p-5"
                    >
                      <stat.icon
                        className={classNames(
                          'w-6 h-6 mb-3',
                          stat.color,
                        )}
                      />

                      <p className="text-2xl font-bold text-white">
                        {stat.value}
                      </p>

                      <p className="text-xs text-ink-400 mt-1">
                        {stat.label}
                      </p>
                    </motion.div>
                  ),
                )}
              </div>

              {/* Recent Orders */}

              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  Recent Orders
                </h2>

                {loading ? (
                  <div className="glass rounded-2xl p-6 animate-pulse h-32" />
                ) : orders.length ===
                  0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <Package className="w-10 h-10 text-ink-500 mx-auto mb-3" />

                    <p className="text-ink-400 text-sm mb-4">
                      No orders yet
                    </p>

                    <Link
                      to="/shop"
                      className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider inline-block"
                    >
                      Start Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders
                      .slice(0, 3)
                      .map((order) => (
                        <div
                          key={order.id}
                          className="glass rounded-xl p-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                            <div>
                              <p className="text-sm font-medium text-white font-mono">
                                {
                                  order.order_number
                                }
                              </p>

                              <p className="text-xs text-ink-400">
                                {formatDate(
                                  order.created_at,
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">

                              {/* Order status */}

                              <span
                                className={classNames(
                                  'text-xs font-medium px-3 py-1 rounded-full',
                                  getOrderStatusClass(
                                    order.status,
                                  ),
                                )}
                              >
                                {order.status}
                              </span>

                              {/* Payment status */}

                              <span
                                className={classNames(
                                  'text-xs font-medium px-3 py-1 rounded-full',
                                  getPaymentStatusClass(
                                    order.payment_status,
                                  ),
                                )}
                              >
                                Payment:{' '}
                                {
                                  order.payment_status
                                }
                              </span>

                              <span className="text-sm font-bold text-gold-400">
                                {formatNaira(
                                  order.total,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ====================================================
              PROFILE
          ==================================================== */}

          {tab === 'profile' && (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1 className="font-display text-3xl font-bold text-white mb-6">
                My Profile
              </h1>

              <div className="glass rounded-2xl p-6 max-w-lg">
                <div className="space-y-4">

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                      Full Name
                    </label>

                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) =>
                        setFullName(
                          e.target.value,
                        )
                      }
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                      Email (read-only)
                    </label>

                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="input-field opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                      Phone
                    </label>

                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(
                          e.target.value,
                        )
                      }
                      className="input-field"
                      placeholder="+234..."
                    />
                  </div>

                  <button
                    onClick={
                      handleSaveProfile
                    }
                    disabled={
                      savingProfile
                    }
                    className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider disabled:opacity-50"
                  >
                    {savingProfile
                      ? 'Saving...'
                      : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ====================================================
              ORDERS
          ==================================================== */}

          {tab === 'orders' && (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1 className="font-display text-3xl font-bold text-white mb-6">
                My Orders
              </h1>

              {loading ? (
                <div className="glass rounded-2xl p-6 animate-pulse h-32" />
              ) : orders.length ===
                0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <Package className="w-10 h-10 text-ink-500 mx-auto mb-3" />

                  <p className="text-ink-400 text-sm mb-4">
                    No orders yet
                  </p>

                  <Link
                    to="/shop"
                    className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider inline-block"
                  >
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(
                    (order) => (
                      <div
                        key={order.id}
                        className="glass rounded-2xl p-5"
                      >

                        {/* Order header */}

                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 pb-4 border-b border-white/10">

                          <div>
                            <p className="text-sm font-mono font-medium text-white">
                              {
                                order.order_number
                              }
                            </p>

                            <p className="text-xs text-ink-400">
                              {formatDate(
                                order.created_at,
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">

                            {/* ORDER STATUS */}

                            <span
                              className={classNames(
                                'text-xs font-medium px-3 py-1 rounded-full',
                                getOrderStatusClass(
                                  order.status,
                                ),
                              )}
                            >
                              Order:{' '}
                              {order.status}
                            </span>

                            {/* PAYMENT STATUS */}

                            <span
                              className={classNames(
                                'text-xs font-medium px-3 py-1 rounded-full',
                                getPaymentStatusClass(
                                  order.payment_status,
                                ),
                              )}
                            >
                              Payment:{' '}
                              {
                                order.payment_status
                              }
                            </span>

                            <span className="text-lg font-bold text-gold-400">
                              {formatNaira(
                                order.total,
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Order items */}

                        <div className="space-y-2">
                          {(
                            orderItems[
                              order.id
                            ] ?? []
                          ).map(
                            (item) => (
                              <div
                                key={
                                  item.id
                                }
                                className="flex items-center gap-3"
                              >
                                {item.image_url && (
                                  <img
                                    src={
                                      item.image_url
                                    }
                                    alt=""
                                    className="w-10 h-12 object-cover rounded"
                                  />
                                )}

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">
                                    {
                                      item.name
                                    }
                                  </p>

                                  <p className="text-xs text-ink-500">
                                    {
                                      item.size
                                    }{' '}
                                    /{' '}
                                    {
                                      item.color
                                    }{' '}
                                    x
                                    {
                                      item.quantity
                                    }
                                  </p>
                                </div>

                                <span className="text-sm text-ink-300">
                                  {formatNaira(
                                    item.price *
                                      item.quantity,
                                  )}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ====================================================
              WISHLIST
          ==================================================== */}

          {tab === 'wishlist' && (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1 className="font-display text-3xl font-bold text-white mb-6">
                My Wishlist
              </h1>

              {wishlistItems.length ===
              0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <Heart className="w-10 h-10 text-ink-500 mx-auto mb-3" />

                  <p className="text-ink-400 text-sm mb-4">
                    Your wishlist is
                    empty
                  </p>

                  <Link
                    to="/shop"
                    className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider inline-block"
                  >
                    Browse Products
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {wishlistItems.map(
                    (product) => (
                      <Link
                        key={
                          product.id
                        }
                        to={`/product/${product.slug}`}
                        className="glass rounded-2xl overflow-hidden group"
                      >
                        <div className="aspect-[3/4] overflow-hidden">
                          <img
                            src={
                              product
                                .images[0]
                            }
                            alt={
                              product.name
                            }
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>

                        <div className="p-3">
                          <h3 className="text-sm font-medium text-white truncate">
                            {
                              product.name
                            }
                          </h3>

                          <p className="text-sm text-gold-400 font-medium">
                            {formatNaira(
                              product.price,
                            )}
                          </p>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ====================================================
              ADDRESSES
          ==================================================== */}

          {tab === 'addresses' && (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl font-bold text-white">
                  My Addresses
                </h1>

                <button
                  onClick={() =>
                    setShowAddrForm(
                      (value) =>
                        !value,
                    )
                  }
                  className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider"
                >
                  Add New
                </button>
              </div>

              {showAddrForm && (
                <form
                  onSubmit={
                    handleAddAddress
                  }
                  className="glass rounded-2xl p-6 mb-6 space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={
                        addrForm.full_name
                      }
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          full_name:
                            e.target
                              .value,
                        })
                      }
                      className="input-field"
                    />

                    <input
                      type="tel"
                      required
                      placeholder="Phone"
                      value={
                        addrForm.phone
                      }
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          phone:
                            e.target
                              .value,
                        })
                      }
                      className="input-field"
                    />
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Address Line 1"
                    value={
                      addrForm.line1
                    }
                    onChange={(e) =>
                      setAddrForm({
                        ...addrForm,
                        line1:
                          e.target
                            .value,
                      })
                    }
                    className="input-field"
                  />

                  <input
                    type="text"
                    placeholder="Address Line 2 (Optional)"
                    value={
                      addrForm.line2
                    }
                    onChange={(e) =>
                      setAddrForm({
                        ...addrForm,
                        line2:
                          e.target
                            .value,
                      })
                    }
                    className="input-field"
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={
                        addrForm.city
                      }
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          city:
                            e.target
                              .value,
                        })
                      }
                      className="input-field"
                    />

                    <input
                      type="text"
                      required
                      placeholder="State"
                      value={
                        addrForm.state
                      }
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          state:
                            e.target
                              .value,
                        })
                      }
                      className="input-field"
                    />

                    <input
                      type="text"
                      placeholder="Postal Code"
                      value={
                        addrForm.postal_code
                      }
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          postal_code:
                            e.target
                              .value,
                        })
                      }
                      className="input-field"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider"
                    >
                      Save Address
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setShowAddrForm(
                          false,
                        )
                      }
                      className="btn-outline rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {addresses.length ===
              0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <MapPin className="w-10 h-10 text-ink-500 mx-auto mb-3" />

                  <p className="text-ink-400 text-sm">
                    No saved addresses
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {addresses.map(
                    (address) => (
                      <div
                        key={
                          address.id
                        }
                        className="glass rounded-2xl p-5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <MapPin className="w-5 h-5 text-gold-400" />

                          <button
                            onClick={() =>
                              handleDeleteAddress(
                                address.id,
                              )
                            }
                            className="text-xs text-ink-500 hover:text-red-400 transition-colors"
                          >
                            Remove
                          </button>
                        </div>

                        <p className="text-sm font-medium text-white">
                          {
                            address.full_name
                          }
                        </p>

                        <p className="text-sm text-ink-400 mt-1">
                          {
                            address.line1
                          }

                          {address.line2 &&
                            `, ${address.line2}`}
                        </p>

                        <p className="text-sm text-ink-400">
                          {
                            address.city
                          }
                          ,{' '}
                          {
                            address.state
                          }
                        </p>

                        <p className="text-sm text-ink-400">
                          {
                            address.country
                          }{' '}
                          {
                            address.postal_code
                          }
                        </p>

                        <p className="text-xs text-ink-500 mt-2">
                          {
                            address.phone
                          }
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ====================================================
              PAYMENTS
          ==================================================== */}

          {tab === 'payments' && (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1 className="font-display text-3xl font-bold text-white mb-6">
                Payment History
              </h1>

              {payments.length ===
              0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <CreditCard className="w-10 h-10 text-ink-500 mx-auto mb-3" />

                  <p className="text-ink-400 text-sm">
                    No payment history
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map(
                    (payment) => (
                      <div
                        key={
                          payment.id
                        }
                        className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-gold-400" />

                          <div>
                            <p className="text-sm font-mono text-white">
                              {
                                payment.reference
                              }
                            </p>

                            <p className="text-xs text-ink-400">
                              {formatDate(
                                payment.created_at,
                              )}{' '}
                              ·{' '}
                              {
                                payment.channel
                              }
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span
                            className={classNames(
                              'text-xs font-medium px-3 py-1 rounded-full',
                              payment.status ===
                                'success'
                                ? 'bg-green-500/20 text-green-400'
                                : payment.status ===
                                    'pending'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400',
                            )}
                          >
                            {
                              payment.status
                            }
                          </span>

                          <span className="text-sm font-bold text-white">
                            {formatNaira(
                              payment.amount,
                            )}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ====================================================
              SETTINGS
          ==================================================== */}

          {tab === 'settings' && (
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1 className="font-display text-3xl font-bold text-white mb-6">
                Account Settings
              </h1>

              <div className="glass rounded-2xl p-6 max-w-lg space-y-6">

                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Email Notifications
                  </h3>

                  <p className="text-xs text-ink-400 mb-3">
                    Manage your email
                    preferences
                  </p>

                  {[
                    'Order updates',
                    'New product alerts',
                    'Newsletter',
                    'Promotional offers',
                  ].map(
                    (item) => (
                      <label
                        key={item}
                        className="flex items-center gap-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          className="accent-gold-400 w-4 h-4"
                        />

                        <span className="text-sm text-ink-300">
                          {item}
                        </span>
                      </label>
                    ),
                  )}
                </div>

                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Danger Zone
                  </h3>

                  <button
                    onClick={
                      handleSignOut
                    }
                    className="text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />

                    Sign out of all
                    devices
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