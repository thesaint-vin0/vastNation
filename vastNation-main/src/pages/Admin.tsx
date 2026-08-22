import { supabase } from '../lib/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Users,
  Star,
  Ticket,
  BarChart3,
  Plus,
  Trash2,
  X,
  RefreshCw,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import {
  getProducts,
  getCategories,
  getCoupons,
  deleteProduct,
  createCategory,
  deleteCategory,
  createCoupon,
  deleteCoupon,
  updateOrderStatus,
  updateProduct,
  deleteReview,
} from '../services/api';

import {
  formatNaira,
  formatDate,
  classNames,
  slugify,
} from '../utils/helpers';

import type {
  Product,
  Category,
  Order,
  Profile,
  Coupon,
  Review,
} from '../types';

import {
  uploadProductImage,
  uploadCategoryImage,
  deleteStorageImage,
} from '../services/storage';

import { useRealtimeAdmin } from '../hooks/useRealtimeAdmin';

type Tab =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'reviews'
  | 'coupons';

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

type ProductFlag =
  | 'is_featured'
  | 'is_new'
  | 'is_bestseller'
  | 'is_trending'
  | 'is_limited';

type AdminReview = Review & {
  product?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  profile?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
};

const EMPTY_PRODUCT_FORM = {
  name: '',
  description: '',
  price: '',
  compare_at_price: '',
  category_id: '',
  images: [] as File[],
  sizes: 'S,M,L,XL',
  colors: 'Black,White',
  stock: '10',
  badge: '',
  is_featured: false,
  is_new: false,
  is_bestseller: false,
  is_trending: false,
  is_limited: false,
};

const EMPTY_CATEGORY_FORM = {
  name: '',
  description: '',
  image: null as File | null,
};

const EMPTY_COUPON_FORM = {
  code: '',
  type: 'percent',
  value: '',
  min_order: '0',
};

const PRODUCT_FLAGS: ProductFlag[] = [
  'is_featured',
  'is_new',
  'is_bestseller',
  'is_trending',
  'is_limited',
];

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
];

