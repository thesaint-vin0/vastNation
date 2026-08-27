import { supabase } from '../lib/supabase';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  Pencil,
  Save,
  Settings,
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
import AdminNotifications from '../components/AdminNotifications';

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
  | 'processing'
  | 'shipping'
  | 'delivered'
  | 'cancelled';

type ProductFlag =
  | 'is_featured'
  | 'is_new'
  | 'is_bestseller'
  | 'is_trending'
  | 'is_limited';

type PaymentRecord = {
  id: string;
  order_id: string;
  user_id: string;
  reference: string | null;
  amount: number | string | null;
  status: string | null;
  channel: string | null;
  created_at: string;
};

type AdminOrder = Order & {
  reconciled_payment_status?: string;
  payment_record?: PaymentRecord | null;
};

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

type ProductForm = {
  name: string;
  description: string;
  price: string;
  compare_at_price: string;
  category_id: string;
  images: File[];
  existingImages: string[];
  sizes: string;
  colors: string;
  stock: string;
  badge: string;
  is_featured: boolean;
  is_new: boolean;
  is_bestseller: boolean;
  is_trending: boolean;
  is_limited: boolean;
};

type CategoryForm = {
  name: string;
  description: string;
  image: File | null;
  existingImage: string;
};

type CouponForm = {
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  min_order: string;
};

const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  description: '',
  price: '',
  compare_at_price: '',
  category_id: '',
  images: [],
  existingImages: [],
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

const EMPTY_CATEGORY_FORM: CategoryForm = {
  name: '',
  description: '',
  image: null,
  existingImage: '',
};

const EMPTY_COUPON_FORM: CouponForm = {
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
  'processing',
  'shipping',
  'delivered',
  'cancelled',
];

