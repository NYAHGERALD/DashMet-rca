'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

interface SidebarLink {
  href?: string;
  icon: string | React.ReactNode;
  label: string;
  show?: boolean;
  onClick?: () => void;
}

interface SlidingSidebarProps {
  links: SidebarLink[];
  title?: string;
  position?: 'left' | 'right';
  /** Edit Draft button configuration */
  editDraft?: {
    show: boolean;
    href: string;
    label?: string;
  };
  /** Hide the edge handle/trigger button (use when controlling externally) */
  hideHandle?: boolean;
  /** External control: open state */
  isOpen?: boolean;
  /** External control: callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

// Portal-based tooltip — renders at document.body so it's never clipped by overflow
function AnimatedTooltip({ label, position, visible, anchorRef }: { label: string; position: 'left' | 'right'; visible: boolean; anchorRef: React.RefObject<HTMLDivElement | null> }) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (visible && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const top = rect.top + rect.height / 2;
      const left = position === 'left' ? rect.right + 12 : rect.left - 12;
      setCoords({ top, left });
    }
  }, [visible, anchorRef, position]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: coords.top,
        left: coords.left,
        transform: `translateY(-50%) ${position === 'right' ? 'translateX(-100%)' : ''}`,
        opacity: visible ? 1 : 0,
        ...(visible
          ? { transition: 'opacity 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }
          : { transition: 'opacity 0.15s ease-out, transform 0.15s ease-out' }
        ),
      }}
    >
      <div 
        className="relative whitespace-nowrap px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(14,165,233,0.95) 0%, rgba(2,132,199,0.95) 100%)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(14,165,233,0.3), 0 2px 8px rgba(0,0,0,0.1)',
          transform: visible ? 'scale(1)' : 'scale(0.92)',
          transformOrigin: position === 'left' ? 'left center' : 'right center',
          transition: visible
            ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 0.15s ease-out',
        }}
      >
        {label}
        {/* Arrow */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 ${
            position === 'left' ? '-left-1' : '-right-1'
          }`}
          style={{
            background: position === 'left' 
              ? 'rgba(14,165,233,0.95)' 
              : 'rgba(2,132,199,0.95)',
          }}
        />
      </div>
    </div>,
    document.body
  );
}

// Expand button with portal tooltip
function ExpandButton({ setIsOpen, title, position }: { setIsOpen: (v: boolean) => void; title: string; position: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-2.5 border-b border-white/20 dark:border-gray-700/40"
      style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0.02) 100%)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => setIsOpen(true)}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-sky-200/70 dark:hover:bg-primary-900/40 hover:scale-110 hover:shadow-md group"
        aria-label="Expand panel"
      >
        <svg className={`w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors duration-200 ${position === 'left' ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <AnimatedTooltip label={`Expand ${title}`} position={position} visible={hovered} anchorRef={ref} />
    </div>
  );
}

