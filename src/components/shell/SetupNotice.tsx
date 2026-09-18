/**
 * What the whole application shows when there is nothing behind it yet.
 *
 * A dashboard with no database should explain how to give it one, not render
 * eight empty tiles that look like a zero-revenue business.
 */

import { Database } from 'lucide-react';

export type SetupNoticeProps = {
  title: string;
  detail?: string;
  steps: readonly string[];
};

export function SetupNotice({ title, detail, steps }: SetupNoticeProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="bg-surface rounded-nx border-line-subtle w-full max-w-md border p-6">
        <span className="bg-raised text-muted mb-4 grid size-9 place-items-center rounded-full">
          <Database className="size-4" aria-hidden />
        </span>

        <h1 className="text-content text-base font-semibold">{title}</h1>
        {detail ? (
          <p className="text-muted mt-2 text-sm leading-relaxed break-words">{detail}</p>
        ) : null}

        <ol className="text-secondary mt-4 space-y-2 text-sm">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="nx-numeric text-faint shrink-0">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
