import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Removes the inner padding, for cards whose child manages its own edges. */
  flush?: boolean;
};

/**
 * The single container in the system. Everything on a page sits in one, so
 * surfaces never stack more than one level deep.
 */
export function Card({ children, className, flush = false }: CardProps) {
  return (
    <section
      className={cn(
        'border-line bg-surface rounded-lg border',
        flush ? '' : 'p-4',
        'min-w-0', // lets a card inside a grid shrink rather than overflow
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A card's own body padding, for use inside a `flush` card. */
export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}
