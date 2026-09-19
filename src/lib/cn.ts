/**
 * Class name helper.
 *
 * `clsx` handles conditionals, `twMerge` resolves Tailwind conflicts so a
 * component's own classes can always be overridden from a `className` prop.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