export default function Admin() {
  const {
    user,
    profile,
    loading: authLoading,
  } = useAuth();

  const { toast } = useToast();

  const [tab, setTab] =
    useState<Tab>('dashboard');

  const [products, setProducts] =
    useState<Product[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [orders, setOrders] =
    useState<AdminOrder[]>([]);

  const [customers, setCustomers] =
    useState<Profile[]>([]);

  const [coupons, setCoupons] =
    useState<Coupon[]>([]);

  const [reviews, setReviews] =
    useState<AdminReview[]>([]);

  const [dataLoading, setDataLoading] =
    useState(false);

  const [showProductForm, setShowProductForm] =
    useState(false);

  const [showCategoryForm, setShowCategoryForm] =
    useState(false);

  const [showCouponForm, setShowCouponForm] =
    useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);

  const [productForm, setProductForm] =
    useState<ProductForm>({
      ...EMPTY_PRODUCT_FORM,
    });

  const [categoryForm, setCategoryForm] =
    useState<CategoryForm>({
      ...EMPTY_CATEGORY_FORM,
    });

  const [couponForm, setCouponForm] =
    useState<CouponForm>({
      ...EMPTY_COUPON_FORM,
    });

  const productImageInputRef =
    useRef<HTMLInputElement>(null);

  const categoryImageInputRef =
    useRef<HTMLInputElement>(null);

  const isAdmin =
    Boolean(user) &&
    profile?.role === 'admin';

  /*
   * ============================================================
   * PRODUCT IMAGE SELECTION
   * ============================================================
   */

  const handleProductImages = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(
      e.target.files ?? [],
    );

    if (!files.length) return;

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

    setProductForm((previous) => ({
      ...previous,
      images: [
        ...previous.images,
        ...validFiles,
      ].slice(
        0,
        Math.max(
          0,
          6 -
            previous.existingImages.length,
        ),
      ),
    }));

    e.target.value = '';
  };

  /*
   * ============================================================
   * CATEGORY IMAGE
   * ============================================================
   */

  const handleCategoryImage = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

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

    setCategoryForm((previous) => ({
      ...previous,
      image: file,
    }));

    e.target.value = '';
  };

  /*
   * ============================================================
   * PRODUCTS
   * ============================================================
   */

  const refreshProducts =
    useCallback(async () => {
      try {
        const data =
          await getProducts({
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
   * CATEGORIES
   * ============================================================
   */

  const refreshCategories =
    useCallback(async () => {
      try {
        const data =
          await getCategories();

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
   * COUPONS
   * ============================================================
   */

  const refreshCoupons =
    useCallback(async () => {
      try {
        const data =
          await getCoupons();

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
   * ORDERS + PAYMENT RECONCILIATION
   * ============================================================
   *
   * payments.status = success
   * is treated as the authoritative indication
   * that Paystack successfully processed the payment.
   *
   * This fixes the situation where:
   *
   * orders.payment_status = pending
   *
   * but:
   *
   * payments.status = success
   *
   * ============================================================
   */

  const refreshOrders =
    useCallback(async () => {
      try {
        const {
          data: orderData,
          error: orderError,
        } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', {
            ascending: false,
          });

        if (orderError) {
          throw orderError;
        }

        const rawOrders =
          (orderData ?? []) as Order[];

        const orderIds =
          rawOrders
            .map(
              (order) => order.id,
            )
            .filter(Boolean);

        let payments: PaymentRecord[] =
          [];

        if (orderIds.length > 0) {
          const {
            data: paymentData,
            error: paymentError,
          } = await supabase
            .from('payments')
            .select(
              'id,order_id,user_id,reference,amount,status,channel,created_at',
            )
            .in(
              'order_id',
              orderIds,
            )
            .order('created_at', {
              ascending: false,
            });

          if (paymentError) {
            console.error(
              'Failed to load payments:',
              paymentError,
            );
          } else {
            payments =
              (paymentData ??
                []) as PaymentRecord[];
          }
        }

        /*
         * One order can potentially have
         * multiple payment attempts.
         *
         * Always prefer a successful payment.
         */

        const paymentMap =
          new Map<
            string,
            PaymentRecord
          >();

        for (const payment of payments) {
          const existing =
            paymentMap.get(
              payment.order_id,
            );

          if (
            !existing ||
            payment.status ===
              'success'
          ) {
            paymentMap.set(
              payment.order_id,
              payment,
            );
          }
        }

        const reconciledOrders =
          rawOrders.map(
            (order) => {
              const payment =
                paymentMap.get(
                  order.id,
                );

              const successfulPayment =
                payment?.status ===
                'success';

              const reconciledStatus =
                successfulPayment
                  ? 'paid'
                  : order.payment_status ||
                    payment?.status ||
                    'pending';

              return {
                ...order,

                payment_record:
                  payment ?? null,

                reconciled_payment_status:
                  reconciledStatus,

                payment_status:
                  reconciledStatus,

                payment_reference:
                  order.payment_reference ||
                  payment?.reference ||
                  order.payment_ref ||
                  null,
              };
            },
          ) as AdminOrder[];

        setOrders(
          reconciledOrders,
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
   * CUSTOMERS
   * ============================================================
   */

  const refreshCustomers =
    useCallback(async () => {
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
          throw error;
        }

        setCustomers(
          (data ??
            []) as Profile[],
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
   * REVIEWS
   * ============================================================
   */

  const refreshReviews =
    useCallback(async () => {
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
          throw reviewError;
        }

        const rawReviews =
          reviewData ?? [];

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

        const productMap =
          new Map<
            string,
            {
              id: string;
              name: string;
              slug: string;
            }
          >();

        if (productIds.length) {
          const {
            data,
            error,
          } = await supabase
            .from('products')
            .select(
              'id,name,slug',
            )
            .in(
              'id',
              productIds,
            );

          if (!error) {
            for (const product of
              data ?? []) {
              productMap.set(
                product.id,
                product,
              );
            }
          }
        }

        const profileMap =
          new Map<
            string,
            {
              id: string;
              email: string;
              full_name:
                | string
                | null;
            }
          >();

        if (userIds.length) {
          const {
            data,
            error,
          } = await supabase
            .from('profiles')
            .select(
              'id,email,full_name',
            )
            .in(
              'id',
              userIds,
            );

          if (!error) {
            for (const item of
              data ?? []) {
              profileMap.set(
                item.id,
                item,
              );
            }
          }
        }

        const formattedReviews =
          rawReviews.map(
            (review) => ({
              ...review,
              product:
                productMap.get(
                  review.product_id,
                ) ?? null,
              profile:
                profileMap.get(
                  review.user_id,
                ) ?? null,
            }),
          ) as AdminReview[];

        setReviews(
          formattedReviews,
        );
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

  const loadAdminData =
    useCallback(async () => {
      if (!user || !isAdmin) {
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
      } finally {
        setDataLoading(false);
      }
    }, [
      user,
      isAdmin,
      refreshProducts,
      refreshCategories,
      refreshOrders,
      refreshCustomers,
      refreshReviews,
      refreshCoupons,
    ]);

  useEffect(() => {
    if (!user || !isAdmin) {
      return;
    }

    void loadAdminData();
  }, [
    user,
    isAdmin,
    loadAdminData,
  ]);

  /*
   * ============================================================
   * ADMIN REALTIME
   * ============================================================
   */

  useRealtimeAdmin({
    onOrdersChange:
      refreshOrders,

    onCustomersChange:
      refreshCustomers,

    onReviewsChange: refreshReviews,
    onCouponsChange: refreshCoupons,
  });

  /*
   * ============================================================
   * PAYMENT REALTIME
   * ============================================================
   */

  useEffect(() => {
    if (!user || !isAdmin) {
      return;
    }

    const channel =
      supabase
        .channel(
          `admin-payment-sync-${user.id}`,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
          },
          () => {
            void refreshOrders();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          () => {
            void refreshOrders();
          },
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    user,
    isAdmin,
    refreshOrders,
  ]);

  /*
   * ============================================================
   * CREATE / UPDATE PRODUCT
   * ============================================================
   */

  const handleSaveProduct =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      const name =
        productForm.name.trim();

      const description =
        productForm.description.trim();

      const price =
        Number(productForm.price);

      const stock =
        Number(productForm.stock);

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
          'Enter a valid price',
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

      try {
        let productId =
          editingProduct?.id ??
          crypto.randomUUID();

        let finalImages =
          productForm.existingImages;

        if (
          productForm.images.length
        ) {
          const uploaded =
            await Promise.all(
              productForm.images.map(
                (file) =>
                  uploadProductImage(
                    file,
                    productId,
                  ),
              ),
            );

          finalImages = [
            ...finalImages,
            ...uploaded,
          ].slice(0, 6);
        }

        if (!editingProduct) {
          if (
            finalImages.length ===
            0
          ) {
            toast(
              'Please select at least one product image',
              'error',
            );
            return;
          }

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
              images: finalImages,
              sizes:
                productForm.sizes
                  .split(',')
                  .map((x) =>
                    x.trim(),
                  )
                  .filter(Boolean),
              colors:
                productForm.colors
                  .split(',')
                  .map((x) =>
                    x.trim(),
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
        } else {
          await updateProduct(
            editingProduct.id,
            {
              name,
              slug: slugify(name),
              description,
              price,
              compare_at_price:
                compareAtPrice,
              category_id:
                productForm.category_id ||
                null,
              images: finalImages,
              sizes:
                productForm.sizes
                  .split(',')
                  .map((x) =>
                    x.trim(),
                  )
                  .filter(Boolean),
              colors:
                productForm.colors
                  .split(',')
                  .map((x) =>
                    x.trim(),
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
            } as Partial<Product>,
          );

          toast(
            'Product updated successfully',
          );
        }

        setEditingProduct(null);
        setShowProductForm(false);

        setProductForm({
          ...EMPTY_PRODUCT_FORM,
        });

        await refreshProducts();
      } catch (error) {
        console.error(
          'Failed to save product:',
          error,
        );

        toast(
          'Failed to save product',
          'error',
        );
      }
    };

  /*
   * ============================================================
   * OPEN PRODUCT EDITOR
   * ============================================================
   */

  const openEditProduct = (
    product: Product,
  ) => {
    setEditingProduct(
      product,
    );

    setProductForm({
      name: product.name ?? '',
      description:
        product.description ?? '',
      price: String(
        product.price ?? '',
      ),
      compare_at_price:
        product.compare_at_price !=
        null
          ? String(
              product.compare_at_price,
            )
          : '',
      category_id:
        product.category_id ?? '',
      images: [],
      existingImages:
        product.images ?? [],
      sizes:
        Array.isArray(
          product.sizes,
        )
          ? product.sizes.join(',')
          : 'S,M,L,XL',
      colors:
        Array.isArray(
          product.colors,
        )
          ? product.colors.join(',')
          : 'Black,White',
      stock: String(
        product.stock ?? 0,
      ),
      badge:
        product.badge ?? '',
      is_featured:
        Boolean(
          product.is_featured,
        ),
      is_new:
        Boolean(product.is_new),
      is_bestseller:
        Boolean(
          product.is_bestseller,
        ),
      is_trending:
        Boolean(
          product.is_trending,
        ),
      is_limited:
        Boolean(
          product.is_limited,
        ),
    });

    setShowProductForm(
      true,
    );
  };

  /*
   * ============================================================
   * REMOVE EXISTING PRODUCT IMAGE
   * ============================================================
   */

  const removeExistingProductImage =
    async (
      imageUrl: string,
    ) => {
      try {
        await deleteStorageImage(
          imageUrl,
        );
      } catch (error) {
        console.error(
          'Failed to delete storage image:',
          error,
        );
      }

      setProductForm(
        (previous) => ({
          ...previous,
          existingImages:
            previous.existingImages.filter(
              (image) =>
                image !== imageUrl,
            ),
        }),
      );
    };

  /*
   * ============================================================
   * DELETE PRODUCT
   * ============================================================
   */

  const handleDeleteProduct =
    async (
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
        for (const image of
          product.images ?? []) {
          try {
            await deleteStorageImage(
              image,
            );
          } catch {
            // Storage cleanup failure
            // should not block DB deletion.
          }
        }

        await deleteProduct(
          product.id,
        );

        setProducts(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !==
                product.id,
            ),
        );

        toast(
          'Product deleted',
        );
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

  const handleSaveCategory =
    async (
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

      try {
        let imageUrl =
          categoryForm.existingImage ||
          null;

        const categoryId =
          editingCategory?.id ??
          crypto.randomUUID();

        if (categoryForm.image) {
          imageUrl =
            await uploadCategoryImage(
              categoryForm.image,
              categoryId,
            );

          if (
            editingCategory &&
            categoryForm.existingImage
          ) {
            try {
              await deleteStorageImage(
                categoryForm.existingImage,
              );
            } catch {
              // Ignore storage cleanup failure.
            }
          }
        }

        if (editingCategory) {
          const {
            error,
          } = await supabase
            .from('categories')
            .update({
              name,
              slug: slugify(name),
              description:
                categoryForm.description.trim(),
              image_url: imageUrl,
            })
            .eq(
              'id',
              editingCategory.id,
            );

          if (error) {
            throw error;
          }

          toast(
            'Category updated successfully',
          );
        } else {
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
        }

        setEditingCategory(null);
        setShowCategoryForm(false);

        setCategoryForm({
          ...EMPTY_CATEGORY_FORM,
        });

        await refreshCategories();
      } catch (error) {
        console.error(
          'Failed to save category:',
          error,
        );

        toast(
          'Failed to save category',
          'error',
        );
      }
    };

  /*
   * ============================================================
   * OPEN CATEGORY EDITOR
   * ============================================================
   */

  const openEditCategory = (
    category: Category,
  ) => {
    setEditingCategory(
      category,
    );

    setCategoryForm({
      name:
        category.name ?? '',
      description:
        category.description ??
        '',
      image: null,
      existingImage:
        category.image_url ?? '',
    });

    setShowCategoryForm(
      true,
    );
  };

  /*
   * ============================================================
   * DELETE CATEGORY
   * ============================================================
   */

  const handleDeleteCategory =
    async (
      category: Category,
    ) => {
      if (
        !window.confirm(
          `Delete "${category.name}"?`,
        )
      ) {
        return;
      }

      try {
        await deleteCategory(
          category.id,
        );

        if (category.image_url) {
          try {
            await deleteStorageImage(
              category.image_url,
            );
          } catch {
            // Ignore storage cleanup failure.
          }
        }

        setCategories(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !==
                category.id,
            ),
        );

        toast(
          'Category deleted',
        );
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
   * COUPONS
   * ============================================================
   */

  const handleCreateCoupon =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      const code =
        couponForm.code
          .trim()
          .toUpperCase();

      const value =
        Number(
          couponForm.value,
        );

      const minOrder =
        Number(
          couponForm.min_order ||
            0,
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
        couponForm.type ===
          'percent' &&
        value > 100
      ) {
        toast(
          'Percentage discount cannot exceed 100%',
          'error',
        );
        return;
      }

      if (
        !Number.isFinite(
          minOrder,
        ) ||
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
            couponForm.type,
          value,
          min_order:
            minOrder,
          active: true,
          expires_at: null,
        });

        toast(
          'Coupon created successfully',
        );

        setShowCouponForm(
          false,
        );

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

  const handleDeleteCoupon =
    async (
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

        setCoupons(
          (previous) =>
            previous.filter(
              (coupon) =>
                coupon.id !== id,
            ),
        );

        toast(
          'Coupon deleted',
        );
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
   * ORDER STATUS
   * ============================================================
   *
   * IMPORTANT:
   *
   * status != payment_status
   *
   * status:
   * pending / processing / shipping /
   * delivered / cancelled
   *
   * payment_status:
   * pending / paid / failed
   *
   * ============================================================
   */

  const handleUpdateOrderStatus =
    async (
      orderId: string,
      status: OrderStatus,
    ) => {
      const previous =
        orders;

      setOrders(
        (current) =>
          current.map(
            (order) =>
              order.id ===
              orderId
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

        await refreshOrders();

        toast(
          'Order status updated',
        );
      } catch (error) {
        console.error(
          'Failed to update order status:',
          error,
        );

        setOrders(previous);

        toast(
          'Failed to update order',
          'error',
        );
      }
    };

  /*
   * ============================================================
   * PRODUCT FLAGS
   * ============================================================
   */

  const handleToggleFlag =
    async (
      product: Product,
      flag: ProductFlag,
    ) => {
      const value =
        Boolean(product[flag]);

      try {
        await updateProduct(
          product.id,
          {
            [flag]: !value,
          } as Partial<Product>,
        );

        setProducts(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                product.id
                  ? {
                      ...item,
                      [flag]:
                        !value,
                    }
                  : item,
            ),
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

  const handleDeleteReview =
    async (
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

        setReviews(
          (previous) =>
            previous.filter(
              (review) =>
                review.id !== id,
            ),
        );

        toast(
          'Review deleted',
        );
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
    useMemo(
      () =>
        orders
          .filter(
            (order) =>
              order.reconciled_payment_status ===
              'paid',
          )
          .reduce(
            (
              total,
              order,
            ) =>
              total +
              Number(
                order.total ||
                  0,
              ),
            0,
          ),
      [orders],
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
        order.reconciled_payment_status ===
        'paid',
    ).length;

  const pendingPayments =
    orders.filter(
      (order) =>
        order.reconciled_payment_status !==
          'paid' &&
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
   * AUTH
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
                      setTab(
                        item.id,
                      )
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
                to="/admin/settings"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings className="w-4 h-4" />
                Store Settings
              </Link>

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

        {/* MAIN */}

        <main className="lg:col-span-4">

          <div className="flex justify-end items-center gap-3 mb-4">
            <AdminNotifications />
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

          {tab ===
            'dashboard' && (
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
                  value={
                    totalOrders
                  }
                  icon={ShoppingCart}
                  color="text-blue-400"
                />

                <StatCard
                  label="Customers"
                  value={
                    totalCustomers
                  }
                  icon={Users}
                  color="text-green-400"
                />

                <StatCard
                  label="Products"
                  value={
                    totalProducts
                  }
                  icon={Package}
                  color="text-purple-400"
                />

              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">

                <StatCard
                  label="Paid Orders"
                  value={
                    paidOrders
                  }
                  icon={CreditCard}
                  color="text-green-400"
                />

                <StatCard
                  label="Pending Payments"
                  value={
                    pendingPayments
                  }
                  icon={Clock}
                  color="text-yellow-400"
                />

              </div>

              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  Recent Orders
                </h2>

                <div className="glass rounded-2xl overflow-hidden">

                  {orders
                    .slice(0, 8)
                    .map(
                      (
                        order,
                        index,
                      ) => (
                        <div
                          key={
                            order.id
                          }
                          className={classNames(
                            'flex items-center justify-between p-4',
                            index !==
                              0 &&
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
                                order.reconciled_payment_status
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

                  {!orders.length && (
                    <p className="p-6 text-center text-ink-400 text-sm">
                      No orders yet
                    </p>
                  )}

                </div>
              </div>
            </motion.div>
          )}

          {/* PRODUCTS */}

          {tab ===
            'products' && (
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
                  onClick={() => {
                    setEditingProduct(
                      null,
                    );

                    setProductForm({
                      ...EMPTY_PRODUCT_FORM,
                    });

                    setShowProductForm(
                      true,
                    );
                  }}
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
                      key={
                        product.id
                      }
                      className={classNames(
                        'flex items-center gap-4 p-4',
                        index !==
                          0 &&
                          'border-t border-white/5',
                      )}
                    >
                      <img
                        src={
                          product
                            .images?.[0] ||
                          '/placeholder-product.png'
                        }
                        alt={
                          product.name
                        }
                        className="w-12 h-16 object-cover rounded-lg shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {
                            product.name
                          }
                        </p>

                        <p className="text-xs text-ink-400">
                          {formatNaira(
                            Number(
                              product.price ||
                                0,
                            ),
                          )}{' '}
                          · Stock:{' '}
                          {
                            product.stock
                          }
                        </p>
                      </div>

                      <div className="flex gap-1">
                        {PRODUCT_FLAGS.map(
                          (
                            flag,
                          ) => (
                            <button
                              key={
                                flag
                              }
                              type="button"
                              onClick={() =>
                                void handleToggleFlag(
                                  product,
                                  flag,
                                )
                              }
                              className={classNames(
                                'w-7 h-7 rounded text-[9px] font-bold',
                                product[
                                  flag
                                ]
                                  ? 'bg-gold-400 text-ink-950'
                                  : 'bg-ink-800 text-ink-500',
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
                          openEditProduct(
                            product,
                          )
                        }
                        className="text-ink-500 hover:text-gold-400"
                        title="Edit product"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

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

                {!products.length && (
                  <p className="p-6 text-center text-ink-400 text-sm">
                    No products
                  </p>
                )}

              </div>
            </motion.div>
          )}

          {/* CATEGORIES */}

          {tab ===
            'categories' && (
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
                  onClick={() => {
                    setEditingCategory(
                      null,
                    );

                    setCategoryForm({
                      ...EMPTY_CATEGORY_FORM,
                    });

                    setShowCategoryForm(
                      true,
                    );
                  }}
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
                      key={
                        category.id
                      }
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

                      <div className="p-4">
                        <div className="flex items-center justify-between">
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

                          <div className="flex gap-3">

                            <button
                              type="button"
                              onClick={() =>
                                openEditCategory(
                                  category,
                                )
                              }
                              className="text-ink-500 hover:text-gold-400"
                              title="Edit category"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteCategory(
                                  category,
                                )
                              }
                              className="text-ink-500 hover:text-red-400"
                              title="Delete category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </div>

                        {category.description && (
                          <p className="text-xs text-ink-500 mt-3 line-clamp-2">
                            {
                              category.description
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}

                {!categories.length && (
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
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl font-bold text-white">
                  Manage Orders
                </h1>

                <span className="text-xs text-ink-400">
                  {
                    orders.length
                  } orders
                </span>
              </div>

              <div className="space-y-4">

                {orders.map(
                  (order) => (
                    <div
                      key={
                        order.id
                      }
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
                            Payment reference:{' '}
                            <span className="text-white break-all">
                              {
                                order.payment_reference ||
                                order.payment_record
                                  ?.reference ||
                                order.payment_ref ||
                                'N/A'
                              }
                            </span>
                          </p>

                          <p className="text-xs text-ink-400 mt-1">
                            Provider:{' '}
                            <span className="text-white">
                              {
                                order
                                  .payment_record
                                  ?.channel ||
                                'Paystack'
                              }
                            </span>
                          </p>

                          <p className="text-xs text-ink-400 mt-1">
                            Transaction:{' '}
                            <span className="text-white break-all">
                              {
                                order.paystack_transaction_id ||
                                'N/A'
                              }
                            </span>
                          </p>

                          {order.payment_record
                            ?.status ===
                            'success' && (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
                              <CheckCircle className="w-4 h-4 text-green-400" />

                              <span className="text-xs text-green-400">
                                Paystack payment confirmed
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">

                          <PaymentStatus
                            status={
                              order.reconciled_payment_status
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

                      <div className="mt-4 grid sm:grid-cols-3 gap-3">

                        <InfoBox
                          label="Order status"
                          value={
                            order.status ||
                            'pending'
                          }
                        />

                        <InfoBox
                          label="Payment status"
                          value={
                            order.reconciled_payment_status ||
                            'pending'
                          }
                        />

                        <InfoBox
                          label="Customer"
                          value={
                            getOrderCustomerName(
                              order,
                            )
                          }
                        />

                      </div>

                    </div>
                  ),
                )}

                {!orders.length && (
                  <div className="glass rounded-2xl p-8 text-center text-ink-400 text-sm">
                    No orders
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* CUSTOMERS */}

          {tab ===
            'customers' && (
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
                        index !==
                          0 &&
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
                            {
                              customer.full_name ||
                              'Unknown'
                            }
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

                      <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-400">
                        {
                          customer.role
                        }
                      </span>

                    </div>
                  ),
                )}

                {!customers.length && (
                  <p className="p-6 text-center text-ink-400 text-sm">
                    No customers
                  </p>
                )}

              </div>
            </motion.div>
          )}

          {/* REVIEWS */}

          {tab ===
            'reviews' && (
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
                  {
                    reviews.length
                  } reviews
                </span>
              </div>

              <div className="space-y-3">

                {reviews.map(
                  (review) => (
                    <div
                      key={
                        review.id
                      }
                      className="glass rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              {review.profile
                                ?.full_name ||
                                review.profile
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
                            {
                              review
                                .product
                                ?.name
                            }
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
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </div>
                  ),
                )}

                {!reviews.length && (
                  <div className="glass rounded-2xl p-8 text-center text-ink-400 text-sm">
                    No reviews
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* COUPONS */}

          {tab ===
            'coupons' && (
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
                      key={
                        coupon.id
                      }
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

                    </div>
                  ),
                )}

                {!coupons.length && (
                  <p className="text-ink-400 text-sm col-span-full text-center py-8">
                    No coupons
                  </p>
                )}

              </div>
            </motion.div>
          )}

        </main>
      </div>

      {/* ========================================================
          PRODUCT MODAL
      ======================================================== */}

      {showProductForm && (
        <Modal
          title={
            editingProduct
              ? 'Edit Product'
              : 'Add Product'
          }
          onClose={() => {
            setShowProductForm(
              false,
            );
            setEditingProduct(
              null,
            );
          }}
        >
          <form
            onSubmit={
              handleSaveProduct
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
              onChange={(e) =>
                setProductForm(
                  (p) => ({
                    ...p,
                    name:
                      e.target
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
              onChange={(e) =>
                setProductForm(
                  (p) => ({
                    ...p,
                    description:
                      e.target
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
                placeholder="Price"
                value={
                  productForm.price
                }
                onChange={(e) =>
                  setProductForm(
                    (p) => ({
                      ...p,
                      price:
                        e.target
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
                onChange={(e) =>
                  setProductForm(
                    (p) => ({
                      ...p,
                      compare_at_price:
                        e.target
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
              onChange={(e) =>
                setProductForm(
                  (p) => ({
                    ...p,
                    category_id:
                      e.target
                        .value,
                  }),
                )
              }
              className="input-field"
            >
              <option value="">
                No Category
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {
                      category.name
                    }
                  </option>
                ),
              )}
            </select>

            {/* EXISTING IMAGES */}

            {editingProduct &&
              productForm
                .existingImages
                .length >
                0 && (
                <div>
                  <p className="text-sm text-white mb-2">
                    Existing Images
                  </p>

                  <div className="grid grid-cols-3 gap-3">

                    {productForm.existingImages.map(
                      (
                        image,
                        index,
                      ) => (
                        <div
                          key={
                            image
                          }
                          className="relative aspect-square rounded-xl overflow-hidden"
                        >
                          <img
                            src={
                              image
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              void removeExistingProductImage(
                                image,
                              )
                            }
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white hover:bg-red-500"
                          >
                            <X className="w-4 h-4 mx-auto" />
                          </button>

                          {index ===
                            0 && (
                            <span className="absolute bottom-2 left-2 text-[10px] bg-gold-400 text-black px-2 py-1 rounded">
                              Main
                            </span>
                          )}
                        </div>
                      ),
                    )}

                  </div>
                </div>
              )}

            <input
              ref={
                productImageInputRef
              }
              type="file"
              accept="image/*"
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
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-ink-300"
            >
              Add Product Images

              <span className="block text-xs text-ink-500 mt-1">
                Maximum 5MB each ·
                Maximum 6 total
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
                      file={
                        file
                      }
                      index={
                        index
                      }
                      onRemove={() =>
                        setProductForm(
                          (p) => ({
                            ...p,
                            images:
                              p.images.filter(
                                (
                                  _,
                                  i,
                                ) =>
                                  i !==
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

            <div className="grid grid-cols-2 gap-4">

              <input
                type="text"
                required
                placeholder="Sizes: S,M,L,XL"
                value={
                  productForm.sizes
                }
                onChange={(e) =>
                  setProductForm(
                    (p) => ({
                      ...p,
                      sizes:
                        e.target
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
                onChange={(e) =>
                  setProductForm(
                    (p) => ({
                      ...p,
                      colors:
                        e.target
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
                required
                placeholder="Stock"
                value={
                  productForm.stock
                }
                onChange={(e) =>
                  setProductForm(
                    (p) => ({
                      ...p,
                      stock:
                        e.target
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
                onChange={(e) =>
                  setProductForm(
                    (p) => ({
                      ...p,
                      badge:
                        e.target
                          .value,
                    }),
                  )
                }
                className="input-field"
              >
                <option value="">
                  No Badge
                </option>
                <option value="New">
                  New
                </option>
                <option value="Sale">
                  Sale
                </option>
                <option value="Limited">
                  Limited
                </option>
                <option value="Hot">
                  Hot
                </option>
                <option value="Bestseller">
                  Bestseller
                </option>
              </select>

            </div>

            <div className="flex flex-wrap gap-3">

              {PRODUCT_FLAGS.map(
                (flag) => (
                  <label
                    key={
                      flag
                    }
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
                        e,
                      ) =>
                        setProductForm(
                          (p) => ({
                            ...p,
                            [flag]:
                              e
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
              className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />

              {editingProduct
                ? 'Save Product'
                : 'Create Product'}
            </button>

          </form>
        </Modal>
      )}

      {/* ========================================================
          CATEGORY MODAL
      ======================================================== */}

      {showCategoryForm && (
        <Modal
          title={
            editingCategory
              ? 'Edit Category'
              : 'Add Category'
          }
          onClose={() => {
            setShowCategoryForm(
              false,
            );
            setEditingCategory(
              null,
            );
          }}
        >
          <form
            onSubmit={
              handleSaveCategory
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
              onChange={(e) =>
                setCategoryForm(
                  (p) => ({
                    ...p,
                    name:
                      e.target
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
              onChange={(e) =>
                setCategoryForm(
                  (p) => ({
                    ...p,
                    description:
                      e.target
                        .value,
                  }),
                )
              }
              rows={3}
              className="input-field resize-none"
            />

            {categoryForm.existingImage &&
              !categoryForm.image && (
                <img
                  src={
                    categoryForm.existingImage
                  }
                  alt=""
                  className="w-full h-40 object-cover rounded-xl"
                />
              )}

            <input
              ref={
                categoryImageInputRef
              }
              type="file"
              accept="image/*"
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
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-ink-300"
            >
              {editingCategory
                ? 'Replace Category Image'
                : 'Upload Category Image'}

              <span className="block text-xs text-ink-500 mt-1">
                Maximum 5MB
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
              className="btn-gold rounded-lg w-full py-3 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />

              {editingCategory
                ? 'Save Category'
                : 'Create Category'}
            </button>

          </form>
        </Modal>
      )}

      {/* ========================================================
          COUPON MODAL
      ======================================================== */}

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
              onChange={(e) =>
                setCouponForm(
                  (p) => ({
                    ...p,
                    code:
                      e.target
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
              onChange={(e) =>
                setCouponForm(
                  (p) => ({
                    ...p,
                    type:
                      e.target
                        .value as
                        | 'percent'
                        | 'fixed',
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
              onChange={(e) =>
                setCouponForm(
                  (p) => ({
                    ...p,
                    value:
                      e.target
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
              onChange={(e) =>
                setCouponForm(
                  (p) => ({
                    ...p,
                    min_order:
                      e.target
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
 * CUSTOMER NAME HELPER
 * ============================================================
 */

function getOrderCustomerName(
  order: Order,
) {
  const address =
    order.shipping_address as
      | Record<
          string,
          unknown
        >
      | null
      | undefined;

  const fullName =
    address?.full_name ??
    address?.fullName ??
    address?.name;

  if (
    typeof fullName ===
      'string' &&
    fullName.trim()
  ) {
    return fullName;
  }

  const email =
    address?.email;

  if (
    typeof email ===
      'string' &&
    email.trim()
  ) {
    return email;
  }

  return 'Customer';
}

/*
 * ============================================================
 * INFO BOX
 * ============================================================
 */

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </p>

      <p className="text-xs text-white mt-1 capitalize break-all">
        {value}
      </p>
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
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white hover:bg-red-500"
      >
        <X className="w-4 h-4 mx-auto" />
      </button>

      {index === 0 && (
        <span className="absolute bottom-2 left-2 text-[10px] bg-gold-400 text-black px-2 py-1 rounded">
          New
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

  if (
    value === 'paid' ||
    value === 'success'
  ) {
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
        className="relative glass-dark rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >

        <div className="flex items-center justify-between mb-5">

          <h2 className="font-display text-xl font-bold text-white">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

        </div>

        {children}

      </motion.div>
    </div>
  );
}