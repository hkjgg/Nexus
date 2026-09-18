/**
 * Shared motion for the NEXUS UI.
 *
 * Motion here is purposeful and small: content settles into place once when it
 * arrives, and nothing loops, bounces or draws attention to itself. Anything
 * larger belongs in a specific component, not in this file.
 *
 * `prefers-reduced-motion` is honoured twice over - globals.css neutralises CSS
 * transitions, and `useReducedMotion` below lets a component drop the Framer
 * animation entirely rather than merely speeding it up.
 */

import type { Transition, Variants } from 'framer-motion';

/** The single easing curve the interface uses. */
export const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

export const TRANSITION: Transition = { duration: 0.24, ease: EASE };

/** A panel arriving: a short fade with a few pixels of upward travel. */
export const enter: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: TRANSITION },
};

/** A list whose children arrive one after another, very slightly staggered. */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035 } },
};

/** The motionless counterpart, used when the visitor asks for reduced motion. */
export const still: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};
