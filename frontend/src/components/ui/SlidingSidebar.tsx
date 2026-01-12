'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SidebarLink {
  href: string;
  icon: string;
  label: string;
  show?: boolean;
}

interface SlidingSidebarProps {
  links: SidebarLink[];
  title?: string;
  position?: 'left' | 'right';
  /** Show a back arrow button to navigate back */
  showBackButton?: boolean;
  /** Custom back URL (defaults to browser back) */
  backUrl?: string;
  /** Label for the back button */
  backLabel?: string;
  /** Edit Draft button configuration */
  editDraft?: {
    show: boolean;
    href: string;
    label?: string;
  };
}

export default function SlidingSidebar({ 
  links, 
  title = 'Quick Actions', 
  position = 'left',
  showBackButton = false,
  backUrl,
  backLabel = 'Back',
  editDraft
}: SlidingSidebarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
    setIsOpen(false);
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node) &&
        handleRef.current &&
        !handleRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleMouseLeave = () => {
    // Small delay to prevent accidental closes
    setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const visibleLinks = links.filter(link => link.show !== false);

  return (
    <>
      {/* Backdrop overlay when open */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Handle/Tab - positioned based on position prop */}
      <button
        ref={handleRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-20 z-50 transition-all duration-300 ease-in-out ${
          position === 'left'
            ? (isOpen ? 'left-64 sm:left-72' : 'left-0')
            : (isOpen ? 'right-64 sm:right-72' : 'right-0')
        }`}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <div className={`bg-primary-600 hover:bg-primary-700 text-white px-2 py-3 sm:px-3 sm:py-4 shadow-lg flex items-center gap-2 transition-colors ${
          position === 'left' ? 'rounded-r-lg' : 'rounded-l-lg flex-row-reverse'
        }`}>
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${
              position === 'left'
                ? (isOpen ? 'rotate-180' : '')
                : (isOpen ? '' : 'rotate-180')
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs sm:text-sm font-medium hidden sm:inline">
            {position === 'left' ? 'Menu' : 'Admin'}
          </span>
        </div>
      </button>

      {/* Sidebar panel - slides from left or right */}
      <div
        ref={sidebarRef}
        onMouseLeave={handleMouseLeave}
        className={`fixed top-16 h-[calc(100vh-4rem)] w-64 sm:w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          position === 'left'
            ? `left-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `right-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`
        }`}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {title}
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Back Button */}
        {showBackButton && (
          <div className="px-2 sm:px-4 pt-2 sm:pt-3">
            <button
              onClick={handleBack}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group border border-gray-200 dark:border-gray-600"
            >
              <svg 
                className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm sm:text-base font-medium">{backLabel}</span>
            </button>
          </div>
        )}

        {/* Edit Draft Button */}
        {editDraft?.show && (
          <div className="px-2 sm:px-4 pt-2 sm:pt-3">
            <Link
              href={editDraft.href}
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors group border border-primary-200 dark:border-primary-700"
            >
              <svg 
                className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm sm:text-base font-medium">{editDraft.label || 'Edit Draft'}</span>
            </Link>
          </div>
        )}

        {/* Divider if we have action buttons */}
        {(showBackButton || editDraft?.show) && (
          <div className="px-4 pt-3">
            <div className="border-t border-gray-200 dark:border-gray-700" />
          </div>
        )}

        {/* Links */}
        <nav className="p-2 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          {visibleLinks.map((link, index) => (
            <Link
              key={index}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            >
              <span className="text-lg sm:text-xl group-hover:scale-110 transition-transform">{link.icon}</span>
              <span className="text-sm sm:text-base font-medium">{link.label}</span>
              <svg
                className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </nav>

        {/* Footer hint */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </>
  );
}
