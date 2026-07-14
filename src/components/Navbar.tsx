import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ShoppingBag, Heart, User, Search, Menu, X, ChevronDown } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { classNames } from '../utils/helpers';

const navLinks = [
  { label: 'Home', path: '/' },
  { label: 'Shop', path: '/shop' },
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      {/* Announcement bar */}
      <div className="bg-gold-400 text-ink-950 text-center py-2 text-xs font-medium tracking-wide overflow-hidden">
        <div className="animate-marquee whitespace-nowrap inline-block">
          Free shipping on orders over ₦100,000 — Wear Your Identity — New Drop: Heritage Collection —
        </div>
      </div>

      <header
        className={classNames(
          'sticky top-0 z-50 transition-all duration-500',
          scrolled ? 'glass-dark shadow-lg' : 'bg-transparent',
        )}
      >
        <nav className="section-padding h-16 lg:h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="font-display text-xl lg:text-2xl font-bold tracking-tight text-white">
              VAST<span className="text-gold-400">NATION</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={classNames(
                  'text-sm font-medium tracking-wide transition-colors duration-300 relative group',
                  location.pathname === link.path ? 'text-gold-400' : 'text-ink-200 hover:text-white',
                )}
              >
                {link.label}
                <span className={classNames('absolute -bottom-1 left-0 h-px bg-gold-400 transition-all duration-300', location.pathname === link.path ? 'w-full' : 'w-0 group-hover:w-full')} />
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:gap-4">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="w-9 h-9 flex items-center justify-center text-ink-200 hover:text-gold-400 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            <Link
              to="/wishlist"
              className="w-9 h-9 flex items-center justify-center text-ink-200 hover:text-gold-400 transition-colors relative"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold-400 text-ink-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {wishCount}
                </span>
              )}
            </Link>

            <Link
              to="/cart"
              className="w-9 h-9 flex items-center justify-center text-ink-200 hover:text-gold-400 transition-colors relative"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold-400 text-ink-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>

            {user ? (
              <Link
                to={profile?.role === 'admin' ? '/admin' : '/dashboard'}
                className="hidden lg:flex w-9 h-9 items-center justify-center text-ink-200 hover:text-gold-400 transition-colors"
                aria-label="Account"
              >
                <User className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden lg:flex items-center gap-1 text-sm text-ink-200 hover:text-gold-400 transition-colors"
              >
                <User className="w-5 h-5" />
                <span>Account</span>
                <ChevronDown className="w-3 h-3" />
              </Link>
            )}

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden w-9 h-9 flex items-center justify-center text-ink-200"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden glass-dark border-t border-white/10"
            >
              <form onSubmit={handleSearch} className="section-padding py-4 flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for products..."
                  className="input-field"
                  autoFocus
                />
                <button type="submit" className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider">
                  Search
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden glass-dark border-t border-white/10"
            >
              <div className="section-padding py-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={classNames(
                      'py-3 text-base font-medium transition-colors',
                      location.pathname === link.path ? 'text-gold-400' : 'text-ink-200',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="h-px bg-white/10 my-2" />
                {user ? (
                  <Link to={profile?.role === 'admin' ? '/admin' : '/dashboard'} className="py-3 text-base font-medium text-ink-200">
                    My Account
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="py-3 text-base font-medium text-ink-200">Sign In</Link>
                    <Link to="/register" className="py-3 text-base font-medium text-ink-200">Register</Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
