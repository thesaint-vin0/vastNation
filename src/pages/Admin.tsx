import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Package, Tag, ShoppingCart, Users, Star, Ticket, BarChart3, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProducts, getCategories, getAllOrders, getAllProfiles, getAllReviews, getCoupons, createProduct, deleteProduct, createCategory, deleteCategory, createCoupon, deleteCoupon, updateOrderStatus, updateProduct, deleteReview } from '../services/api';
import { formatNaira, formatDate, classNames, slugify } from '../utils/helpers';
import type { Product, Category, Order, Profile, Coupon, Review } from '../types';

type Tab = 'dashboard' | 'products' | 'categories' | 'orders' | 'customers' | 'reviews' | 'coupons';

export default function Admin() {
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);

  // Product form
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', compare_at_price: '', category_id: '',
    images: '', sizes: 'S,M,L,XL', colors: 'Black,White', stock: '10', badge: '',
    is_featured: false, is_new: false, is_bestseller: false, is_trending: false, is_limited: false,
  });

  // Category form
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', image_url: '' });

  // Coupon form
  const [couponForm, setCouponForm] = useState({ code: '', type: 'percent', value: '', min_order: '0' });

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;
    setLoading(true);
    Promise.all([
      getProducts({ limit: 100 }),
      getCategories(),
      getAllOrders(),
      getAllProfiles(),
      getCoupons(),
    ]).then(([p, c, o, cust, cpn]) => {
      setProducts(p);
      setCategories(c);
      setOrders(o);
      setCustomers(cust);
      setCoupons(cpn);
    }).finally(() => setLoading(false));
  }, [user, profile]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const refreshProducts = () => getProducts({ limit: 100 }).then(setProducts);
  const refreshCategories = () => getCategories().then(setCategories);
  const refreshCoupons = () => getCoupons().then(setCoupons);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProduct({
        name: productForm.name,
        slug: slugify(productForm.name),
        description: productForm.description,
        price: Number(productForm.price),
        compare_at_price: productForm.compare_at_price ? Number(productForm.compare_at_price) : null,
        category_id: productForm.category_id || null,
        images: productForm.images.split(',').map((s) => s.trim()).filter(Boolean),
        sizes: productForm.sizes.split(',').map((s) => s.trim()),
        colors: productForm.colors.split(',').map((s) => s.trim()),
        stock: Number(productForm.stock),
        badge: productForm.badge || null,
        is_featured: productForm.is_featured,
        is_new: productForm.is_new,
        is_bestseller: productForm.is_bestseller,
        is_trending: productForm.is_trending,
        is_limited: productForm.is_limited,
        rating: 0,
        review_count: 0,
      });
      toast('Product created!');
      setShowProductForm(false);
      setProductForm({ name: '', description: '', price: '', compare_at_price: '', category_id: '', images: '', sizes: 'S,M,L,XL', colors: 'Black,White', stock: '10', badge: '', is_featured: false, is_new: false, is_bestseller: false, is_trending: false, is_limited: false });
      refreshProducts();
    } catch {
      toast('Failed to create product', 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast('Product deleted');
    } catch {
      toast('Failed to delete product', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCategory({
        name: categoryForm.name,
        slug: slugify(categoryForm.name),
        description: categoryForm.description,
        image_url: categoryForm.image_url || null,
      });
      toast('Category created!');
      setShowCategoryForm(false);
      setCategoryForm({ name: '', description: '', image_url: '' });
      refreshCategories();
    } catch {
      toast('Failed to create category', 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast('Category deleted');
    } catch {
      toast('Failed to delete category', 'error');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCoupon({
        code: couponForm.code.toUpperCase(),
        type: couponForm.type as 'percent' | 'fixed',
        value: Number(couponForm.value),
        min_order: Number(couponForm.min_order),
        active: true,
        expires_at: null,
      });
      toast('Coupon created!');
      setShowCouponForm(false);
      setCouponForm({ code: '', type: 'percent', value: '', min_order: '0' });
      refreshCoupons();
    } catch {
      toast('Failed to create coupon', 'error');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await deleteCoupon(id);
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      toast('Coupon deleted');
    } catch {
      toast('Failed to delete coupon', 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      toast('Order status updated');
    } catch {
      toast('Failed to update order', 'error');
    }
  };

  const handleToggleFlag = async (product: Product, flag: keyof Product) => {
    try {
      await updateProduct(product.id, { [flag]: !product[flag] } as Partial<Product>);
      refreshProducts();
    } catch {
      toast('Failed to update product', 'error');
    }
  };

  const totalRevenue = orders.filter((o) => o.status === 'paid' || o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;
  const totalCustomers = customers.filter((c) => c.role === 'customer').length;
  const totalProducts = products.length;

  const menuItems = [
    { id: 'dashboard' as Tab, label: 'Analytics', icon: LayoutDashboard },
    { id: 'products' as Tab, label: 'Products', icon: Package },
    { id: 'categories' as Tab, label: 'Categories', icon: Tag },
    { id: 'orders' as Tab, label: 'Orders', icon: ShoppingCart },
    { id: 'customers' as Tab, label: 'Customers', icon: Users },
    { id: 'reviews' as Tab, label: 'Reviews', icon: Star },
    { id: 'coupons' as Tab, label: 'Coupons', icon: Ticket },
  ];

  const statusOptions = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

  return (
    <div className="section-padding py-8 lg:py-12">
      <div className="grid lg:grid-cols-5 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-28">
            <div className="mb-6 pb-6 border-b border-white/10">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-1">Admin Panel</p>
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'Admin'}</p>
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
                </button>
              ))}
              <Link to="/" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-300 hover:text-white hover:bg-white/5 transition-all">
                <BarChart3 className="w-4 h-4" /> View Store
              </Link>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="lg:col-span-4">
          {tab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Analytics Dashboard</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue', value: formatNaira(totalRevenue), icon: BarChart3, color: 'text-gold-400' },
                  { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'text-blue-400' },
                  { label: 'Customers', value: totalCustomers, icon: Users, color: 'text-green-400' },
                  { label: 'Products', value: totalProducts, icon: Package, color: 'text-purple-400' },
                ].map((stat, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass rounded-2xl p-5">
                    <stat.icon className={classNames('w-6 h-6 mb-3', stat.color)} />
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-ink-400 mt-1">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Recent orders */}
              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-white mb-4">Recent Orders</h2>
                <div className="glass rounded-2xl overflow-hidden">
                  {orders.slice(0, 5).map((order, i) => (
                    <div key={order.id} className={classNames('flex items-center justify-between p-4', i !== 0 && 'border-t border-white/5')}>
                      <div>
                        <p className="text-sm font-mono text-white">{order.order_number}</p>
                        <p className="text-xs text-ink-400">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={classNames('text-xs px-2.5 py-1 rounded-full', order.status === 'paid' || order.status === 'delivered' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>{order.status}</span>
                        <span className="text-sm font-bold text-gold-400">{formatNaira(order.total)}</span>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && <p className="p-6 text-center text-ink-400 text-sm">No orders yet</p>}
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'products' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl font-bold text-white">Manage Products</h1>
                <button onClick={() => setShowProductForm(true)} className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>
              <div className="glass rounded-2xl overflow-hidden">
                {products.map((product, i) => (
                  <div key={product.id} className={classNames('flex items-center gap-4 p-4', i !== 0 && 'border-t border-white/5')}>
                    <img src={product.images[0]} alt="" className="w-12 h-16 object-cover rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{product.name}</p>
                      <p className="text-xs text-ink-400">{formatNaira(product.price)} · Stock: {product.stock}</p>
                    </div>
                    <div className="flex gap-1">
                      {(['is_featured', 'is_new', 'is_bestseller', 'is_trending', 'is_limited'] as const).map((flag) => (
                        <button
                          key={flag}
                          onClick={() => handleToggleFlag(product, flag)}
                          className={classNames(
                            'w-7 h-7 rounded text-[9px] font-bold transition-all',
                            product[flag] ? 'bg-gold-400 text-ink-950' : 'bg-ink-800 text-ink-500 hover:text-white',
                          )}
                          title={flag}
                        >
                          {flag === 'is_featured' ? 'F' : flag === 'is_new' ? 'N' : flag === 'is_bestseller' ? 'B' : flag === 'is_trending' ? 'T' : 'L'}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-ink-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {products.length === 0 && <p className="p-6 text-center text-ink-400 text-sm">No products</p>}
              </div>
            </motion.div>
          )}

          {tab === 'categories' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl font-bold text-white">Manage Categories</h1>
                <button onClick={() => setShowCategoryForm(true)} className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="glass rounded-2xl overflow-hidden">
                    {cat.image_url && <img src={cat.image_url} alt="" className="w-full h-32 object-cover" />}
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{cat.name}</p>
                        <p className="text-xs text-ink-400">{cat.slug}</p>
                      </div>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="text-ink-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === 'orders' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Manage Orders</h1>
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-sm font-mono font-medium text-white">{order.order_number}</p>
                        <p className="text-xs text-ink-400">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className="bg-ink-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400/60"
                        >
                          {statusOptions.map((s) => <option key={s} value={s} className="bg-ink-900">{s}</option>)}
                        </select>
                        <span className="text-sm font-bold text-gold-400">{formatNaira(order.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && <div className="glass rounded-2xl p-8 text-center text-ink-400 text-sm">No orders</div>}
              </div>
            </motion.div>
          )}

          {tab === 'customers' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Manage Customers</h1>
              <div className="glass rounded-2xl overflow-hidden">
                {customers.map((c, i) => (
                  <div key={c.id} className={classNames('flex items-center justify-between p-4', i !== 0 && 'border-t border-white/5')}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-400 font-bold text-sm">
                        {(c.full_name?.[0] ?? c.email[0]).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{c.full_name || 'Unknown'}</p>
                        <p className="text-xs text-ink-400">{c.email}</p>
                      </div>
                    </div>
                    <span className={classNames('text-xs px-3 py-1 rounded-full', c.role === 'admin' ? 'bg-gold-400/20 text-gold-400' : 'bg-blue-500/20 text-blue-400')}>
                      {c.role}
                    </span>
                  </div>
                ))}
                {customers.length === 0 && <p className="p-6 text-center text-ink-400 text-sm">No customers</p>}
              </div>
            </motion.div>
          )}

          {tab === 'reviews' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-6">Manage Reviews</h1>
              <ReviewsManager />
            </motion.div>
          )}

          {tab === 'coupons' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl font-bold text-white">Manage Coupons</h1>
                <button onClick={() => setShowCouponForm(true)} className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Coupon
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.map((coupon) => (
                  <div key={coupon.id} className="glass rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Ticket className="w-6 h-6 text-gold-400" />
                      <button onClick={() => handleDeleteCoupon(coupon.id)} className="text-ink-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-lg font-mono font-bold text-white">{coupon.code}</p>
                    <p className="text-sm text-gold-400 mt-1">
                      {coupon.type === 'percent' ? `${coupon.value}% off` : `${formatNaira(coupon.value)} off`}
                    </p>
                    <p className="text-xs text-ink-400 mt-2">Min order: {formatNaira(coupon.min_order)}</p>
                    <span className={classNames('inline-block mt-2 text-xs px-2 py-0.5 rounded-full', coupon.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                      {coupon.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
                {coupons.length === 0 && <p className="text-ink-400 text-sm col-span-full text-center py-8">No coupons</p>}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Product form modal */}
      {showProductForm && (
        <Modal title="Add Product" onClose={() => setShowProductForm(false)}>
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <input type="text" required placeholder="Product Name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="input-field" />
            <textarea required placeholder="Description" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={3} className="input-field resize-none" />
            <div className="grid grid-cols-2 gap-4">
              <input type="number" required placeholder="Price (NGN)" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} className="input-field" />
              <input type="number" placeholder="Compare at Price" value={productForm.compare_at_price} onChange={(e) => setProductForm({ ...productForm, compare_at_price: e.target.value })} className="input-field" />
            </div>
            <select value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })} className="input-field">
              <option value="">Select Category</option>
              {categories.map((c) => <option key={c.id} value={c.id} className="bg-ink-900">{c.name}</option>)}
            </select>
            <input type="text" required placeholder="Image URLs (comma-separated)" value={productForm.images} onChange={(e) => setProductForm({ ...productForm, images: e.target.value })} className="input-field" />
            <div className="grid grid-cols-2 gap-4">
              <input type="text" required placeholder="Sizes (comma-separated)" value={productForm.sizes} onChange={(e) => setProductForm({ ...productForm, sizes: e.target.value })} className="input-field" />
              <input type="text" required placeholder="Colors (comma-separated)" value={productForm.colors} onChange={(e) => setProductForm({ ...productForm, colors: e.target.value })} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="number" required placeholder="Stock" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} className="input-field" />
              <select value={productForm.badge} onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })} className="input-field">
                <option value="">No Badge</option>
                {['New', 'Sale', 'Limited', 'Hot', 'Bestseller'].map((b) => <option key={b} value={b} className="bg-ink-900">{b}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              {(['is_featured', 'is_new', 'is_bestseller', 'is_trending', 'is_limited'] as const).map((flag) => (
                <label key={flag} className="flex items-center gap-2 text-xs text-ink-300 cursor-pointer">
                  <input type="checkbox" checked={productForm[flag]} onChange={(e) => setProductForm({ ...productForm, [flag]: e.target.checked })} className="accent-gold-400" />
                  {flag.replace('is_', '').replace('_', ' ')}
                </label>
              ))}
            </div>
            <button type="submit" className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider">Create Product</button>
          </form>
        </Modal>
      )}

      {/* Category form modal */}
      {showCategoryForm && (
        <Modal title="Add Category" onClose={() => setShowCategoryForm(false)}>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <input type="text" required placeholder="Category Name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="input-field" />
            <textarea placeholder="Description" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2} className="input-field resize-none" />
            <input type="text" placeholder="Image URL" value={categoryForm.image_url} onChange={(e) => setCategoryForm({ ...categoryForm, image_url: e.target.value })} className="input-field" />
            <button type="submit" className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider">Create Category</button>
          </form>
        </Modal>
      )}

      {/* Coupon form modal */}
      {showCouponForm && (
        <Modal title="Add Coupon" onClose={() => setShowCouponForm(false)}>
          <form onSubmit={handleCreateCoupon} className="space-y-4">
            <input type="text" required placeholder="Coupon Code" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} className="input-field" />
            <select value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })} className="input-field">
              <option value="percent" className="bg-ink-900">Percentage</option>
              <option value="fixed" className="bg-ink-900">Fixed Amount</option>
            </select>
            <input type="number" required placeholder="Value" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} className="input-field" />
            <input type="number" placeholder="Minimum Order" value={couponForm.min_order} onChange={(e) => setCouponForm({ ...couponForm, min_order: e.target.value })} className="input-field" />
            <button type="submit" className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider">Create Coupon</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative glass-dark rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function ReviewsManager() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<(Review & { product: { id: string; name: string; slug: string } | null; profile: { id: string; email: string; full_name: string | null } | null })[]>([]);

  useEffect(() => {
    getAllReviews().then(setReviews);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    try {
      await deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast('Review deleted');
    } catch {
      toast('Failed to delete review', 'error');
    }
  };

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.id} className="glass rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">{review.profile?.full_name || review.profile?.email?.split('@')[0] || 'Anonymous'}</span>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={classNames('w-3 h-3', i < review.rating ? 'fill-gold-400 text-gold-400' : 'text-ink-700')} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-ink-400">{review.product?.name}</p>
              {review.title && <p className="text-sm text-white mt-1">{review.title}</p>}
              <p className="text-sm text-ink-300 mt-1">{review.comment}</p>
            </div>
            <button onClick={() => handleDelete(review.id)} className="text-ink-500 hover:text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      {reviews.length === 0 && <div className="glass rounded-2xl p-8 text-center text-ink-400 text-sm">No reviews</div>}
    </div>
  );
}
