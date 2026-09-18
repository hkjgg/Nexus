'use client';

/**
 * Settles a panel into place when it arrives.
 *
 * The only motion in the product's chrome, and it runs once. When the visitor
 * asks for reduced motion the element is rendered at its final state with no
 * animation at all, rather than the same animation made faster.
 */

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { TRANSITION } from './motion';

export type RevealProps = {
  children: ReactNode;
  /** Seconds to wait, for staggering a column of panels. */
  delay?: number;
  className?: string;
};

export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION, delay }}
    >
      {children}
    </motion.div>
  );
}
