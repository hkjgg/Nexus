'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

/**
 * Reads one filter out of the URL and writes it back.
 *
 * Writing goes through `replace` rather than `push`: flipping a date range is
 * changing a view, not navigating, and it should not fill the back button
 * with every combination the operator tried. The returned `pending` flag is
 * what the controls use to show the server is re-querying.
 */
export function useFilterParam(
  key: string,
  defaultValue: string,
): {
  value: string;
  setValue: (next: string) => void;
  pending: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      // The default never needs to be in the URL; leaving it out keeps a
      // shared link short and makes "no query string" mean "the default view".
      if (next === defaultValue) params.delete(key);
      else params.set(key, next);

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [defaultValue, key, pathname, router, searchParams],
  );

  return { value, setValue, pending };
}
