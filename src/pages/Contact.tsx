import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Clock, Instagram, Twitter, Facebook } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useToast } from '../context/ToastContext';

export default function Contact() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast("Message sent! We'll get back to you soon.");
      setForm({ name: '', email: '', subject: '', message: '' });
    }, 1500);
  };

  const contactInfo = [
    { icon: Mail, label: 'Email', value: 'hello@vastnation.com', href: 'mailto:hello@vastnation.com' },
    { icon: Phone, label: 'Phone', value: '+234 800 VAST NATION', href: 'tel:+2348008278628' },
    { icon: MapPin, label: 'Address', value: 'Victoria Island, Lagos, Nigeria', href: '#' },
    { icon: Clock, label: 'Hours', value: 'Mon - Sat: 9AM - 8PM', href: '#' },
  ];

  return (
    <div>
      <PageHeader
        title="Get in Touch"
        subtitle="We'd love to hear from you. Reach out with any questions, feedback, or collaboration ideas."
        bgImage="https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg"
      />

      <div className="section-padding py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Form */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <div className="glass rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl font-bold text-white mb-6">Send a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Name</label>
                    <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Your name" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Email</label>
                    <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="your@email.com" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Subject</label>
                  <input type="text" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" placeholder="What's this about?" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Message</label>
                  <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} className="input-field resize-none" placeholder="Tell us more..." />
                </div>
                <button type="submit" disabled={loading} className="btn-gold rounded-lg px-8 py-3.5 text-sm uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                  {loading ? 'Sending...' : 'Send Message'}
                  {!loading && <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Info */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <div className="space-y-4 mb-8">
              {contactInfo.map((info, i) => (
                <a key={i} href={info.href} className="glass rounded-2xl p-5 flex items-center gap-4 hover:border-gold-400/40 transition-all group">
                  <div className="w-12 h-12 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 group-hover:bg-gold-400/20 transition-all">
                    <info.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gold-400">{info.label}</p>
                    <p className="text-sm text-white mt-1">{info.value}</p>
                  </div>
                </a>
              ))}
            </div>

            {/* Map placeholder */}
            <div className="glass rounded-2xl overflow-hidden aspect-video relative">
              <iframe
                title="Vast Nation Location"
                src="https://www.openstreetmap.org/export/embed.html?bbox=3.4064%2C6.4281%2C3.4364%2C6.4481&layer=mapnik&marker=6.4381%2C3.4214"
                className="w-full h-full grayscale opacity-70"
                loading="lazy"
              />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-ink-950/60 to-transparent" />
            </div>

            {/* Social */}
            <div className="flex gap-3 mt-6">
              {[Instagram, Twitter, Facebook].map((Icon, i) => (
                <a key={i} href="#" className="w-11 h-11 rounded-full glass flex items-center justify-center text-ink-300 hover:text-gold-400 hover:border-gold-400/40 transition-all" aria-label="Social">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
