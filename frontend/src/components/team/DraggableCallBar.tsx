'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface DraggableCallBarProps {
  onMaximize: () => void;
  onEndCall: () => void;
  isScreenSharing?: boolean;
}

export default function DraggableCallBar({ onMaximize, onEndCall, isScreenSharing }: DraggableCallBarProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasDraggedRef = useRef(false);

  // Initialize position to center bottom on mount
  useEffect(() => {
    if (barRef.current) {
      const barWidth = barRef.current.offsetWidth;
      const initialX = (window.innerWidth - barWidth) / 2;
      const initialY = window.innerHeight - 80; // 80px from bottom
      setPosition({ x: initialX, y: initialY });
      positionRef.current = { x: initialX, y: initialY };
    }
  }, []);

  // Constrain position within viewport
  const constrainPosition = useCallback((x: number, y: number) => {
    if (!barRef.current) return { x, y };
    
    const barRect = barRef.current.getBoundingClientRect();
    const barWidth = barRect.width;
    const barHeight = barRect.height;
    const padding = 8;

    const constrainedX = Math.max(padding, Math.min(window.innerWidth - barWidth - padding, x));
    const constrainedY = Math.max(padding, Math.min(window.innerHeight - barHeight - padding, y));

    return { x: constrainedX, y: constrainedY };
  }, []);

  // Mouse events for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX - positionRef.current.x, y: e.clientY - positionRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    hasDraggedRef.current = true;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    const constrained = constrainPosition(newX, newY);
    
    setPosition(constrained);
    positionRef.current = constrained;
  }, [isDragging, constrainPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events for mobile (long press to drag)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start drag if touching a button
    if ((e.target as HTMLElement).closest('button')) return;

    const touch = e.touches[0];
    dragStartRef.current = { x: touch.clientX - positionRef.current.x, y: touch.clientY - positionRef.current.y };
    hasDraggedRef.current = false;

    // Start long press timer (300ms)
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      setIsDragging(true);
      // Vibrate on supported devices
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 300);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Clear long press timer if user starts moving before 300ms
    if (longPressTimerRef.current && !isDragging) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isDragging) return;
    
    e.preventDefault();
    hasDraggedRef.current = true;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStartRef.current.x;
    const newY = touch.clientY - dragStartRef.current.y;
    const constrained = constrainPosition(newX, newY);
    
    setPosition(constrained);
    positionRef.current = constrained;
  }, [isDragging, constrainPosition]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsDragging(false);
    setIsLongPress(false);
  }, []);

  // Add/remove global mouse listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const constrained = constrainPosition(positionRef.current.x, positionRef.current.y);
      setPosition(constrained);
      positionRef.current = constrained;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainPosition]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={barRef}
      className={`fixed z-[60] select-none touch-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={`bg-gradient-to-r from-gray-800 to-gray-900 text-white px-2 sm:px-4 py-2 sm:py-3 rounded-xl shadow-2xl border flex items-center space-x-2 sm:space-x-4 min-w-[200px] sm:min-w-[320px] ${
          isDragging 
            ? 'border-blue-500 shadow-blue-500/20 scale-105' 
            : 'border-gray-700'
        } transition-all duration-200`}
      >
        {/* Drag handle indicator - hidden on very small screens */}
        <div className="hidden xs:flex flex-col gap-0.5 mr-1 cursor-grab active:cursor-grabbing">
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          </div>
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          </div>
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          </div>
        </div>

        {/* Call indicator */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-pulse flex-shrink-0 ${isScreenSharing ? 'bg-blue-500' : 'bg-green-500'}`}></div>
          <span className="font-medium text-xs sm:text-sm whitespace-nowrap">
            {isScreenSharing ? (
              <>
                <span className="hidden sm:inline">Screen Sharing</span>
                <span className="sm:hidden">Sharing</span>
              </>
            ) : (
              <>
                <span className="hidden xs:inline">Team Call </span>Active
              </>
            )}
          </span>
        </div>
        
        {/* Separator */}
        <div className="w-px h-4 sm:h-6 bg-gray-600" />
        
        {/* Maximize button */}
        <button
          onClick={onMaximize}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span className="hidden xs:inline">Open</span>
        </button>
        
        {/* End call button */}
        <button
          onClick={onEndCall}
          className="p-1.5 sm:p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          title="End call"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>
      </div>
      
      {/* Drag hint for mobile */}
      {isLongPress && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          Drag to move
        </div>
      )}
    </div>
  );
}
