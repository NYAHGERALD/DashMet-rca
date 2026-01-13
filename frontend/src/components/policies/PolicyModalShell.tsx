import type { ReactNode } from 'react';
import { ClosePolicyButton } from './ClosePolicyButton';
import { formatDate } from '@/lib/dateUtils';

function formatEffectiveDate(publishedAt: Date | string | null | undefined) {
  if (!publishedAt) return null;
  const date = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(date.toISOString());
}

export function PolicyModalShell({
  title,
  publishedAt,
  children,
}: {
  title: string;
  publishedAt?: Date | string | null;
  children: ReactNode;
}) {
  const effective = formatEffectiveDate(publishedAt);

  return (
    <div className="fixed inset-0 z-50">
      {/* Background Image with Overlay and Blur */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-md" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="w-[calc(100vw-2rem)] max-w-5xl max-h-[calc(100vh-4rem)] rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
            <div>
              <h1 className="text-3xl font-bold text-white">{title}</h1>
              {effective ? (
                <p className="mt-2 text-sm text-gray-300">Effective: {effective}</p>
              ) : (
                <p className="mt-2 text-sm text-gray-400">Not published yet.</p>
              )}
            </div>

            <ClosePolicyButton />
          </div>

          <div className="p-6 overflow-auto max-h-[calc(100vh-10rem)]">
            <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-gray-200 prose-strong:text-white prose-li:text-gray-200">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
