'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  /** Position in its row or list; staggers the entrance by 24ms per step. */
  index?: number;
  className?: string;
};

/**
 * The one entrance animation in the product.
 *
 * Its job is to say "these numbers just arrived", which is worth saying on a
 * dashboard whose panels resolve at different speeds. It is deliberately
 * short and small: a long or large move on eight tiles at once would read as
 * decoration. Anyone who asks for reduced motion gets the end state
 * immediately.
 */
export function Reveal({ children, index = 0, className }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index, 8) * 0.024,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
