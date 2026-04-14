'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import TemplatePicker from '@/components/whiteboard/TemplatePicker';
import { LayoutTemplate } from 'lucide-react';
import { getBoard, updateBoard } from '@/lib/boardApi';
import api from '@/lib/api';
import { ArrowLeft, Save, Star, StarOff, Loader2 } from 'lucide-react';

import type { ExcalidrawImperativeAPI, ExcalidrawElement, AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

// Excalidraw must be loaded client-side only (uses window/document)
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false },
);

export default function WhiteboardEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [excalidrawReady, setExcalidrawReady] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Mouse wheel → zoom (instead of scroll)
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !excalidrawReady) return;

    const handleWheel = (e: WheelEvent) => {
      // Already ctrl/meta — Excalidraw handles zoom natively
      if (e.ctrlKey || e.metaKey) return;
      // Skip our own re-dispatched events
      if ((e as any)._zoomRedispatched) return;
      // Only process events targeting the canvas, not portals/modals
      const isInsideContainer = container.contains(e.target as Node);
      console.log('[page.tsx] wheel handler fired', {
        targetTag: (e.target as HTMLElement)?.tagName,
        isInsideContainer,
        willProcess: isInsideContainer,
      });
      if (!isInsideContainer) return;

      e.preventDefault();
      e.stopPropagation();

      // Re-dispatch as ctrl+wheel so Excalidraw zooms to cursor
      const zoomEvent = new WheelEvent('wheel', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        ctrlKey: true,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        bubbles: true,
        cancelable: true,
      });
      (zoomEvent as any)._zoomRedispatched = true;
      e.target?.dispatchEvent(zoomEvent);
    };

    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', handleWheel, { capture: true } as any);
  }, [excalidrawReady]);

  // Load bundled libraries into Excalidraw after API is ready
  useEffect(() => {
    if (!excalidrawReady) return;
    const api = excalidrawAPIRef.current;
    if (!api) return;

    fetch('/libraries/bundled-libraries.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((libraryItems) => {
        api.updateLibrary({
          libraryItems,
          merge: true,
          openLibraryMenu: false,
        });
      })
      .catch((err) => console.warn('Failed to load bundled libraries:', err));
  }, [excalidrawReady]);

  // Load board data and snapshot
  useEffect(() => {
    if (!id || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    (async () => {
      try {
        const board = await getBoard(id);
        setBoardTitle(board.title);
        setIsFavorite(board.isFavorite);

        // Load snapshot if exists
        const { data } = await api.get(`/boards/${id}/snapshot`);
        if (data.data) {
          setInitialData(data.data);
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError('Board not found');
        } else {
          setError('Failed to load board');
        }
        console.error('Failed to load board:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Save snapshot to backend
  const saveSnapshot = useCallback(async () => {
    const excalidrawAPI = excalidrawAPIRef.current;
    if (!excalidrawAPI || !id) return;

    setSaving(true);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const snap = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize }, files };

      // Generate thumbnail
      let thumbnail: string | undefined;
      const visibleElements = elements.filter((el: any) => !el.isDeleted);
      if (visibleElements.length > 0) {
        try {
          const { exportToBlob } = await import('@excalidraw/excalidraw');
          const blob = await exportToBlob({
            elements: visibleElements,
            appState: { ...appState, exportWithDarkMode: false, viewBackgroundColor: appState.viewBackgroundColor || '#ffffff' },
            files,
            maxWidthOrHeight: 320,
          });
          thumbnail = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (thumbErr) {
          console.warn('Thumbnail generation failed:', thumbErr);
        }
      }

      await api.post(`/boards/${id}/snapshot`, { snapshot: snap, thumbnail });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save board:', err);
    } finally {
      setSaving(false);
    }
  }, [id]);

  // Auto-save debounced (3s after last change)
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveSnapshot();
    }, 3000);
  }, [saveSnapshot]);

  // Cleanup save timeout on unmount; save final state
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      // Final save on unmount
      const excalidrawAPI = excalidrawAPIRef.current;
      if (excalidrawAPI && id) {
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();
        const snap = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize }, files };
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
        const blob = new Blob([JSON.stringify({ snapshot: snap })], { type: 'application/json' });
        navigator.sendBeacon(`${apiUrl}/boards/${id}/snapshot`, blob);
      }
    };
  }, [id]);

  // Excalidraw onChange — triggers auto-save on user edits
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      debouncedSave();
    },
    [debouncedSave],
  );

  // Update board title
  const handleTitleChange = useCallback(async (newTitle: string) => {
    setBoardTitle(newTitle);
    try {
      await updateBoard(id, { title: newTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  }, [id]);

  // Toggle favorite
  const handleToggleFavorite = useCallback(async () => {
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    try {
      await updateBoard(id, { isFavorite: newVal });
    } catch (err) {
      setIsFavorite(!newVal);
      console.error('Failed to update favorite:', err);
    }
  }, [id, isFavorite]);



  if (!user) return null;

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{error}</h1>
          <button
            onClick={() => router.push('/whiteboard')}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Back to boards
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col z-50 bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="shrink-0 h-12 flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/whiteboard')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Back to boards"
          >
            <ArrowLeft size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
          <input
            type="text"
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            onBlur={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="text-sm font-medium bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 
                       hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 
                       px-2 py-1 rounded transition-colors max-w-[300px]"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Save status */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            {saving ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Save size={12} />
                <span>Saved {lastSaved.toLocaleTimeString()}</span>
              </>
            ) : null}
          </div>
          <button
            onClick={handleToggleFavorite}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <Star size={16} className="text-yellow-500 fill-yellow-500" />
            ) : (
              <StarOff size={16} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={saveSnapshot}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      {/* Move Excalidraw's properties panel to the right side & rebrand library */}
      <style>{`
        .excalidraw .App-menu_left {
          right: 0 !important;
          left: auto !important;
        }
        .excalidraw .library-menu-items-container__header--excal {
          font-size: 0 !important;
        }
        .excalidraw .library-menu-items-container__header--excal::before {
          content: "Dashmet Library";
          font-size: 0.85rem;
        }
        .excalidraw .library-menu-browse-button {
          display: none !important;
        }
        .excalidraw .dropdown-menu-group:has(.dropdown-menu-group-title) {
          display: none !important;
        }
        .excalidraw .HelpDialog__header {
          display: none !important;
        }
      `}</style>

      {/* Canvas */}
      <div ref={canvasContainerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <Excalidraw
            excalidrawAPI={(api) => { excalidrawAPIRef.current = api; setExcalidrawReady(true); }}
            initialData={initialData ? {
              elements: initialData.elements || [],
              appState: {
                ...initialData.appState,
                gridModeEnabled: true,
                objectsSnapModeEnabled: true,
              },
              files: initialData.files || {},
            } : {
              appState: {
                gridModeEnabled: true,
                objectsSnapModeEnabled: true,
              },
            }}
            onChange={handleChange}
            gridModeEnabled={true}
            objectsSnapModeEnabled={true}
          />
          {/* Floating template button */}
          <button
            onClick={() => setTemplatePickerOpen(true)}
            title="Diagram Templates"
            className="absolute left-3 bottom-16 z-[300] p-2.5 rounded-xl
              bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl
              border border-gray-200/80 dark:border-gray-700/80
              shadow-lg shadow-black/8
              text-gray-500 hover:text-blue-600 hover:bg-blue-50
              dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30
              transition-all duration-150"
          >
            <LayoutTemplate size={18} />
          </button>
        </div>
      </div>
      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        excalidrawAPI={excalidrawAPIRef}
      />
    </div>
  );
}
