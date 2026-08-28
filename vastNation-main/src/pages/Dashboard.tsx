import { useCallback, useEffect, useState } from 'react';
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
  CheckCircle,
  Clock,
  AlertCircle,
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
import { uploadProfileImage } from '../services/storage';
import { useTheme } from '../context/ThemeContext';

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

const EMPTY_ADDRESS_FORM = {
  full_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Nigeria',
};

export default function Dashboard() {
  const {
    user,
    profile,
    signOut,
    refreshProfile,
    changePassword,
    deleteAccount,
  } = useAuth();

  const { items: wishlistItems } = useWishlist();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [tab, setTab] = useState<Tab>('dashboard');

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [orderItems, setOrderItems] =
    useState<Record<string, OrderItem[]>>({});

  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState({
    order_updates: true,
    payment_updates: true,
    shipping_updates: true,
    product_alerts: true,
    newsletter: true,
    promotions: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const saveUserSettings = useCallback(async (patch: Partial<typeof notificationSettings>) => {
    if (!user?.id) return;
    setSavingSettings(true);
    const next = { ...notificationSettings, ...patch };
    const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ...next, theme }, { onConflict: 'user_id' });
    setSavingSettings(false);
    if (error) toast('Could not save settings: ' + error.message, 'error');
    else setNotificationSettings(next);
  }, [user?.id, notificationSettings, theme, toast]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setNotificationSettings({
        order_updates: data.order_updates ?? true, payment_updates: data.payment_updates ?? true,
        shipping_updates: data.shipping_updates ?? true, product_alerts: data.product_alerts ?? true,
        newsletter: data.newsletter ?? true, promotions: data.promotions ?? true,
      });
      if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') setTheme(data.theme);
    });
  }, [user?.id, setTheme]);

  const changeTheme = async (next: 'light' | 'dark' | 'system') => {
    setTheme(next);
    if (!user?.id) return;
    const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ...notificationSettings, theme: next }, { onConflict: 'user_id' });
    if (error) toast('Theme changed locally, but could not be saved.', 'error');
  };

  const [showAddrForm, setShowAddrForm] = useState(false);

  const [addrForm, setAddrForm] =
    useState({ ...EMPTY_ADDRESS_FORM });

  /*
   * ============================================================
   * RECONCILE ORDERS WITH PAYMENTS
   * ============================================================
   *
   * Payment status and delivery/order status are kept separate.
   *
   * Successful payment:
   *
   * payments.status = success
   *          ↓
   * orders.payment_status = paid
   *
   * The order delivery status is NOT changed here.
   */

  const reconcileOrdersWithPayments = useCallback(
    (
      orderList: Order[],
      paymentList: Payment[],
    ): Order[] => {
      const paymentMap = new Map<string, Payment>();

      for (const payment of paymentList) {
        if (!payment.order_id) continue;

        const existing = paymentMap.get(
          payment.order_id,
        );

        if (
          !existing ||
          payment.status === 'success'
        ) {
          paymentMap.set(
            payment.order_id,
            payment,
          );
        }
      }

      return orderList.map((order) => {
        const payment = paymentMap.get(order.id);

        if (payment?.status === 'success') {
          return {
            ...order,
            payment_status: 'paid',
            payment_reference:
              order.payment_reference ||
              payment.reference ||
              null,
          };
        }

        return order;
      });
    },
    [],
  );

  /*
   * ============================================================
   * LOAD ORDER ITEMS
   * ============================================================
   */

  const loadOrderItems = useCallback(
    async (orderList: Order[]) => {
      if (orderList.length === 0) {
        setOrderItems({});
        return;
      }

      const results = await Promise.allSettled(
        orderList.map(async (order) => {
          const items = await getOrderItems(order.id);

          return {
            orderId: order.id,
            items,
          };
        }),
      );

      const nextItems: Record<
        string,
        OrderItem[]
      > = {};

      for (const result of results) {
        if (result.status === 'fulfilled') {
          nextItems[result.value.orderId] =
            result.value.items;
        }
      }

      setOrderItems(nextItems);
    },
    [],
  );

  /*
   * ============================================================
   * REFRESH CUSTOMER DATA
   * ============================================================
   *
   * This replaces the old refreshOrders + refreshPayments
   * combination.
   *
   * It always retrieves the newest:
   *
   * - Orders
   * - Payments
   * - Order items
   *
   * This prevents stale payment/order state.
   */

  const refreshCustomerData = useCallback(
    async () => {
      if (!user?.id) return;

      try {
        const [
          orderData,
          paymentData,
        ] = await Promise.all([
          getOrders(user.id),
          getPayments(user.id),
        ]);

        const reconciledOrders =
          reconcileOrdersWithPayments(
            orderData,
            paymentData,
          );

        setPayments(paymentData);
        setOrders(reconciledOrders);

        await loadOrderItems(
          reconciledOrders,
        );
      } catch (error) {
        console.error(
          'Failed to refresh customer data:',
          error,
        );
      }
    },
    [
      user?.id,
      reconcileOrdersWithPayments,
      loadOrderItems,
    ],
  );

  /*
   * ============================================================
   * INITIAL CUSTOMER DATA
   * ============================================================
   */

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);

      try {
        const [
          orderData,
          addressData,
          paymentData,
        ] = await Promise.all([
          getOrders(user.id),
          getAddresses(user.id),
          getPayments(user.id),
        ]);

        if (!mounted) return;

        const reconciledOrders =
          reconcileOrdersWithPayments(
            orderData,
            paymentData,
          );

        setOrders(reconciledOrders);
        setAddresses(addressData);
        setPayments(paymentData);

        await loadOrderItems(
          reconciledOrders,
        );

        if (!mounted) return;

        setFullName(
          profile?.full_name ?? '',
        );

        setPhone(
          profile?.phone ?? '',
        );
      } catch (error) {
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
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [
    user?.id,
    profile,
    toast,
    reconcileOrdersWithPayments,
    loadOrderItems,
  ]);

  /*
   * ============================================================
   * CUSTOMER ORDER REALTIME
   * ============================================================
   *
   * Admin changes:
   *
   * pending
   * processing
   * shipping
   * delivered
   * cancelled
   *
   * are reflected immediately.
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
        async (payload) => {
          console.log(
            'CUSTOMER ORDER REALTIME:',
            payload,
          );

          if (
            payload.eventType === 'INSERT'
          ) {
            const newOrder =
              payload.new as Order;

            setOrders((currentOrders) => {
              if (
                currentOrders.some(
                  (order) =>
                    order.id ===
                    newOrder.id,
                )
              ) {
                return currentOrders;
              }

              return [
                newOrder,
                ...currentOrders,
              ];
            });

            try {
              const items =
                await getOrderItems(
                  newOrder.id,
                );

              setOrderItems((current) => ({
                ...current,
                [newOrder.id]: items,
              }));
            } catch (error) {
              console.error(
                'Failed to load new order items:',
                error,
              );
            }

            /*
             * Reconcile the newly inserted order
             * with the current payment state.
             */
            await refreshCustomerData();
          }

          if (
            payload.eventType === 'UPDATE'
          ) {
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

            /*
             * Fetch authoritative data after
             * an admin/order/payment update.
             */
            await refreshCustomerData();
          }

          if (
            payload.eventType === 'DELETE'
          ) {
            const deletedOrder =
              payload.old as Order;

            setOrders((currentOrders) =>
              currentOrders.filter(
                (order) =>
                  order.id !==
                  deletedOrder.id,
              ),
            );

            setOrderItems((currentItems) => {
              const next = {
                ...currentItems,
              };

              delete next[
                deletedOrder.id
              ];

              return next;
            });
          }
        },
      )
      .subscribe((status) => {
        console.log(
          `CUSTOMER ORDER REALTIME STATUS: ${status}`,
        );
      });

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    user?.id,
    refreshCustomerData,
  ]);

  /*
   * ============================================================
   * CUSTOMER PAYMENT REALTIME
   * ============================================================
   *
   * When the Paystack webhook creates/updates:
   *
   * payments.status = success
   *
   * the dashboard immediately refreshes.
   */

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(
        `customer-payments-${user.id}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log(
            'CUSTOMER PAYMENT REALTIME:',
            payload,
          );

          /*
           * ==================================================
           * INSERT
           * ==================================================
           */

          if (
            payload.eventType === 'INSERT'
          ) {
            const newPayment =
              payload.new as Payment;

            setPayments(
              (currentPayments) => {
                if (
                  currentPayments.some(
                    (payment) =>
                      payment.id ===
                      newPayment.id,
                  )
                ) {
                  return currentPayments;
                }

                return [
                  newPayment,
                  ...currentPayments,
                ];
              },
            );

            /*
             * Immediately update the order UI
             * if the payment is successful.
             */
            if (
              newPayment.status ===
                'success' &&
              newPayment.order_id
            ) {
              setOrders(
                (currentOrders) =>
                  currentOrders.map(
                    (order) =>
                      order.id ===
                      newPayment.order_id
                        ? {
                            ...order,
                            payment_status:
                              'paid',
                            payment_reference:
                              order.payment_reference ||
                              newPayment.reference,
                          }
                        : order,
                  ),
              );
            }

            await refreshCustomerData();
          }

          /*
           * ==================================================
           * UPDATE
           * ==================================================
           */

          if (
            payload.eventType === 'UPDATE'
          ) {
            const updatedPayment =
              payload.new as Payment;

            setPayments(
              (currentPayments) =>
                currentPayments.map(
                  (payment) =>
                    payment.id ===
                    updatedPayment.id
                      ? {
                          ...payment,
                          ...updatedPayment,
                        }
                      : payment,
                ),
            );

            if (
              updatedPayment.status ===
                'success' &&
              updatedPayment.order_id
            ) {
              setOrders(
                (currentOrders) =>
                  currentOrders.map(
                    (order) =>
                      order.id ===
                      updatedPayment.order_id
                        ? {
                            ...order,
                            payment_status:
                              'paid',
                            payment_reference:
                              order.payment_reference ||
                              updatedPayment.reference,
                          }
                        : order,
                  ),
              );
            }

            await refreshCustomerData();
          }

          /*
           * ==================================================
           * DELETE
           * ==================================================
           */

          if (
            payload.eventType === 'DELETE'
          ) {
            const deletedPayment =
              payload.old as Payment;

            setPayments(
              (currentPayments) =>
                currentPayments.filter(
                  (payment) =>
                    payment.id !==
                    deletedPayment.id,
                ),
            );

            await refreshCustomerData();
          }
        },
      )
      .subscribe((status) => {
        console.log(
          `CUSTOMER PAYMENT REALTIME STATUS: ${status}`,
        );
      });

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    user?.id,
    refreshCustomerData,
  ]);

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
        full_name: fullName.trim(),
        phone: phone.trim(),
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

  const handleProfileImage = async (file: File | undefined) => {
    if (!file || !user?.id) return;
    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadProfileImage(file, user.id);
      await updateProfile(user.id, { avatar_url: avatarUrl });
      await refreshProfile();
      toast('Profile image updated!', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to upload profile image', 'error');
    } finally { setUploadingAvatar(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast('New password must be at least 8 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { toast('New passwords do not match.', 'error'); return; }
    setChangingPassword(true);
    try { await changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); toast('Password changed successfully!', 'success'); }
    catch (error) { toast(error instanceof Error ? error.message : 'Failed to change password', 'error'); }
    finally { setChangingPassword(false); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
    setDeletingAccount(true);
    try { await deleteAccount(); window.location.href = '/'; }
    catch (error) { toast(error instanceof Error ? error.message : 'Failed to delete account', 'error'); setDeletingAccount(false); }
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
        ...EMPTY_ADDRESS_FORM,
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

      setAddresses((previous) =>
        previous.filter(
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
    try {
      await signOut();

      toast(
        'Signed out successfully',
      );
    } catch (error) {
      console.error(
        'Sign out failed:',
        error,
      );
    }
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

  const totalSpent = payments
    .filter(
      (payment) =>
        payment.status === 'success',
    )
    .reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount || 0),
      0,
    );

  /*
   * ============================================================
   * STATUS HELPERS
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

  const getPaymentStatusClass = (
    status:
      | Order['payment_status']
      | string
      | null
      | undefined,
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

  const getPaymentStatusLabel = (
    status:
      | Order['payment_status']
      | string
      | null
      | undefined,
  ) => {
    switch (status) {
      case 'paid':
        return 'Paid';

      case 'pending':
        return 'Pending';

      case 'failed':
        return 'Failed';

      case 'refunded':
        return 'Refunded';

      default:
        return status || 'Pending';
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

        {/* SIDEBAR */}

        <aside className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-28">

            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-400 font-bold text-lg">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : (profile?.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
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
                  type="button"
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

                  {item.id ===
                    'payments' &&
                    payments.filter(
                      (payment) =>
                        payment.status ===
                        'success',
                    ).length > 0 && (
                      <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        {
                          payments.filter(
                            (payment) =>
                              payment.status ===
                              'success',
                          ).length
                        }
                      </span>
                    )}
                </button>
              ))}

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />

                Logout
              </button>
            </nav>
          </div>
        </aside>

        {/* CONTENT */}

        <div className="lg:col-span-3">

          {/* DASHBOARD */}

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
                    label: 'Wishlist Items',
                    value:
                      wishlistItems.length,
                    icon: Heart,
                    color: 'text-red-400',
                  },
                  {
                    label: 'Saved Addresses',
                    value:
                      addresses.length,
                    icon: MapPin,
                    color:
                      'text-green-400',
                  },
                ].map(
                  (stat, index) => (
                    <motion.div
                      key={stat.label}
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

              <div className="glass rounded-2xl p-4 mt-4 border border-green-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />

                  <div>
                    <p className="text-sm text-white font-medium">
                      Account synchronized
                    </p>

                    <p className="text-xs text-ink-400">
                      Orders and payments update automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  Recent Orders
                </h2>

                {loading ? (
                  <div className="glass rounded-2xl p-6 animate-pulse h-32" />
                ) : orders.length === 0 ? (
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
                              <span
                                className={classNames(
                                  'text-xs font-medium px-3 py-1 rounded-full capitalize',
                                  getOrderStatusClass(
                                    order.status,
                                  ),
                                )}
                              >
                                {order.status}
                              </span>

                              <span
                                className={classNames(
                                  'text-xs font-medium px-3 py-1 rounded-full',
                                  getPaymentStatusClass(
                                    order.payment_status,
                                  ),
                                )}
                              >
                                Payment:{' '}
                                {getPaymentStatusLabel(
                                  order.payment_status,
                                )}
                              </span>

                              <span className="text-sm font-bold text-gold-400">
                                {formatNaira(
                                  Number(
                                    order.total ||
                                      0,
                                  ),
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

          {/* PROFILE */}

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
                <div className="mb-6 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 text-2xl font-bold">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : (profile?.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <label className="btn-gold rounded-lg px-4 py-2 text-xs cursor-pointer inline-flex items-center gap-2">
                      {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingAvatar} onChange={(e) => void handleProfileImage(e.target.files?.[0])} />
                    </label>
                    <p className="text-xs text-ink-500 mt-2">JPG, PNG, WEBP or GIF · max 5MB</p>
                  </div>
                </div>
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
                      Email
                    </label>

                    <input
                      type="email"
                      value={
                        user.email ?? ''
                      }
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
                    type="button"
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

          {/* ORDERS */}

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
              ) : orders.length === 0 ? (
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
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="glass rounded-2xl p-5"
                    >
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

                          {(order.payment_reference ||
                            order.payment_ref) && (
                            <p className="text-[11px] text-ink-500 mt-2">
                              Ref:{' '}
                              <span className="text-ink-300 font-mono">
                                {order.payment_reference ||
                                  order.payment_ref}
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={classNames(
                              'text-xs font-medium px-3 py-1 rounded-full capitalize',
                              getOrderStatusClass(
                                order.status,
                              ),
                            )}
                          >
                            Order:{' '}
                            {order.status}
                          </span>

                          <span
                            className={classNames(
                              'text-xs font-medium px-3 py-1 rounded-full',
                              getPaymentStatusClass(
                                order.payment_status,
                              ),
                            )}
                          >
                            Payment:{' '}
                            {getPaymentStatusLabel(
                              order.payment_status,
                            )}
                          </span>

                          <span className="text-lg font-bold text-gold-400">
                            {formatNaira(
                              Number(
                                order.total ||
                                  0,
                              ),
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(
                          orderItems[
                            order.id
                          ] ?? []
                        ).map((item) => (
                          <div
                            key={item.id}
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
                                {item.name}
                              </p>

                              <p className="text-xs text-ink-500">
                                {item.size}{' '}
                                /{' '}
                                {item.color}{' '}
                                ×{' '}
                                {item.quantity}
                              </p>
                            </div>

                            <span className="text-sm text-ink-300">
                              {formatNaira(
                                Number(
                                  item.price ||
                                    0,
                                ) *
                                  Number(
                                    item.quantity ||
                                      0,
                                  ),
                              )}
                            </span>
                          </div>
                        ))}

                        {(
                          orderItems[
                            order.id
                          ] ?? []
                        ).length === 0 && (
                          <p className="text-xs text-ink-500">
                            Order items unavailable.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* WISHLIST */}

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

              {wishlistItems.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <Heart className="w-10 h-10 text-ink-500 mx-auto mb-3" />

                  <p className="text-ink-400 text-sm mb-4">
                    Your wishlist is empty
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
                        key={product.id}
                        to={`/product/${product.slug}`}
                        className="glass rounded-2xl overflow-hidden group"
                      >
                        <div className="aspect-[3/4] overflow-hidden">
                          <img
                            src={
                              product
                                .images?.[0] ||
                              '/placeholder-product.png'
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
                              Number(
                                product.price ||
                                  0,
                              ),
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

          {/* ADDRESSES */}

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
                  type="button"
                  onClick={() =>
                    setShowAddrForm(
                      (value) => !value,
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
                            e.target.value,
                        })
                      }
                      className="input-field"
                    />
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Address Line 1"
                    value={addrForm.line1}
                    onChange={(e) =>
                      setAddrForm({
                        ...addrForm,
                        line1:
                          e.target.value,
                      })
                    }
                    className="input-field"
                  />

                  <input
                    type="text"
                    placeholder="Address Line 2 (Optional)"
                    value={addrForm.line2}
                    onChange={(e) =>
                      setAddrForm({
                        ...addrForm,
                        line2:
                          e.target.value,
                      })
                    }
                    className="input-field"
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={addrForm.city}
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          city:
                            e.target.value,
                        })
                      }
                      className="input-field"
                    />

                    <input
                      type="text"
                      required
                      placeholder="State"
                      value={addrForm.state}
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          state:
                            e.target.value,
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
                            e.target.value,
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

              {addresses.length === 0 ? (
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
                        key={address.id}
                        className="glass rounded-2xl p-5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <MapPin className="w-5 h-5 text-gold-400" />

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteAddress(
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
                          {address.line1}
                          {address.line2 &&
                            `, ${address.line2}`}
                        </p>

                        <p className="text-sm text-ink-400">
                          {address.city},{' '}
                          {address.state}
                        </p>

                        <p className="text-sm text-ink-400">
                          {address.country}{' '}
                          {
                            address.postal_code
                          }
                        </p>

                        <p className="text-xs text-ink-500 mt-2">
                          {address.phone}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* PAYMENT HISTORY */}

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
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">
                    Payment History
                  </h1>

                  <p className="text-xs text-ink-500 mt-1">
                    Payments update automatically after confirmation.
                  </p>
                </div>

                <span className="text-xs text-ink-400">
                  {payments.length}{' '}
                  transactions
                </span>
              </div>

              {payments.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <CreditCard className="w-10 h-10 text-ink-500 mx-auto mb-3" />

                  <p className="text-ink-400 text-sm">
                    No payment history
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map(
                    (payment) => {
                      const successful =
                        payment.status ===
                        'success';

                      const pending =
                        payment.status ===
                        'pending';

                      return (
                        <div
                          key={payment.id}
                          className="glass rounded-xl p-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                            <div className="flex items-center gap-3">
                              <div
                                className={classNames(
                                  'w-10 h-10 rounded-full flex items-center justify-center',
                                  successful
                                    ? 'bg-green-500/10'
                                    : pending
                                      ? 'bg-yellow-500/10'
                                      : 'bg-red-500/10',
                                )}
                              >
                                {successful ? (
                                  <CheckCircle className="w-5 h-5 text-green-400" />
                                ) : pending ? (
                                  <Clock className="w-5 h-5 text-yellow-400" />
                                ) : (
                                  <AlertCircle className="w-5 h-5 text-red-400" />
                                )}
                              </div>

                              <div>
                                <p className="text-sm font-mono text-white break-all">
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

                                {payment.order_id && (
                                  <p className="text-[10px] text-ink-500 mt-1 font-mono">
                                    Order:{' '}
                                    {
                                      payment.order_id
                                    }
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <span
                                className={classNames(
                                  'text-xs font-medium px-3 py-1 rounded-full capitalize',
                                  successful
                                    ? 'bg-green-500/20 text-green-400'
                                    : pending
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
                                  Number(
                                    payment.amount ||
                                      0,
                                  ),
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* SETTINGS */}

          {tab === 'settings' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Account Settings</h1>
              <div className="glass rounded-2xl p-6 max-w-2xl space-y-8">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Appearance</h3>
                  <p className="text-xs text-ink-400 mb-4">Choose how Vast Nation looks on this device.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['light', 'dark', 'system'] as const).map((option) => (
                      <button key={option} type="button" onClick={() => void changeTheme(option)} className={classNames('rounded-lg border px-3 py-3 text-sm capitalize transition', theme === option ? 'border-gold-400 bg-gold-400/10 text-gold-400' : 'border-white/10 text-ink-300 hover:border-white/30')}>{option}</button>
                    ))}
                  </div>
                </div>
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-sm font-semibold text-white mb-1">Notifications</h3>
                  <p className="text-xs text-ink-400 mb-3">Your choices are saved to your account.</p>
                  {([['order_updates','Order updates'],['payment_updates','Payment updates'],['shipping_updates','Shipping and delivery'],['product_alerts','New product alerts'],['newsletter','Newsletter'],['promotions','Promotional offers']] as const).map(([key,label]) => (
                    <label key={key} className="flex items-center justify-between py-3 border-b border-white/5 cursor-pointer">
                      <span className="text-sm text-ink-300">{label}</span>
                      <input type="checkbox" className="accent-gold-400 w-4 h-4" checked={notificationSettings[key]} disabled={savingSettings} onChange={(e) => void saveUserSettings({ [key]: e.target.checked })} />
                    </label>
                  ))}
                </div>
                <div className="pt-6 border-t border-white/10 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Change Password</h3>
                    <div className="space-y-3">
                      <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-field" autoComplete="current-password" />
                      <input type="password" placeholder="New password (8+ characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" autoComplete="new-password" />
                      <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" autoComplete="new-password" />
                      <button type="button" onClick={() => void handleChangePassword()} disabled={changingPassword} className="btn-gold rounded-lg px-4 py-2 text-sm disabled:opacity-50">{changingPassword ? 'Changing…' : 'Change Password'}</button>
                    </div>
                  </div>
                  <div className="pt-5 border-t border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-2">Account</h3>
                    <div className="flex flex-wrap gap-4">
                      <button type="button" onClick={() => void handleSignOut()} className="text-sm text-ink-300 hover:text-white flex items-center gap-2"><LogOut className="w-4 h-4" />Log out</button>
                      <button type="button" onClick={() => void handleDeleteAccount()} disabled={deletingAccount} className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50">{deletingAccount ? 'Deleting…' : 'Delete account'}</button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}