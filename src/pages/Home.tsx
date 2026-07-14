import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Star, Quote, Truck, Shield, RefreshCw, Headphones } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import ProductCard from '../components/ProductCard';
import ProductSkeleton from '../components/ProductSkeleton';
import { getProducts, getCategories } from '../services/api';
import { useToast } from '../context/ToastContext';
import { subscribeNewsletter } from '../services/api';
import type { Product, Category } from '../types';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

const heroSlides = [
  {
    image: 'https://images.pexels.com/photos/5886041/pexels-photo-5886041.jpeg',
    title: 'Wear Your',
    highlight: 'Identity',
    subtitle: 'The Heritage Collection has arrived. Premium heavyweight pieces built to last.',
    cta: 'Shop Collection',
    link: '/shop',
  },
  {
    image: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg',
    title: 'New Season',
    highlight: 'Drop',
    subtitle: 'Oversized silhouettes, elevated essentials, and limited-edition graphics.',
    cta: 'Explore New Arrivals',
    link: '/shop?sort=newest',
  },
  {
    image: 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
    title: 'Move With',
    highlight: 'Purpose',
    subtitle: 'Footwear and accessories engineered for the culture.',
    cta: 'Shop Sneakers',
    link: '/shop?category=sneakers',
  },
];

const reviews = [
  { name: 'Adaeze O.', text: 'The quality is unmatched. My oversized hoodie feels like luxury and fits perfectly.', rating: 5, location: 'Lagos' },
  { name: 'Tunde A.', text: 'Best streetwear brand in Nigeria right now. The attention to detail is insane.', rating: 5, location: 'Abuja' },
  { name: 'Chioma N.', text: 'Fast delivery and the packaging alone makes you feel premium. Obsessed.', rating: 5, location: 'Port Harcourt' },
  { name: 'Femi K.', text: 'The selvedge jeans are worth every naira. Built like armor, looks like art.', rating: 5, location: 'Ibadan' },
];

