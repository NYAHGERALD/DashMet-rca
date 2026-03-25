'use client';

interface LoadingStateProps {
  message?: string;
  title?: string;
  /** SVG path for the center icon. Defaults to lock icon. */
  icon?: 'lock' | 'bolt' | 'chart' | 'upload' | 'search' | 'data';
  /** Whether to render full-screen (min-h-screen) or inline */
  fullScreen?: boolean;
  /** Accent color: purple (default), blue, amber, emerald */
  color?: 'purple' | 'blue' | 'amber' | 'emerald';
}

const iconPaths: Record<string, string> = {
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  chart: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  upload: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  data: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
};

const colorMap = {
  purple: {
    ring: 'border-purple-200 dark:border-purple-900/50',
    spin: 'border-t-purple-600 border-r-purple-600',
    icon: 'text-purple-600',
    dot1: 'bg-purple-600',
    dot2: 'bg-purple-500',
    dot3: 'bg-purple-400',
  },
  blue: {
    ring: 'border-blue-200 dark:border-blue-900/50',
    spin: 'border-t-blue-600 border-r-blue-600',
    icon: 'text-blue-600',
    dot1: 'bg-blue-600',
    dot2: 'bg-blue-500',
    dot3: 'bg-blue-400',
  },
  amber: {
    ring: 'border-amber-200 dark:border-amber-900/50',
    spin: 'border-t-amber-600 border-r-amber-600',
    icon: 'text-amber-600',
    dot1: 'bg-amber-600',
    dot2: 'bg-amber-500',
    dot3: 'bg-amber-400',
  },
  emerald: {
    ring: 'border-emerald-200 dark:border-emerald-900/50',
    spin: 'border-t-emerald-600 border-r-emerald-600',
    icon: 'text-emerald-600',
    dot1: 'bg-emerald-600',
    dot2: 'bg-emerald-500',
    dot3: 'bg-emerald-400',
  },
};

export default function LoadingState({
  message = 'Loading...',
  title = 'Hang tight!',
  icon = 'lock',
  fullScreen = true,
  color = 'purple',
}: LoadingStateProps) {
  const c = colorMap[color];
  const path = iconPaths[icon] || iconPaths.lock;

  const content = (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-8">
        <div className={`absolute inset-0 w-20 h-20 rounded-full border-4 ${c.ring}`} />
        <div className={`w-20 h-20 rounded-full border-4 border-transparent ${c.spin} animate-spin`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className={`w-8 h-8 ${c.icon} animate-pulse`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
          </svg>
        </div>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">{message}</p>
      <div className="flex items-center gap-1.5 mt-6">
        <div className={`w-2 h-2 ${c.dot1} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
        <div className={`w-2 h-2 ${c.dot2} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
        <div className={`w-2 h-2 ${c.dot3} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}