export default function Admin() {
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('dashboard');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);

  const [dataLoading, setDataLoading] = useState(false);

  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);

  const [productForm, setProductForm] = useState({
    ...EMPTY_PRODUCT_FORM,
  });

  const [categoryForm, setCategoryForm] = useState({
    ...EMPTY_CATEGORY_FORM,
  });

  const [couponForm, setCouponForm] = useState({
    ...EMPTY_COUPON_FORM,
  });

  const productImageInputRef =
    useRef<HTMLInputElement>(null);

  const categoryImageInputRef =
    useRef<HTMLInputElement>(null);

  /*
   * ============================================================
   * PRODUCT IMAGE SELECTION
   * ============================================================
   */

  const handleProductImages = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files ?? []);

    if (!files.length) {
      return;
    }

    const validFiles: File[] = [];

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast(
          `${file.name} is larger than 5MB`,
          'error',
        );
        continue;
      }

      if (!file.type.startsWith('image/')) {
        toast(
          `${file.name} is not a valid image`,
          'error',
        );
        continue;
      }

      validFiles.push(file);
    }

    setProductForm((prev) => ({
      ...prev,
      images: [
        ...prev.images,
        ...validFiles,
      ].slice(0, 6),
    }));

    e.target.value = '';
  };

  /*
   * ============================================================
   * CATEGORY IMAGE SELECTION
   * ============================================================
   */

  const handleCategoryImage = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast(
        'Category image must be less than 5MB',
        'error',
      );
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast(
        'Please select a valid image',
        'error',
      );
      e.target.value = '';
      return;
    }

    setCategoryForm((prev) => ({
      ...prev,
      image: file,
    }));

    e.target.value = '';
  };

  /*
   * ============================================================
   * LOAD PRODUCTS
   * ============================================================
   */

  const refreshProducts = useCallback(async () => {
    try {
      const data = await getProducts({
        limit: 100,
      });

      setProducts(data);
    } catch (error) {
      console.error(
        'Failed to load products:',
        error,
      );

      toast(
        'Failed to load products',
        'error',
      );
    }
  }, [toast]);

  /*
   * ============================================================
   * LOAD CATEGORIES
   * ============================================================
   */

  const refreshCategories = useCallback(async () => {
    try {
      const data = await getCategories();

      setCategories(data);
    } catch (error) {
      console.error(
        'Failed to load categories:',
        error,
      );

      toast(
        'Failed to load categories',
        'error',
      );
    }
  }, [toast]);

  /*
   * ============================================================
   * LOAD COUPONS
   * ============================================================
   */

  const refreshCoupons = useCallback(async () => {
    try {
      const data = await getCoupons();

      setCoupons(data);
    } catch (error) {
      console.error(
        'Failed to load coupons:',
        error,
      );

      toast(
        'Failed to load coupons',
        'error',
      );
    }
  }, [toast]);

  /*
   * ============================================================
   * LOAD ORDERS
   * ============================================================
   */

  const refreshOrders = useCallback(async () => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Failed to load orders:',
          error,
        );

        throw error;
      }

      setOrders(
        (data ?? []) as Order[],
      );
    } catch (error) {
      console.error(
        'refreshOrders error:',
        error,
      );

      toast(
        'Failed to load orders',
        'error',
      );
    }
  }, [toast]);

  /*
   * ============================================================
   * LOAD CUSTOMERS
   * ============================================================
   */

  const refreshCustomers = useCallback(async () => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Failed to load customers:',
          error,
        );

        throw error;
      }

      setCustomers(
        (data ?? []) as Profile[],
      );
    } catch (error) {
      console.error(
        'refreshCustomers error:',
        error,
      );

      toast(
        'Failed to load customers',
        'error',
      );
    }
  }, [toast]);

  /*
   * ============================================================
   * LOAD REVIEWS
   * ============================================================
   */

  const refreshReviews = useCallback(async () => {
    try {
      const {
        data: reviewData,
        error: reviewError,
      } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (reviewError) {
        console.error(
          'Failed to load reviews:',
          reviewError,
        );

        throw reviewError;
      }

      const rawReviews = reviewData ?? [];

      const productIds = [
        ...new Set(
          rawReviews
            .map(
              (review) =>
                review.product_id,
            )
            .filter(Boolean),
        ),
      ];

      const userIds = [
        ...new Set(
          rawReviews
            .map(
              (review) =>
                review.user_id,
            )
            .filter(Boolean),
        ),
      ];

      let productMap = new Map<
        string,
        {
          id: string;
          name: string;
          slug: string;
        }
      >();

      if (productIds.length > 0) {
        const {
          data: productData,
          error: productError,
        } = await supabase
          .from('products')
          .select('id,name,slug')
          .in('id', productIds);

        if (productError) {
          console.error(
            'Failed to load review products:',
            productError,
          );
        } else {
          productMap = new Map(
            (productData ?? []).map(
              (product) => [
                product.id,
                product,
              ],
            ),
          );
        }
      }

      let profileMap = new Map<
        string,
        {
          id: string;
          email: string;
          full_name: string | null;
        }
      >();

      if (userIds.length > 0) {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'id,email,full_name',
          )
          .in('id', userIds);

        if (profileError) {
          console.error(
            'Failed to load review profiles:',
            profileError,
          );
        } else {
          profileMap = new Map(
            (profileData ?? []).map(
              (reviewProfile) => [
                reviewProfile.id,
                reviewProfile,
              ],
            ),
          );
        }
      }

      const formattedReviews: AdminReview[] =
        rawReviews.map((review) => ({
          ...review,
          product:
            productMap.get(
              review.product_id,
            ) ?? null,
          profile:
            profileMap.get(
              review.user_id,
            ) ?? null,
        }));

      setReviews(formattedReviews);
    } catch (error) {
      console.error(
        'refreshReviews error:',
        error,
      );

      toast(
        'Failed to load reviews',
        'error',
      );
    }
  }, [toast]);

  /*
   * ============================================================
   * LOAD EVERYTHING
   * ============================================================
   */

  const loadAdminData = useCallback(async () => {
    if (
      !user ||
      profile?.role !== 'admin'
    ) {
      return;
    }

    setDataLoading(true);

    try {
      await Promise.all([
        refreshProducts(),
        refreshCategories(),
        refreshOrders(),
        refreshCustomers(),
        refreshReviews(),
        refreshCoupons(),
      ]);
    } catch (error) {
      console.error(
        'Failed to load admin data:',
        error,
      );
    } finally {
      setDataLoading(false);
    }
  }, [
    user,
    profile?.role,
    refreshProducts,
    refreshCategories,
    refreshOrders,
    refreshCustomers,
    refreshReviews,
    refreshCoupons,
  ]);

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    if (
      !user ||
      profile?.role !== 'admin'
    ) {
      return;
    }

    void loadAdminData();
  }, [
    user,
    profile?.role,
    loadAdminData,
  ]);

  /*
   * ============================================================
   * REALTIME
   * ============================================================
   */

  useRealtimeAdmin({
    onOrdersChange: refreshOrders,
    onCustomersChange: refreshCustomers,
    onReviewsChange: refreshReviews,
  });

  /*
   * ============================================================
   * AUTH GUARDS
   * ============================================================
   */

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gold-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    profile &&
    profile.role !== 'admin'
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  /*
   * ============================================================
   * CREATE PRODUCT
   * ============================================================
   */

  const handleCreateProduct = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    const name =
      productForm.name.trim();

    const description =
      productForm.description.trim();

    const price = Number(
      productForm.price,
    );

    const stock = Number(
      productForm.stock,
    );

    const compareAtPrice =
      productForm.compare_at_price
        ? Number(
            productForm.compare_at_price,
          )
        : null;

    if (!name) {
      toast(
        'Product name is required',
        'error',
      );
      return;
    }

    if (!description) {
      toast(
        'Product description is required',
        'error',
      );
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      toast(
        'Enter a valid product price',
        'error',
      );
      return;
    }

    if (
      compareAtPrice !== null &&
      (!Number.isFinite(
        compareAtPrice,
      ) ||
        compareAtPrice < 0)
    ) {
      toast(
        'Enter a valid compare-at price',
        'error',
      );
      return;
    }

    if (
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      toast(
        'Enter a valid stock quantity',
        'error',
      );
      return;
    }

    if (
      productForm.images.length === 0
    ) {
      toast(
        'Please select at least one product image',
        'error',
      );
      return;
    }

    try {
      const productId =
        crypto.randomUUID();

      const uploadedImages =
        await Promise.all(
          productForm.images.map(
            (file) =>
              uploadProductImage(
                file,
                productId,
              ),
          ),
        );

      const {
        error,
      } = await supabase
        .from('products')
        .insert({
          id: productId,
          name,
          slug: slugify(name),
          description,
          price,
          compare_at_price:
            compareAtPrice,
          category_id:
            productForm.category_id ||
            null,
          images: uploadedImages,
          sizes: productForm.sizes
            .split(',')
            .map((size) =>
              size.trim(),
            )
            .filter(Boolean),
          colors: productForm.colors
            .split(',')
            .map((color) =>
              color.trim(),
            )
            .filter(Boolean),
          stock,
          badge:
            productForm.badge ||
            null,
          is_featured:
            productForm.is_featured,
          is_new:
            productForm.is_new,
          is_bestseller:
            productForm.is_bestseller,
          is_trending:
            productForm.is_trending,
          is_limited:
            productForm.is_limited,
          rating: 0,
          review_count: 0,
        });

      if (error) {
        throw error;
      }

      toast(
        'Product created successfully',
      );

      setShowProductForm(false);

      setProductForm({
        ...EMPTY_PRODUCT_FORM,
        images: [],
      });

      await refreshProducts();
    } catch (error) {
      console.error(
        'Failed to create product:',
        error,
      );

      toast(
        'Failed to create product',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * DELETE PRODUCT
   * ============================================================
   */

  const handleDeleteProduct = async (
    product: Product,
  ) => {
    if (
      !window.confirm(
        `Delete "${product.name}"?`,
      )
    ) {
      return;
    }

    try {
      if (
        product.images &&
        product.images.length > 0
      ) {
        for (const imageUrl of product.images) {
          try {
            await deleteStorageImage(
              imageUrl,
            );
          } catch (error) {
            console.error(
              'Failed to delete product image:',
              error,
            );
          }
        }
      }

      await deleteProduct(
        product.id,
      );

      setProducts((previous) =>
        previous.filter(
          (item) =>
            item.id !== product.id,
        ),
      );

      toast('Product deleted');
    } catch (error) {
      console.error(
        'Failed to delete product:',
        error,
      );

      toast(
        'Failed to delete product',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * CREATE CATEGORY
   * ============================================================
   */

  const handleCreateCategory = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    const name =
      categoryForm.name.trim();

    if (!name) {
      toast(
        'Category name is required',
        'error',
      );
      return;
    }

    if (!categoryForm.image) {
      toast(
        'Please select a category image',
        'error',
      );
      return;
    }

    try {
      const categoryId =
        crypto.randomUUID();

      const imageUrl =
        await uploadCategoryImage(
          categoryForm.image,
          categoryId,
        );

      await createCategory({
        id: categoryId,
        name,
        slug: slugify(name),
        description:
          categoryForm.description.trim(),
        image_url: imageUrl,
      });

      toast(
        'Category created successfully',
      );

      setShowCategoryForm(false);

      setCategoryForm({
        ...EMPTY_CATEGORY_FORM,
      });

      await refreshCategories();
    } catch (error) {
      console.error(
        'Failed to create category:',
        error,
      );

      toast(
        'Failed to create category',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * DELETE CATEGORY
   * ============================================================
   */

  const handleDeleteCategory = async (
    id: string,
  ) => {
    if (
      !window.confirm(
        'Delete this category?',
      )
    ) {
      return;
    }

    try {
      await deleteCategory(id);

      setCategories((previous) =>
        previous.filter(
          (category) =>
            category.id !== id,
        ),
      );

      toast('Category deleted');
    } catch (error) {
      console.error(
        'Failed to delete category:',
        error,
      );

      toast(
        'Failed to delete category',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * CREATE COUPON
   * ============================================================
   */

  const handleCreateCoupon = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    const code =
      couponForm.code
        .trim()
        .toUpperCase();

    const value = Number(
      couponForm.value,
    );

    const minOrder = Number(
      couponForm.min_order || 0,
    );

    if (!code) {
      toast(
        'Coupon code is required',
        'error',
      );
      return;
    }

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      toast(
        'Enter a valid coupon value',
        'error',
      );
      return;
    }

    if (
      couponForm.type === 'percent' &&
      value > 100
    ) {
      toast(
        'Percentage discount cannot exceed 100%',
        'error',
      );
      return;
    }

    if (
      !Number.isFinite(minOrder) ||
      minOrder < 0
    ) {
      toast(
        'Enter a valid minimum order amount',
        'error',
      );
      return;
    }

    try {
      await createCoupon({
        code,
        type:
          couponForm.type as
            | 'percent'
            | 'fixed',
        value,
        min_order: minOrder,
        active: true,
        expires_at: null,
      });

      toast(
        'Coupon created successfully',
      );

      setShowCouponForm(false);

      setCouponForm({
        ...EMPTY_COUPON_FORM,
      });

      await refreshCoupons();
    } catch (error) {
      console.error(
        'Failed to create coupon:',
        error,
      );

      toast(
        'Failed to create coupon',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * DELETE COUPON
   * ============================================================
   */

  const handleDeleteCoupon = async (
    id: string,
  ) => {
    if (
      !window.confirm(
        'Delete this coupon?',
      )
    ) {
      return;
    }

    try {
      await deleteCoupon(id);

      setCoupons((previous) =>
        previous.filter(
          (coupon) =>
            coupon.id !== id,
        ),
      );

      toast('Coupon deleted');
    } catch (error) {
      console.error(
        'Failed to delete coupon:',
        error,
      );

      toast(
        'Failed to delete coupon',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * UPDATE ORDER STATUS
   * ============================================================
   */

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
  ) => {
    const previousOrders =
      orders;

    setOrders((previous) =>
      previous.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status,
            }
          : order,
      ),
    );

    try {
      await updateOrderStatus(
        orderId,
        status,
      );

      toast(
        'Order status updated',
      );

      await refreshOrders();
    } catch (error) {
      console.error(
        'Failed to update order status:',
        error,
      );

      setOrders(previousOrders);

      toast(
        'Failed to update order',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * TOGGLE PRODUCT FLAG
   * ============================================================
   */

  const handleToggleFlag = async (
    product: Product,
    flag: ProductFlag,
  ) => {
    try {
      const currentValue =
        Boolean(product[flag]);

      await updateProduct(
        product.id,
        {
          [flag]: !currentValue,
        } as Partial<Product>,
      );

      setProducts((previous) =>
        previous.map((item) =>
          item.id === product.id
            ? {
                ...item,
                [flag]:
                  !currentValue,
              }
            : item,
        ),
      );

      toast(
        'Product updated',
      );
    } catch (error) {
      console.error(
        'Failed to update product:',
        error,
      );

      toast(
        'Failed to update product',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * DELETE REVIEW
   * ============================================================
   */

  const handleDeleteReview = async (
    id: string,
  ) => {
    if (
      !window.confirm(
        'Delete this review?',
      )
    ) {
      return;
    }

    try {
      await deleteReview(id);

      setReviews((previous) =>
        previous.filter(
          (review) =>
            review.id !== id,
        ),
      );

      toast('Review deleted');
    } catch (error) {
      console.error(
        'Failed to delete review:',
        error,
      );

      toast(
        'Failed to delete review',
        'error',
      );
    }
  };

  /*
   * ============================================================
   * STATISTICS
   * ============================================================
   */

  const totalRevenue =
    orders
      .filter(
        (order) =>
          order.payment_status ===
            'paid' ||
          order.status === 'paid' ||
          order.status ===
            'delivered',
      )
      .reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0,
      );

  const totalOrders =
    orders.length;

  const totalCustomers =
    customers.filter(
      (customer) =>
        customer.role ===
        'customer',
    ).length;

  const totalProducts =
    products.length;

  const paidOrders =
    orders.filter(
      (order) =>
        order.payment_status ===
          'paid' ||
        order.status === 'paid',
    ).length;

  const pendingPayments =
    orders.filter(
      (order) =>
        order.payment_status ===
          'pending' &&
        order.status !==
          'cancelled',
    ).length;

  /*
   * ============================================================
   * MENU
   * ============================================================
   */

  const menuItems: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{
      className?: string;
    }>;
  }[] = [
    {
      id: 'dashboard',
      label: 'Analytics',
      icon: LayoutDashboard,
    },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
    },
    {
      id: 'categories',
      label: 'Categories',
      icon: Tag,
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingCart,
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
    },
    {
      id: 'reviews',
      label: 'Reviews',
      icon: Star,
    },
    {
      id: 'coupons',
      label: 'Coupons',
      icon: Ticket,
    },
  ];

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="section-padding py-8 lg:py-12">
      <div className="grid lg:grid-cols-5 gap-8">

        {/* SIDEBAR */}

        <aside className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-28">

            <div className="mb-6 pb-6 border-b border-white/10">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-1">
                Admin Panel
              </p>

              <p className="text-sm font-semibold text-white truncate">
                {profile?.full_name ||
                  profile?.email ||
                  'Admin'}
              </p>
            </div>

            <nav className="space-y-1">
              {menuItems.map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setTab(item.id)
                    }
                    className={classNames(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                      tab ===
                        item.id
                        ? 'bg-gold-400/10 text-gold-400 font-medium'
                        : 'text-ink-300 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <item.icon className="w-4 h-4" />

                    {item.label}
                  </button>
                ),
              )}

              <Link
                to="/"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <BarChart3 className="w-4 h-4" />
                View Store
              </Link>
            </nav>
          </div>
        </aside>

        {/* CONTENT */}

        <main className="lg:col-span-4">

          {/* REFRESH */}

          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() =>
                void loadAdminData()
              }
              disabled={dataLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink-300 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw
                className={classNames(
                  'w-4 h-4',
                  dataLoading &&
                    'animate-spin',
                )}
              />

              Refresh
            </button>
          </div>

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
                Analytics Dashboard
              </h1>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                <StatCard
                  label="Total Revenue"
                  value={formatNaira(
                    totalRevenue,
                  )}
                  icon={BarChart3}
                  color="text-gold-400"
                />

                <StatCard
                  label="Total Orders"
                  value={totalOrders}
                  icon={ShoppingCart}
                  color="text-blue-400"
                />

                <StatCard
                  label="Customers"
                  value={totalCustomers}
                  icon={Users}
                  color="text-green-400"
                />

                <StatCard
                  label="Products"
                  value={totalProducts}
                  icon={Package}
                  color="text-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">

                <div className="glass rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-green-400" />
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-white">
                        {paidOrders}
                      </p>

                      <p className="text-xs text-ink-400">
                        Paid Orders
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-white">
                        {pendingPayments}
                      </p>

                      <p className="text-xs text-ink-400">
                        Pending Payments
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  Recent Orders
                </h2>

                <div className="glass rounded-2xl overflow-hidden">
                  {orders
                    .slice(0, 5)
                    .map(
                      (
                        order,
                        index,
                      ) => (
                        <div
                          key={order.id}
                          className={classNames(
                            'flex items-center justify-between p-4',
                            index !== 0 &&
                              'border-t border-white/5',
                          )}
                        >
                          <div>
                            <p className="text-sm font-mono text-white">
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

                          <div className="flex items-center gap-3">
                            <PaymentStatus
                              status={
                                order.payment_status
                              }
                            />

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
                      ),
                    )}

                  {orders.length ===
                    0 && (
                    <p className="p-6 text-center text-ink-400 text-sm">
                      No orders yet
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* PRODUCTS */}

          {tab === 'products' && (
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
                  Manage Products
                </h1>

                <button
                  type="button"
                  onClick={() =>
                    setShowProductForm(
                      true,
                    )
                  }
                  className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              <div className="glass rounded-2xl overflow-hidden">
                {products.map(
                  (
                    product,
                    index,
                  ) => (
                    <div
                      key={product.id}
                      className={classNames(
                        'flex items-center gap-4 p-4',
                        index !== 0 &&
                          'border-t border-white/5',
                      )}
                    >
                      <img
                        src={
                          product.images?.[0] ||
                          '/placeholder-product.png'
                        }
                        alt={product.name}
                        className="w-12 h-16 object-cover rounded-lg shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {product.name}
                        </p>

                        <p className="text-xs text-ink-400">
                          {formatNaira(
                            Number(
                              product.price ||
                                0,
                            ),
                          )}{' '}
                          · Stock:{' '}
                          {product.stock}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        {PRODUCT_FLAGS.map(
                          (flag) => (
                            <button
                              key={flag}
                              type="button"
                              title={flag}
                              onClick={() =>
                                void handleToggleFlag(
                                  product,
                                  flag,
                                )
                              }
                              className={classNames(
                                'w-7 h-7 rounded text-[9px] font-bold transition-all',
                                product[
                                  flag
                                ]
                                  ? 'bg-gold-400 text-ink-950'
                                  : 'bg-ink-800 text-ink-500 hover:text-white',
                              )}
                            >
                              {flag ===
                              'is_featured'
                                ? 'F'
                                : flag ===
                                    'is_new'
                                  ? 'N'
                                  : flag ===
                                      'is_bestseller'
                                    ? 'B'
                                    : flag ===
                                        'is_trending'
                                      ? 'T'
                                      : 'L'}
                            </button>
                          ),
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteProduct(
                            product,
                          )
                        }
                        className="text-ink-500 hover:text-red-400"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ),
                )}

                {products.length ===
                  0 && (
                  <p className="p-6 text-center text-ink-400 text-sm">
                    No products
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* CATEGORIES */}

          {tab === 'categories' && (
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
                  Manage Categories
                </h1>

                <button
                  type="button"
                  onClick={() =>
                    setShowCategoryForm(
                      true,
                    )
                  }
                  className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(
                  (category) => (
                    <div
                      key={category.id}
                      className="glass rounded-2xl overflow-hidden"
                    >
                      {category.image_url && (
                        <img
                          src={
                            category.image_url
                          }
                          alt={
                            category.name
                          }
                          className="w-full h-32 object-cover"
                        />
                      )}

                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {
                              category.name
                            }
                          </p>

                          <p className="text-xs text-ink-400">
                            {
                              category.slug
                            }
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteCategory(
                              category.id,
                            )
                          }
                          className="text-ink-500 hover:text-red-400"
                          title="Delete category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ),
                )}

                {categories.length ===
                  0 && (
                  <p className="text-ink-400 text-sm col-span-full text-center py-8">
                    No categories
                  </p>
                )}
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
                Manage Orders
              </h1>

              <div className="space-y-4">
                {orders.map(
                  (order) => (
                    <div
                      key={order.id}
                      className="glass rounded-2xl p-5"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-4">

                        <div>
                          <p className="text-sm font-mono font-medium text-white">
                            {
                              order.order_number
                            }
                          </p>

                          <p className="text-xs text-ink-400 mt-1">
                            {formatDate(
                              order.created_at,
                            )}
                          </p>

                          <p className="text-xs text-ink-400 mt-2">
                            Payment ref:{' '}
                            <span className="text-white">
                              {order.payment_reference ||
                                order.payment_ref ||
                                'N/A'}
                            </span>
                          </p>

                          <p className="text-xs text-ink-400 mt-1">
                            Paystack TX:{' '}
                            <span className="text-white">
                              {order.paystack_transaction_id ||
                                'N/A'}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <PaymentStatus
                            status={
                              order.payment_status
                            }
                          />

                          <select
                            value={
                              order.status ||
                              'pending'
                            }
                            onChange={(
                              event,
                            ) =>
                              void handleUpdateOrderStatus(
                                order.id,
                                event
                                  .target
                                  .value as OrderStatus,
                              )
                            }
                            className="bg-ink-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                          >
                            {ORDER_STATUSES.map(
                              (
                                status,
                              ) => (
                                <option
                                  key={
                                    status
                                  }
                                  value={
                                    status
                                  }
                                  className="bg-ink-900"
                                >
                                  {
                                    status
                                  }
                                </option>
                              ),
                            )}
                          </select>

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
                  ),
                )}

                {orders.length ===
                  0 && (
                  <div className="glass rounded-2xl p-8 text-center text-ink-400 text-sm">
                    No orders
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* CUSTOMERS */}

          {tab === 'customers' && (
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
                Manage Customers
              </h1>

              <div className="glass rounded-2xl overflow-hidden">
                {customers.map(
                  (
                    customer,
                    index,
                  ) => (
                    <div
                      key={
                        customer.id
                      }
                      className={classNames(
                        'flex items-center justify-between p-4',
                        index !== 0 &&
                          'border-t border-white/5',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-400 font-bold text-sm">
                          {(
                            customer.full_name?.[0] ??
                            customer.email?.[0] ??
                            '?'
                          ).toUpperCase()}
                        </div>

                        <div>
                          <p className="text-sm font-medium text-white">
                            {customer.full_name ||
                              'Unknown'}
                          </p>

                          <p className="text-xs text-ink-400">
                            {
                              customer.email
                            }
                          </p>

                          {customer.phone && (
                            <p className="text-xs text-ink-500">
                              {
                                customer.phone
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={classNames(
                          'text-xs px-3 py-1 rounded-full',
                          customer.role ===
                            'admin'
                            ? 'bg-gold-400/20 text-gold-400'
                            : 'bg-blue-500/20 text-blue-400',
                        )}
                      >
                        {
                          customer.role
                        }
                      </span>
                    </div>
                  ),
                )}

                {customers.length ===
                  0 && (
                  <p className="p-6 text-center text-ink-400 text-sm">
                    No customers
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* REVIEWS */}

          {tab === 'reviews' && (
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
                  Manage Reviews
                </h1>

                <span className="text-xs text-ink-400">
                  {reviews.length}{' '}
                  reviews
                </span>
              </div>

              <div className="space-y-3">
                {reviews.map(
                  (review) => (
                    <div
                      key={review.id}
                      className="glass rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              {review
                                .profile
                                ?.full_name ||
                                review
                                  .profile
                                  ?.email
                                  ?.split(
                                    '@',
                                  )[0] ||
                                'Anonymous'}
                            </span>

                            <div className="flex">
                              {Array.from(
                                {
                                  length: 5,
                                },
                              ).map(
                                (
                                  _,
                                  index,
                                ) => (
                                  <Star
                                    key={
                                      index
                                    }
                                    className={classNames(
                                      'w-3 h-3',
                                      index <
                                        Number(
                                          review.rating ||
                                            0,
                                        )
                                        ? 'fill-gold-400 text-gold-400'
                                        : 'text-ink-700',
                                    )}
                                  />
                                ),
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-gold-400">
                            {review
                              .product
                              ?.name ||
                              'Product unavailable'}
                          </p>

                          {review.title && (
                            <p className="text-sm text-white mt-2">
                              {
                                review.title
                              }
                            </p>
                          )}

                          <p className="text-sm text-ink-300 mt-1">
                            {
                              review.comment
                            }
                          </p>

                          <p className="text-[10px] text-ink-500 mt-2">
                            {formatDate(
                              review.created_at,
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteReview(
                              review.id,
                            )
                          }
                          className="text-ink-500 hover:text-red-400"
                          title="Delete review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ),
                )}

                {reviews.length ===
                  0 && (
                  <div className="glass rounded-2xl p-8 text-center text-ink-400 text-sm">
                    No reviews
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* COUPONS */}

          {tab === 'coupons' && (
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
                  Manage Coupons
                </h1>

                <button
                  type="button"
                  onClick={() =>
                    setShowCouponForm(
                      true,
                    )
                  }
                  className="btn-gold rounded-lg px-4 py-2 text-sm uppercase tracking-wider flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Coupon
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.map(
                  (coupon) => (
                    <div
                      key={coupon.id}
                      className="glass rounded-2xl p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Ticket className="w-6 h-6 text-gold-400" />

                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteCoupon(
                              coupon.id,
                            )
                          }
                          className="text-ink-500 hover:text-red-400"
                          title="Delete coupon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-lg font-mono font-bold text-white">
                        {
                          coupon.code
                        }
                      </p>

                      <p className="text-sm text-gold-400 mt-1">
                        {coupon.type ===
                        'percent'
                          ? `${coupon.value}% off`
                          : `${formatNaira(
                              Number(
                                coupon.value ||
                                  0,
                              ),
                            )} off`}
                      </p>

                      <p className="text-xs text-ink-400 mt-2">
                        Min order:{' '}
                        {formatNaira(
                          Number(
                            coupon.min_order ||
                              0,
                          ),
                        )}
                      </p>

                      <span
                        className={classNames(
                          'inline-block mt-2 text-xs px-2 py-0.5 rounded-full',
                          coupon.active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400',
                        )}
                      >
                        {coupon.active
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </div>
                  ),
                )}

                {coupons.length ===
                  0 && (
                  <p className="text-ink-400 text-sm col-span-full text-center py-8">
                    No coupons
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* PRODUCT MODAL */}

      {showProductForm && (
        <Modal
          title="Add Product"
          onClose={() =>
            setShowProductForm(false)
          }
        >
          <form
            onSubmit={
              handleCreateProduct
            }
            className="space-y-4"
          >
            <input
              type="text"
              required
              placeholder="Product Name"
              value={
                productForm.name
              }
              onChange={(event) =>
                setProductForm(
                  (previous) => ({
                    ...previous,
                    name:
                      event.target
                        .value,
                  }),
                )
              }
              className="input-field"
            />

            <textarea
              required
              placeholder="Description"
              value={
                productForm.description
              }
              onChange={(event) =>
                setProductForm(
                  (previous) => ({
                    ...previous,
                    description:
                      event.target
                        .value,
                  }),
                )
              }
              rows={3}
              className="input-field resize-none"
            />

            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="Price (NGN)"
                value={
                  productForm.price
                }
                onChange={(event) =>
                  setProductForm(
                    (previous) => ({
                      ...previous,
                      price:
                        event.target
                          .value,
                    }),
                  )
                }
                className="input-field"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Compare at Price"
                value={
                  productForm.compare_at_price
                }
                onChange={(event) =>
                  setProductForm(
                    (previous) => ({
                      ...previous,
                      compare_at_price:
                        event.target
                          .value,
                    }),
                  )
                }
                className="input-field"
              />
            </div>

            <select
              value={
                productForm.category_id
              }
              onChange={(event) =>
                setProductForm(
                  (previous) => ({
                    ...previous,
                    category_id:
                      event.target
                        .value,
                  }),
                )
              }
              className="input-field"
            >
              <option value="">
                Select Category
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={
                      category.id
                    }
                    className="bg-ink-900"
                  >
                    {
                      category.name
                    }
                  </option>
                ),
              )}
            </select>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">
                Product Images
              </label>

              <input
                ref={
                  productImageInputRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={
                  handleProductImages
                }
                className="hidden"
              />

              <button
                type="button"
                onClick={() =>
                  productImageInputRef.current?.click()
                }
                className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-ink-300 hover:border-gold-400/50 hover:bg-white/10"
              >
                Click to upload product images

                <span className="block text-xs text-ink-500 mt-1">
                  JPG, PNG, WEBP or GIF · Maximum
                  5MB each · Up to 6 images
                </span>
              </button>

              {productForm.images.length >
                0 && (
                <div className="grid grid-cols-3 gap-3">
                  {productForm.images.map(
                    (
                      file,
                      index,
                    ) => (
                      <ProductImagePreview
                        key={`${file.name}-${file.lastModified}-${index}`}
                        file={file}
                        index={index}
                        onRemove={() =>
                          setProductForm(
                            (previous) => ({
                              ...previous,
                              images:
                                previous.images.filter(
                                  (
                                    _,
                                    imageIndex,
                                  ) =>
                                    imageIndex !==
                                    index,
                                ),
                            }),
                          )
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                required
                placeholder="Sizes"
                value={
                  productForm.sizes
                }
                onChange={(event) =>
                  setProductForm(
                    (previous) => ({
                      ...previous,
                      sizes:
                        event.target
                          .value,
                    }),
                  )
                }
                className="input-field"
              />

              <input
                type="text"
                required
                placeholder="Colors"
                value={
                  productForm.colors
                }
                onChange={(event) =>
                  setProductForm(
                    (previous) => ({
                      ...previous,
                      colors:
                        event.target
                          .value,
                    }),
                  )
                }
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                min="0"
                step="1"
                required
                placeholder="Stock"
                value={
                  productForm.stock
                }
                onChange={(event) =>
                  setProductForm(
                    (previous) => ({
                      ...previous,
                      stock:
                        event.target
                          .value,
                    }),
                  )
                }
                className="input-field"
              />

              <select
                value={
                  productForm.badge
                }
                onChange={(event) =>
                  setProductForm(
                    (previous) => ({
                      ...previous,
                      badge:
                        event.target
                          .value,
                    }),
                  )
                }
                className="input-field"
              >
                <option value="">
                  No Badge
                </option>

                {[
                  'New',
                  'Sale',
                  'Limited',
                  'Hot',
                  'Bestseller',
                ].map(
                  (badge) => (
                    <option
                      key={badge}
                      value={badge}
                      className="bg-ink-900"
                    >
                      {badge}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              {PRODUCT_FLAGS.map(
                (flag) => (
                  <label
                    key={flag}
                    className="flex items-center gap-2 text-xs text-ink-300"
                  >
                    <input
                      type="checkbox"
                      checked={
                        productForm[
                          flag
                        ]
                      }
                      onChange={(
                        event,
                      ) =>
                        setProductForm(
                          (previous) => ({
                            ...previous,
                            [flag]:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />

                    {flag
                      .replace(
                        'is_',
                        '',
                      )
                      .replace(
                        '_',
                        ' ',
                      )}
                  </label>
                ),
              )}
            </div>

            <button
              type="submit"
              className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider"
            >
              Create Product
            </button>
          </form>
        </Modal>
      )}

      {/* CATEGORY MODAL */}

      {showCategoryForm && (
        <Modal
          title="Add Category"
          onClose={() =>
            setShowCategoryForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreateCategory
            }
            className="space-y-4"
          >
            <input
              type="text"
              required
              placeholder="Category Name"
              value={
                categoryForm.name
              }
              onChange={(event) =>
                setCategoryForm(
                  (previous) => ({
                    ...previous,
                    name:
                      event.target
                        .value,
                  }),
                )
              }
              className="input-field"
            />

            <textarea
              placeholder="Description"
              value={
                categoryForm.description
              }
              onChange={(event) =>
                setCategoryForm(
                  (previous) => ({
                    ...previous,
                    description:
                      event.target
                        .value,
                  }),
                )
              }
              rows={2}
              className="input-field resize-none"
            />

            <input
              ref={
                categoryImageInputRef
              }
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={
                handleCategoryImage
              }
              className="hidden"
            />

            <button
              type="button"
              onClick={() =>
                categoryImageInputRef.current?.click()
              }
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-ink-300 hover:border-gold-400/50 hover:bg-white/10"
            >
              Click to upload category image

              <span className="block text-xs text-ink-500 mt-1">
                JPG, PNG, WEBP or GIF · Maximum
                5MB
              </span>
            </button>

            {categoryForm.image && (
              <CategoryImagePreview
                file={
                  categoryForm.image
                }
              />
            )}

            <button
              type="submit"
              className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider"
            >
              Create Category
            </button>
          </form>
        </Modal>
      )}

      {/* COUPON MODAL */}

      {showCouponForm && (
        <Modal
          title="Add Coupon"
          onClose={() =>
            setShowCouponForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreateCoupon
            }
            className="space-y-4"
          >
            <input
              type="text"
              required
              placeholder="Coupon Code"
              value={
                couponForm.code
              }
              onChange={(event) =>
                setCouponForm(
                  (previous) => ({
                    ...previous,
                    code:
                      event.target
                        .value,
                  }),
                )
              }
              className="input-field uppercase"
            />

            <select
              value={
                couponForm.type
              }
              onChange={(event) =>
                setCouponForm(
                  (previous) => ({
                    ...previous,
                    type:
                      event.target
                        .value,
                  }),
                )
              }
              className="input-field"
            >
              <option value="percent">
                Percentage
              </option>

              <option value="fixed">
                Fixed Amount
              </option>
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="Value"
              value={
                couponForm.value
              }
              onChange={(event) =>
                setCouponForm(
                  (previous) => ({
                    ...previous,
                    value:
                      event.target
                        .value,
                  }),
                )
              }
              className="input-field"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Minimum Order"
              value={
                couponForm.min_order
              }
              onChange={(event) =>
                setCouponForm(
                  (previous) => ({
                    ...previous,
                    min_order:
                      event.target
                        .value,
                  }),
                )
              }
              className="input-field"
            />

            <button
              type="submit"
              className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider"
            >
              Create Coupon
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/*
 * ============================================================
 * PRODUCT IMAGE PREVIEW
 * ============================================================
 */

function ProductImagePreview({
  file,
  index,
  onRemove,
}: {
  file: File;
  index: number;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] =
    useState('');

  useEffect(() => {
    const url =
      URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-ink-900">
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white hover:bg-red-500 transition"
        title="Remove image"
      >
        ×
      </button>

      {index === 0 && (
        <span className="absolute bottom-2 left-2 text-[10px] bg-gold-400 text-black px-2 py-1 rounded">
          Main
        </span>
      )}
    </div>
  );
}

/*
 * ============================================================
 * CATEGORY IMAGE PREVIEW
 * ============================================================
 */

function CategoryImagePreview({
  file,
}: {
  file: File;
}) {
  const [previewUrl, setPreviewUrl] =
    useState('');

  useEffect(() => {
    const url =
      URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-ink-900">
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

/*
 * ============================================================
 * PAYMENT STATUS
 * ============================================================
 */

function PaymentStatus({
  status,
}: {
  status?: string | null;
}) {
  const value =
    status || 'pending';

  if (value === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400">
        <CheckCircle className="w-3 h-3" />
        Paid
      </span>
    );
  }

  if (
    value === 'failed' ||
    value === 'cancelled'
  ) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400">
        <XCircle className="w-3 h-3" />
        {value}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
      <Clock className="w-3 h-3" />
      Pending
    </span>
  );
}

/*
 * ============================================================
 * STAT CARD
 * ============================================================
 */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{
    className?: string;
  }>;
  color: string;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="glass rounded-2xl p-5"
    >
      <Icon
        className={classNames(
          'w-6 h-6 mb-3',
          color,
        )}
      />

      <p className="text-2xl font-bold text-white">
        {value}
      </p>

      <p className="text-xs text-ink-400 mt-1">
        {label}
      </p>
    </motion.div>
  );
}

/*
 * ============================================================
 * MODAL
 * ============================================================
 */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{
          opacity: 0,
          scale: 0.95,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        className="relative glass-dark rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-white">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-white"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {children}
      </motion.div>
    </div>
  );
}