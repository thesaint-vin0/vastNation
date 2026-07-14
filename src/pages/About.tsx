import { motion } from 'framer-motion';
import { Target, Eye, Heart, Award, Leaf, Users, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function About() {
  const values = [
    { icon: Award, title: 'Quality First', desc: 'Every piece is crafted with premium materials and meticulous attention to detail.' },
    { icon: Heart, title: 'Authenticity', desc: 'We celebrate individuality. Wear what represents you, not what trends dictate.' },
    { icon: Leaf, title: 'Sustainability', desc: 'Ethically sourced materials and responsible production practices.' },
    { icon: Users, title: 'Community', desc: 'We build for the culture — a nation of confident, ambitious individuals.' },
    { icon: Sparkles, title: 'Innovation', desc: 'Constantly pushing boundaries in design, fabric, and fit.' },
    { icon: Target, title: 'Ambition', desc: 'We design for those who refuse to settle. For the go-getters and the culture-makers.' },
  ];

  return (
    <div>
      <PageHeader
        title="Our Story"
        subtitle="Born in Lagos. Built for the world. Vast Nation is more than clothing — it's a movement."
        bgImage="https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg"
      />

      {/* Brand Story */}
      <section className="section-padding py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">The Beginning</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-3 mb-6">
              From a Vision <br />to a <span className="text-gradient-gold">Nation</span>
            </h2>
            <div className="space-y-4 text-ink-300 leading-relaxed">
              <p>
                Vast Nation was born from a simple belief: that what you wear should tell your story. Founded in
                Lagos, Nigeria, we set out to create premium streetwear that speaks to the confident, the
                ambitious, and the unapologetically individual.
              </p>
              <p>
                We saw a gap in the market — African streetwear that could stand toe-to-toe with global luxury
                brands. Not fast fashion. Not disposable trends. But pieces engineered to last, designed to
                resonate, and crafted to empower.
              </p>
              <p>
                Today, Vast Nation is worn by culture-makers across the continent and beyond. Every drop is a
                statement. Every piece is a badge of identity.
              </p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden">
              <img src="https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg" alt="Vast Nation" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 glass-dark rounded-2xl p-6 max-w-xs hidden sm:block">
              <p className="font-display text-4xl font-bold text-gold-400">10K+</p>
              <p className="text-sm text-ink-300 mt-1">Customers across 15+ countries</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="section-padding py-16 lg:py-24 bg-ink-900/30">
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass rounded-3xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 mb-6">
              <Target className="w-7 h-7" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-4">Our Mission</h3>
            <p className="text-ink-300 leading-relaxed">
              To create premium streetwear that empowers individuals to wear their identity with confidence.
              We exist to prove that African design can lead the global conversation in fashion — not follow it.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="glass rounded-3xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 mb-6">
              <Eye className="w-7 h-7" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-4">Our Vision</h3>
            <p className="text-ink-300 leading-relaxed">
              To become Africa's most iconic fashion brand — a global symbol of premium streetwear that
              represents culture, ambition, and the power of individuality. A nation without borders.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding py-16 lg:py-24">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">What We Stand For</span>
          <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mt-3">Our Values</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((value, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 hover:border-gold-400/30 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 mb-4 group-hover:scale-110 transition-transform">
                <value.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-white mb-2">{value.title}</h3>
              <p className="text-sm text-ink-400 leading-relaxed">{value.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding py-16 lg:py-24 bg-ink-900/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl lg:text-5xl font-bold text-white mb-4">
            Join the <span className="text-gradient-gold">Movement</span>
          </h2>
          <p className="text-ink-300 mb-8">
            Wear Your Identity. Discover premium streetwear built for the culture.
          </p>
          <Link to="/shop" className="btn-gold rounded-full px-8 py-4 text-sm uppercase tracking-widest inline-flex items-center gap-2 group">
            Shop the Collection <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
