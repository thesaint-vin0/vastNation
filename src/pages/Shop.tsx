import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, Search, ChevronDown } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import ProductSkeleton from '../components/ProductSkeleton';
import PageHeader from '../components/PageHeader';
import { getProducts, getCategories } from '../services/api';
import type { Product, Category } from '../types';
import { formatNaira, classNames } from '../utils/helpers';

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

const PER_PAGE = 12;

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const categorySlug = searchParams.get('category') ?? '';
  const searchQuery = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    const categoryId = categories.find((c) => c.slug === categorySlug)?.id;
    getProducts({
      category: categoryId,
      search: searchQuery || undefined,
      sort,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
    })
      .then((data) => {
        let filtered = data;
        if (selectedSizes.length > 0) {
          filtered = filtered.filter((p) => p.sizes.some((s) => selectedSizes.includes(s)));
        }
        setProducts(filtered);
        setPage(1);
      })
      .finally(() => setLoading(false));
  }, [categorySlug, searchQuery, sort, priceRange, selectedSizes, categories]);

  const allSizes = useMemo(() => {
    const sizes = new Set<string>();
    products.forEach((p) => p.sizes.forEach((s) => sizes.add(s)));
    return Array.from(sizes).sort();
  }, [products]);

  const totalPages = Math.ceil(products.length / PER_PAGE);
  const currentProducts = products.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  };

  const clearFilters = () => {
    setSearchParams({});
    setPriceRange([0, 100000]);
    setSelectedSizes([]);
    setLocalSearch('');
  };

  const FilterPanel = () => (
    <div className="space-y-8">
      {/* Search */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Search</h4>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && updateParam('search', localSearch)}
            placeholder="Search products..."
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Categories</h4>
        <div className="space-y-2">
          <button
            onClick={() => updateParam('category', '')}
            className={classNames(
              'block w-full text-left text-sm transition-colors',
              !categorySlug ? 'text-gold-400 font-medium' : 'text-ink-300 hover:text-white',
            )}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateParam('category', cat.slug)}
              className={classNames(
                'block w-full text-left text-sm transition-colors',
                categorySlug === cat.slug ? 'text-gold-400 font-medium' : 'text-ink-300 hover:text-white',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Price Range</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-ink-300">
            <span>{formatNaira(priceRange[0])}</span>
            <span>{formatNaira(priceRange[1])}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100000}
            step={5000}
            value={priceRange[1]}
            onChange={(e) => setPriceRange([0, Number(e.target.value)])}
            className="w-full accent-gold-400"
          />
        </div>
      </div>

      {/* Sizes */}
      {allSizes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Sizes</h4>
          <div className="flex flex-wrap gap-2">
            {allSizes.map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={classNames(
                  'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                  selectedSizes.includes(size)
                    ? 'border-gold-400 bg-gold-400/10 text-gold-400'
                    : 'border-white/10 text-ink-300 hover:border-white/30',
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={clearFilters} className="btn-outline rounded-lg px-4 py-2.5 text-xs uppercase tracking-wider w-full">
        Clear All Filters
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Shop"
        subtitle="Premium streetwear engineered for the culture."
        bgImage="https://images.pexels.com/photos/2294342/pexels-photo-2294342.jpeg"
      />

      <div className="section-padding py-12 lg:py-16">
        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-28">
              <FilterPanel />
            </div>
          </aside>

          {/* Products */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(true)}
                  className="lg:hidden flex items-center gap-2 text-sm text-ink-200 hover:text-gold-400"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </button>
                <p className="text-sm text-ink-400">
                  {loading ? 'Loading...' : `${products.length} products`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-400 hidden sm:inline">Sort by:</span>
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => updateParam('sort', e.target.value)}
                    className="appearance-none bg-ink-900/60 border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-gold-400/60 cursor-pointer"
                  >
                    {sortOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-ink-900">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {Array.from({ length: 6 }).map((_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : currentProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-ink-400 text-lg mb-2">No products found</p>
                <p className="text-ink-500 text-sm mb-6">Try adjusting your filters</p>
                <button onClick={clearFilters} className="btn-outline rounded-lg px-6 py-2.5 text-sm">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {currentProducts.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm rounded-lg border border-white/10 text-ink-300 hover:border-gold-400 hover:text-gold-400 disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-ink-300 transition-all"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={classNames(
                      'w-10 h-10 text-sm rounded-lg transition-all',
                      page === i + 1
                        ? 'bg-gold-400 text-ink-950 font-semibold'
                        : 'border border-white/10 text-ink-300 hover:border-gold-400 hover:text-gold-400',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm rounded-lg border border-white/10 text-ink-300 hover:border-gold-400 hover:text-gold-400 disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-ink-300 transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 bg-ink-950/80 z-50 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-ink-900 z-50 lg:hidden overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl font-bold text-white">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="text-ink-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <FilterPanel />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