// Individual collapsed icon item with its own ref for portal tooltip
function CollapsedIconItem({ link, index, position, hoveredIndex, setHoveredIndex }: {
  link: SidebarLink;
  index: number;
  position: 'left' | 'right';
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isEmoji = typeof link.icon === 'string';
  const isHovered = hoveredIndex === index;

  const iconEl = (
    <div
      ref={ref}
      className="relative flex items-center justify-center"
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isEmoji ? 'text-lg' : 'text-gray-600 dark:text-gray-400'
        } ${isHovered 
          ? 'bg-primary-100 dark:bg-primary-900/40 scale-110 shadow-lg shadow-primary-200/40 text-primary-600 dark:text-primary-400' 
          : 'bg-white dark:bg-gray-700/40 shadow-sm hover:bg-sky-200/60 dark:hover:bg-primary-900/20'
        }`}
      >
        {link.icon}
      </div>
      <AnimatedTooltip label={link.label} position={position} visible={isHovered} anchorRef={ref} />
    </div>
  );

  if (link.onClick) {
    return (
      <button
        onClick={() => { link.onClick!(); }}
        className="w-full flex items-center justify-center"
      >
        {iconEl}
      </button>
    );
  }

  return (
    <Link
      href={link.href || '#'}
      className="flex items-center justify-center"
    >
      {iconEl}
    </Link>
  );
}

export default function SlidingSidebar({ 
  links, 
  title = 'Quick Actions', 
  position = 'left',
  editDraft,
  hideHandle = false,
  isOpen: externalIsOpen,
  onOpenChange,
}: SlidingSidebarProps) {
  // Default to collapsed (icon-only panel) unless externally controlled
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  const setIsOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    }
    if (!isControlled) {
      setInternalIsOpen(value);
    }
  };
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const collapsedNavRef = useRef<HTMLElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUpCollapsed, setCanScrollUpCollapsed] = useState(false);
  const [canScrollDownCollapsed, setCanScrollDownCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Check scroll state for expanded nav
  const checkScroll = useCallback(() => {
    if (navRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = navRef.current;
      setCanScrollUp(scrollTop > 5);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 5);
    }
  }, []);

  // Check scroll state for collapsed nav
  const checkScrollCollapsed = useCallback(() => {
    if (collapsedNavRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = collapsedNavRef.current;
      setCanScrollUpCollapsed(scrollTop > 5);
      setCanScrollDownCollapsed(scrollTop + clientHeight < scrollHeight - 5);
    }
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    checkScroll();
    nav.addEventListener('scroll', checkScroll);
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(nav);
    return () => {
      nav.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll, isOpen]);

  useEffect(() => {
    const nav = collapsedNavRef.current;
    if (!nav || isOpen) return;
    checkScrollCollapsed();
    nav.addEventListener('scroll', checkScrollCollapsed);
    const resizeObserver = new ResizeObserver(checkScrollCollapsed);
    resizeObserver.observe(nav);
    return () => {
      nav.removeEventListener('scroll', checkScrollCollapsed);
      resizeObserver.disconnect();
    };
  }, [checkScrollCollapsed, isOpen]);

  const visibleLinks = links.filter(link => link.show !== false);

  // Collapsed panel width (icon strip)
  const collapsedWidth = 52;
  const panelWidth = isOpen ? 240 : collapsedWidth;

  return (
    <div
      className={`relative shrink-0 self-stretch transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${position === 'right' ? 'order-last' : 'order-first'}`}
      style={{ width: panelWidth, minWidth: panelWidth }}
    >
      {/* ===== EXPANDED PANEL ===== */}
      <div
        ref={sidebarRef}
        className={`relative h-full flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
          isOpen ? 'opacity-100' : 'w-0 opacity-0 pointer-events-none absolute'
        }`}
        style={{
          width: isOpen ? 240 : 0,
          background: 'rgba(186, 230, 253, 0.55)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 4px 24px rgba(14, 165, 233, 0.1), 0 0 0 1px rgba(125,211,252,0.3) inset',
          borderRight: position === 'left' ? '1px solid rgba(125,211,252,0.4)' : 'none',
          borderLeft: position === 'right' ? '1px solid rgba(125,211,252,0.4)' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Collapse arrow */}
        <button
          onClick={() => setIsOpen(false)}
          className={`absolute top-3 z-20 transition-all duration-200 ${
            position === 'left' ? '-right-4' : '-left-4'
          } ${hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
          aria-label="Collapse panel"
        >
          <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-md flex items-center justify-center hover:bg-primary-50 hover:border-primary-300 hover:shadow-lg transition-all duration-200">
            <svg className={`w-4 h-4 text-gray-500 hover:text-primary-600 transition-colors ${position === 'right' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>

        {/* Header */}
        <div className="px-3 py-2.5 border-b border-white/20 dark:border-gray-700/40" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0.02) 100%)' }}>
          <h2 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2 tracking-wide uppercase cursor-default group/title transition-colors duration-200 hover:text-primary-600 dark:hover:text-primary-400">
            <div className="w-5 h-5 rounded-md bg-primary-500/15 dark:bg-primary-400/20 flex items-center justify-center transition-all duration-300 group-hover/title:bg-primary-500/25 group-hover/title:scale-110 group-hover/title:rotate-6">
              <svg className="w-3 h-3 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            {title}
          </h2>
        </div>

        {/* Edit Draft Button */}
        {editDraft?.show && (
          <div className="px-2 pt-2">
            <Link
              href={editDraft.href}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors group border border-primary-200 dark:border-primary-700 text-sm"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="font-medium">{editDraft.label || 'Edit Draft'}</span>
            </Link>
          </div>
        )}

        {editDraft?.show && (
          <div className="px-3 pt-2">
            <div className="border-t border-gray-200/50 dark:border-gray-700/50" />
          </div>
        )}

        {canScrollUp && (
          <div className="absolute left-0 right-0 top-[40px] h-6 bg-gradient-to-b from-white/70 dark:from-gray-800/70 to-transparent pointer-events-none z-10 flex items-start justify-center pt-0.5">
            <svg className="w-3 h-3 text-gray-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </div>
        )}

        {/* Links — expanded */}
        <nav ref={navRef} className="p-2 space-y-0.5 overflow-y-auto scroll-smooth flex-1 min-h-0 scrollbar-hide">
          {visibleLinks.map((link, index) => {
            const isEmoji = typeof link.icon === 'string';
            const content = (
              <>
                <span className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
                  isEmoji ? 'text-base' : 'text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                } bg-white/60 dark:bg-gray-700/50 group-hover:bg-sky-200/70 dark:group-hover:bg-primary-800/40 group-hover:scale-110 group-hover:shadow-md group-hover:shadow-sky-300/50`}>
                  {link.icon}
                </span>
                <span className="text-[12px] sm:text-[13px] font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary-700 dark:group-hover:text-primary-300 truncate">{link.label}</span>
                <svg
                  className="w-3 h-3 ml-auto shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-primary-400 dark:text-primary-500"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            );

            if (link.onClick) {
              return (
                <button
                  key={index}
                  onClick={() => { link.onClick!(); }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-sky-200/60 dark:hover:bg-primary-900/30 transition-all duration-200 group"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={index}
                href={link.href || '#'}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-sky-200/60 dark:hover:bg-primary-900/30 transition-all duration-200 group"
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {canScrollDown && (
          <div className="absolute left-0 right-0 bottom-0 h-6 bg-gradient-to-t from-white/70 dark:from-gray-800/70 to-transparent pointer-events-none z-10 flex items-end justify-center pb-0.5">
            <svg className="w-3 h-3 text-gray-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>

      {/* ===== COLLAPSED FLOATING ICON PANEL ===== */}
      {!isOpen && (
        <div
          className="absolute inset-0 flex flex-col"
          style={{
            width: collapsedWidth,
            background: 'linear-gradient(180deg, rgba(186, 230, 253, 0.9) 0%, rgba(164, 220, 251, 0.88) 100%)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: position === 'left'
              ? '4px 0 20px rgba(14, 165, 233, 0.12), 1px 0 0 rgba(125,211,252,0.5)'
              : '-4px 0 20px rgba(14, 165, 233, 0.12), -1px 0 0 rgba(125,211,252,0.5)',
          }}
        >
          {/* Expand button at top */}
          <ExpandButton setIsOpen={setIsOpen} title={title} position={position} />

          {/* Scroll up indicator */}
          {canScrollUpCollapsed && (
            <div className="absolute left-0 right-0 top-[48px] h-5 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-10 flex items-start justify-center pt-0.5">
              <svg className="w-2.5 h-2.5 text-gray-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          )}

          {/* Icon-only nav */}
          <nav ref={collapsedNavRef} className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5 space-y-0.5 scrollbar-hide">
            {visibleLinks.map((link, index) => (
              <CollapsedIconItem
                key={index}
                link={link}
                index={index}
                position={position}
                hoveredIndex={hoveredIndex}
                setHoveredIndex={setHoveredIndex}
              />
            ))}
          </nav>

          {/* Scroll down indicator */}
          {canScrollDownCollapsed && (
            <div className="absolute left-0 right-0 bottom-0 h-5 bg-gradient-to-t from-white/80 to-transparent pointer-events-none z-10 flex items-end justify-center pb-0.5">
              <svg className="w-2.5 h-2.5 text-gray-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
