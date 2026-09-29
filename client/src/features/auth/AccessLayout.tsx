import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Logo } from '../../shared/components/ui';
import '../home/home.css';
import './access.css';

/** Mismo estilo del inicio: logo grande a la izquierda, contenido a la derecha. */
export function AccessLayout({ title, text, children }: { title: ReactNode; text: ReactNode; children: ReactNode }) {
  return (
    <div className="home access-home">
      <div className="home-glow" />
      <main className="home-main">
        <motion.section className="home-hero" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <Logo kind="sabor" tone="cream" className="home-logo" />
          <h1 className="access-title display">{title}</h1>
          <p className="home-tag">{text}</p>
        </motion.section>
        {children}
      </main>
      <div className="band home-band" />
    </div>
  );
}
