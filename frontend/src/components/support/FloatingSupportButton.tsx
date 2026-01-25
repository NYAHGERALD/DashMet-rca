'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MessageCircle, X, Minus, Send, Paperclip, Maximize2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

type RecipientRole = 'ADMIN' | 'QUALITY_CONTROL_MANAGER';

interface PastedImage {
  id: string;
  dataUrl: string;
  file: File;
}

// Custom event name for opening support modal externally
export const OPEN_SUPPORT_MODAL_EVENT = 'openSupportModal';

// Helper function to open the support modal from anywhere in the app
export function openSupportModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_MODAL_EVENT));
  }
}

export default function FloatingSupportButton() {
  const { user, getIdToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [subject, setSubject] = useState('');
  const [recipient, setRecipient] = useState<RecipientRole>('ADMIN');
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Position and size state - responsive defaults
  const [position, setPosition] = useState({ x: 20, y: 200 });
  const [size, setSize] = useState({ width: 360, height: 450 });
  const [isMobile, setIsMobile] = useState(false);
  
  // Initialize position on mount and handle window resize
  useEffect(() => {
    const updatePosition = () => {
      const isSmallMobile = window.innerWidth < 400;
      const isMobileScreen = window.innerWidth < 640;
      setIsMobile(isMobileScreen);
      
      if (isSmallMobile) {
        // On very small phones, take full width with small margins
        setPosition({ x: 5, y: 40 });
        setSize({ width: window.innerWidth - 10, height: window.innerHeight - 80 });
      } else if (isMobileScreen) {
        // On mobile, center and take more screen
        setPosition({ x: 10, y: 50 });
        setSize({ width: window.innerWidth - 20, height: window.innerHeight - 100 });
      } else {
        setPosition({ x: 20, y: Math.max(60, window.innerHeight - 500) });
        setSize({ width: 380, height: 450 });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen]);

  // Listen for external open events (e.g., from AccessDeniedModal's Contact Support button)
  useEffect(() => {
    const handleOpenEvent = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener(OPEN_SUPPORT_MODAL_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_SUPPORT_MODAL_EVENT, handleOpenEvent);
  }, []);
  
  // Refs for smooth dragging/resizing
  const modalRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if we should show the floating button (not for Admin or System Admin)
  // But we still render the modal for all users so they can contact support via AccessDeniedModal
  const showFloatingButton = user && user.role !== 'ADMIN' && user.role !== 'SYSTEM_ADMIN';

  // Handle paste for images - adds to attachments
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const imageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            // Add to pasted images for thumbnail display
            setPastedImages(prev => [...prev, {
              id: imageId,
              dataUrl,
              file
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  // Remove pasted image
  const removePastedImage = (id: string) => {
    setPastedImages(prev => prev.filter(img => img.id !== id));
  };

  // Handle file attachment
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Dragging handlers (Mouse)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMinimized) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  }, [position, isMinimized]);

  // Dragging handlers (Touch)
  const handleTouchDragStart = useCallback((e: React.TouchEvent) => {
    if (isMinimized) return;
    const touch = e.touches[0];
    isDragging.current = true;
    dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
  }, [position, isMinimized]);

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const newX = Math.max(0, Math.min(e.clientX - dragStart.current.x, window.innerWidth - size.width));
    const newY = Math.max(0, Math.min(e.clientY - dragStart.current.y, window.innerHeight - size.height));
    setPosition({ x: newX, y: newY });
  }, [size]);

  const handleTouchDrag = useCallback((e: TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    const newX = Math.max(0, Math.min(touch.clientX - dragStart.current.x, window.innerWidth - size.width));
    const newY = Math.max(0, Math.min(touch.clientY - dragStart.current.y, window.innerHeight - size.height));
    setPosition({ x: newX, y: newY });
  }, [size]);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Resizing handlers (Mouse)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
    e.stopPropagation();
    e.preventDefault();
  }, [size]);

  // Resizing handlers (Touch)
  const handleTouchResizeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    isResizing.current = true;
    resizeStart.current = { x: touch.clientX, y: touch.clientY, width: size.width, height: size.height };
    e.stopPropagation();
  }, [size]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 40 : 600;
    const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 100 : 700;
    const newWidth = Math.max(280, resizeStart.current.width + (e.clientX - resizeStart.current.x));
    const newHeight = Math.max(300, resizeStart.current.height + (e.clientY - resizeStart.current.y));
    setSize({ width: Math.min(newWidth, maxWidth), height: Math.min(newHeight, maxHeight) });
  }, []);

  const handleTouchResize = useCallback((e: TouchEvent) => {
    if (!isResizing.current) return;
    const touch = e.touches[0];
    const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 40 : 600;
    const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 100 : 700;
    const newWidth = Math.max(280, resizeStart.current.width + (touch.clientX - resizeStart.current.x));
    const newHeight = Math.max(300, resizeStart.current.height + (touch.clientY - resizeStart.current.y));
    setSize({ width: Math.min(newWidth, maxWidth), height: Math.min(newHeight, maxHeight) });
  }, []);

  const handleResizeEnd = useCallback(() => {
    isResizing.current = false;
  }, []);

  // Global mouse and touch event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleDrag(e);
      handleResize(e);
    };
    const handleMouseUp = () => {
      handleDragEnd();
      handleResizeEnd();
    };
    const handleTouchMove = (e: TouchEvent) => {
      handleTouchDrag(e);
      handleTouchResize(e);
    };
    const handleTouchEnd = () => {
      handleDragEnd();
      handleResizeEnd();
    };
    
    // Mouse events
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    // Touch events
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleDrag, handleResize, handleDragEnd, handleResizeEnd, handleTouchDrag, handleTouchResize]);

  // Submit handler
  const handleSubmit = async () => {
    const messageContent = (messageRef.current as HTMLTextAreaElement)?.value?.trim() || '';
    
    // Validate subject (min 5 characters)
    if (!subject.trim()) {
      alert('Please enter a subject');
      return;
    }
    if (subject.trim().length < 5) {
      alert('Subject must be at least 5 characters');
      return;
    }
    
    // Validate message
    if (!messageContent) {
      alert('Please enter a message');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('message', messageContent);
      formData.append('recipientRole', recipient);
      
      // Add pasted images
      pastedImages.forEach((img, idx) => {
        formData.append('attachments', img.file, `pasted-image-${idx}.png`);
      });
      
      // Add file attachments
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/support`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Support request error:', errorData);
        const errorMessage = errorData.message || errorData.errors?.[0]?.msg || 'Failed to submit';
        throw new Error(errorMessage);
      }
      
      setSubmitSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubject('');
        if (messageRef.current) (messageRef.current as HTMLTextAreaElement).value = '';
        setPastedImages([]);
        setAttachments([]);
        setSubmitSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Support submission error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to submit support request';
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Minimize toggle - dock to bottom left
  const toggleMinimize = () => {
    if (!isMinimized) {
      setIsMinimized(true);
    } else {
      setIsMinimized(false);
    }
  };

  // Restore from minimized
  const handleRestore = () => {
    setIsMinimized(false);
  };

  // If no user at all, don't render anything
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Floating Button - Bottom Left (only for non-Admin users) */}
      {showFloatingButton && !isOpen && !isMinimized && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 left-5 z-50 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white w-14 h-14 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          style={{ zIndex: 9999 }}
          title="Contact Support"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Minimized Dock - Bottom Left (only for non-Admin users) */}
      {showFloatingButton && isMinimized && (
        <button
          onClick={handleRestore}
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200"
          style={{ zIndex: 9999 }}
        >
          <MessageCircle size={18} />
          <span className="font-medium text-sm">Support Message</span>
          <Maximize2 size={14} className="ml-1" />
        </button>
      )}

      {/* Modal */}
      {isOpen && !isMinimized && (
        <div
          ref={modalRef}
          className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height,
            zIndex: 9999,
            userSelect: isDragging.current ? 'none' : 'auto',
          }}
        >
          {/* Header - Draggable (supports both mouse and touch) */}
          <div
            className={`bg-green-600 text-white ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} flex items-center justify-between cursor-move select-none touch-none`}
            onMouseDown={handleDragStart}
            onTouchStart={handleTouchDragStart}
          >
            <div className="flex items-center gap-2">
              <MessageCircle size={isMobile ? 16 : 18} />
              <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>Support Request</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMinimize}
                className="p-1.5 hover:bg-green-700 rounded transition-colors"
                title="Minimize"
              >
                <Minus size={isMobile ? 14 : 16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-green-700 rounded transition-colors"
                title="Close"
              >
                <X size={isMobile ? 14 : 16} />
              </button>
            </div>
          </div>

          {/* Success Message */}
          {submitSuccess && (
            <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="text-green-600 text-4xl mb-2">✓</div>
                <p className="text-green-700 font-medium">Request Sent!</p>
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className={`flex-1 flex flex-col overflow-hidden ${isMobile ? 'p-3 space-y-2' : 'p-4 space-y-3'}`}>
            {/* Recipient */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Send To</label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value as RecipientRole)}
                className={`w-full ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none`}
              >
                <option value="ADMIN">Admin</option>
                {/* QC Manager cannot send requests to themselves */}
                {user?.role !== 'QUALITY_CONTROL_MANAGER' && (
                  <option value="QUALITY_CONTROL_MANAGER">QC Manager</option>
                )}
              </select>
            </div>

            {/* Subject */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description..."
                className={`w-full ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none`}
              />
            </div>

            {/* Message - textarea with paste support */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-xs font-medium text-gray-600 mb-1 flex-shrink-0">Message</label>
              <textarea
                ref={messageRef as any}
                onPaste={handlePaste}
                placeholder="Type your message..."
                className={`flex-1 w-full ${isMobile ? 'px-2 py-2 text-xs' : 'px-3 py-3 text-sm'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none bg-white`}
                style={{ minHeight: isMobile ? '60px' : '80px' }}
              />
            </div>

            {/* Pasted Images Thumbnails */}
            {pastedImages.length > 0 && (
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Pasted Images</label>
                <div className="flex flex-wrap gap-2">
                  {pastedImages.map((img) => (
                    <div key={img.id} className="relative group">
                      <img
                        src={img.dataUrl}
                        alt="Pasted"
                        className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} object-cover rounded-lg border-2 border-green-400`}
                      />
                      <button
                        onClick={() => removePastedImage(img.id)}
                        className={`absolute -top-1 -right-1 bg-red-500 text-white rounded-full ${isMobile ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs'} flex items-center justify-center font-bold shadow-md hover:bg-red-600 transition-colors`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Attachments */}
            <div className="flex-shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-green-600 transition-colors"
              >
                <Paperclip size={isMobile ? 12 : 14} />
                <span>Attach files</span>
              </button>
              {attachments.length > 0 && (
                <div className="mt-1 space-y-1">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded">
                      <span className={`truncate ${isMobile ? 'max-w-[150px]' : 'max-w-[200px]'}`}>{file.name}</span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={`border-t ${isMobile ? 'p-2' : 'p-3'}`}>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white ${isMobile ? 'py-2 px-3 text-xs' : 'py-2 px-4 text-sm'} rounded-lg font-medium flex items-center justify-center gap-2 transition-colors`}
            >
              {isSubmitting ? (
                <>
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} border-2 border-white/30 border-t-white rounded-full animate-spin`} />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={isMobile ? 14 : 16} />
                  Send Request
                </>
              )}
            </button>
          </div>

          {/* Resize Handle (supports both mouse and touch) */}
          <div
            onMouseDown={handleResizeStart}
            onTouchStart={handleTouchResizeStart}
            className={`absolute bottom-0 right-0 ${isMobile ? 'w-6 h-6' : 'w-4 h-4'} cursor-se-resize touch-none`}
            style={{
              background: 'linear-gradient(135deg, transparent 50%, #9ca3af 50%)',
            }}
          />
        </div>
      )}

      {/* CSS for placeholder */}
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
