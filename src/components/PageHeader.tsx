import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  bgImage?: string;
  align?: 'left' | 'center';
  children?: ReactNode;
};

export default function PageHeader({ title, subtitle, bgImage, align = 'center', children }: Props) {
  return (
    <section className="relative h-[40vh] min-h-[280px] flex items-center justify-center overflow-hidden">
      {bgImage && (
        <div className="absolute inset-0">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/70 to-ink-950" />
        </div>
      )}
      {!bgImage && <div className="absolute inset-0 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950" />}

      <div className={`relative z-10 section-padding w-full ${align === 'center' ? 'text-center' : 'text-left'}`}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={align === 'center' ? 'max-w-2xl mx-auto' : 'max-w-2xl'}
        >
          <h1 className="font-display text-4xl lg:text-6xl font-bold text-white mb-4">{title}</h1>
          {subtitle && <p className="text-ink-300 text-base lg:text-lg">{subtitle}</p>}
          {children}
        </motion.div>
      </div>
    </section>
  );
}