const instaPosts = [
  'https://images.pexels.com/photos/8217387/pexels-photo-8217387.jpeg',
  'https://images.pexels.com/photos/1656683/pexels-photo-1656683.jpeg',
  'https://images.pexels.com/photos/1082529/pexels-photo-1082529.jpeg',
  'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg',
  'https://images.pexels.com/photos/1124468/pexels-photo-1124468.jpeg',
  'https://images.pexels.com/photos/8386980/pexels-photo-8386980.jpeg',
];

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [limited, setLimited] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const { toast } = useToast();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);

  useEffect(() => {
    Promise.all([
      getProducts({ featured: true, limit: 8 }),
      getProducts({ isNew: true, limit: 8 }),
      getProducts({ bestseller: true, limit: 4 }),
      getProducts({ trending: true, limit: 4 }),
      getProducts({ limited: true, limit: 3 }),
      getCategories(),
    ])
      .then(([feat, newArr, best, trend, ltd, cats]) => {
        setFeatured(feat);
        setNewArrivals(newArr);
        setBestsellers(best);
        setTrending(trend);
        setLimited(ltd);
        setCategories(cats);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubLoading(true);
    try {
      await subscribeNewsletter(email.trim());
      toast('Welcome to the Nation!');
      setEmail('');
    } catch {
      toast('You are already subscribed!', 'info');
    } finally {
      setSubLoading(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative h-screen min-h-[600px] overflow-hidden">
        <Swiper
          modules={[Autoplay, Pagination, EffectFade]}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          effect="fade"
          loop
          className="h-full"
        >
          {heroSlides.map((slide, i) => (
            <SwiperSlide key={i}>
              <div className="relative h-full">
                <motion.img
                  src={slide.image}
                  alt={slide.title}
                  style={{ y: heroY }}
                  className="absolute inset-0 w-full h-full object-cover scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/30" />
                <div className="relative z-10 h-full flex items-center section-padding">
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="max-w-xl"
                  >
                    <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold-400 border border-gold-400/40 rounded-full mb-6">
                      Vast Nation
                    </span>
                    <h1 className="font-display text-5xl lg:text-7xl xl:text-8xl font-bold text-white leading-[1.05] mb-4">
                      {slide.title} <br />
                      <span className="text-gradient-gold">{slide.highlight}</span>
                    </h1>
                    <p className="text-ink-300 text-lg mb-8 max-w-md">{slide.subtitle}</p>
                    <Link
                      to={slide.link}
                      className="btn-gold rounded-full px-8 py-4 text-sm uppercase tracking-widest inline-flex items-center gap-2 group"
                    >
                      {slide.cta}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </motion.div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* Trust badges */}
      <section className="border-y border-white/5 py-8">
        <div className="section-padding grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Truck, title: 'Free Shipping', desc: 'On orders over ₦100,000' },
            { icon: Shield, title: 'Secure Payment', desc: 'Paystack protected checkout' },
            { icon: RefreshCw, title: 'Easy Returns', desc: '7-day return policy' },
            { icon: Headphones, title: '24/7 Support', desc: 'Dedicated customer care' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-full glass flex items-center justify-center text-gold-400 shrink-0">
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                <p className="text-xs text-ink-400">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured Categories */}
      <section className="section-padding py-16 lg:py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">Explore</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-2">Featured Categories</h2>
          </div>
          <Link to="/shop" className="hidden sm:flex items-center gap-2 text-sm text-ink-300 hover:text-gold-400 transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.slice(0, 4).map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={`/shop?category=${cat.slug}`} className="group block relative overflow-hidden rounded-2xl aspect-[4/5]">
                <img
                  src={cat.image_url ?? ''}
                  alt={cat.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="font-display text-xl lg:text-2xl font-bold text-white mb-1 group-hover:text-gold-400 transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-xs text-ink-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Shop Now <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured Collection */}
      <section className="section-padding py-16 lg:py-24 bg-ink-900/30">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">Curated</span>
          <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-2">Featured Collection</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : featured.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="section-padding py-16 lg:py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">Fresh</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-2">New Arrivals</h2>
          </div>
          <Link to="/shop?sort=newest" className="hidden sm:flex items-center gap-2 text-sm text-ink-300 hover:text-gold-400 transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : newArrivals.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* Limited Edition Banner */}
      {limited.length > 0 && (
        <section className="section-padding py-16 lg:py-24">
          <div className="relative overflow-hidden rounded-3xl">
            <img
              src={limited[0].images[0]}
              alt="Limited Edition"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/40" />
            <div className="relative z-10 p-8 lg:p-16 max-w-xl">
              <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold-400 border border-gold-400/40 rounded-full mb-6">
                Limited Edition
              </span>
              <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mb-4">
                When It's Gone, <br />It's Gone.
              </h2>
              <p className="text-ink-300 mb-6">
                Exclusive pieces in numbered runs. Once stock hits zero, these designs never return.
              </p>
              <Link
                to={`/product/${limited[0].slug}`}
                className="btn-gold rounded-full px-8 py-4 text-sm uppercase tracking-widest inline-flex items-center gap-2 group"
              >
                Shop Limited <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Best Sellers */}
      <section className="section-padding py-16 lg:py-24 bg-ink-900/30">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">Fan Favorites</span>
          <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-2">Best Sellers</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : bestsellers.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* Trending */}
      <section className="section-padding py-16 lg:py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">Hot Right Now</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-2">Trending Products</h2>
          </div>
          <Link to="/shop?sort=rating" className="hidden sm:flex items-center gap-2 text-sm text-ink-300 hover:text-gold-400 transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : trending.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="section-padding py-16 lg:py-24 bg-ink-900/30">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">Testimonials</span>
          <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-2">Customer Reviews</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reviews.map((review, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <Quote className="w-8 h-8 text-gold-400/40 mb-4" />
              <div className="flex gap-1 mb-3">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-gold-400 text-gold-400" />
                ))}
              </div>
              <p className="text-sm text-ink-200 mb-4 leading-relaxed">"{review.text}"</p>
              <div>
                <p className="text-sm font-semibold text-white">{review.name}</p>
                <p className="text-xs text-ink-400">{review.location}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Instagram Gallery */}
      <section className="section-padding py-16 lg:py-24">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">@vastnation</span>
          <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-2">Follow the Movement</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {instaPosts.map((img, i) => (
            <motion.a
              key={i}
              href="#"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group relative aspect-square overflow-hidden rounded-xl"
            >
              <img src={img} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/40 transition-colors flex items-center justify-center">
                <span className="text-gold-400 opacity-0 group-hover:opacity-100 transition-opacity text-2xl font-bold">+</span>
              </div>
            </motion.a>
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="section-padding py-16 lg:py-24 bg-ink-900/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mb-4">
            Join the <span className="text-gradient-gold">Nation</span>
          </h2>
          <p className="text-ink-300 mb-8">
            Subscribe for early access to drops, exclusive offers, and members-only content.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={subLoading}
              className="btn-gold rounded-lg px-8 py-3 text-sm uppercase tracking-wider whitespace-nowrap disabled:opacity-50"
            >
              {subLoading ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
