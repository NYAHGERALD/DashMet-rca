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

import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

// Excalidraw must be loaded client-side only (uses window/document)
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false },
);

function getVisibleElements(elements: readonly any[]) {
  return elements.filter((element: any) => !element.isDeleted);
}

function snapshotHasVisibleContent(snapshot: any) {
  const elements = Array.isArray(snapshot?.elements) ? snapshot.elements : [];
  return elements.some((element: any) => element && !element.isDeleted);
}

function createWhiteboardSnapshot(
  elements: readonly any[],
  appState: AppState,
  files: BinaryFiles,
) {
  return {
    elements,
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridSize: appState.gridSize,
    },
    files,
  };
}

function getSceneSignature(
  elements: readonly any[],
  appState: AppState,
  files: BinaryFiles,
) {
  return JSON.stringify(createWhiteboardSnapshot(elements, appState, files));
}

function getImageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ width: 960, height: 540 });
      return;
    }

    const image = new window.Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || 960,
        height: image.naturalHeight || 540,
      });
    };
    image.onerror = () => resolve({ width: 960, height: 540 });
    image.src = dataUrl;
  });
}

async function createThumbnailRecoverySnapshot(thumbnail: string) {
  const now = Date.now();
  const dimensions = await getImageDimensions(thumbnail);
  const aspectRatio = dimensions.width > 0 ? dimensions.height / dimensions.width : 9 / 16;
  const displayWidth = Math.min(1200, Math.max(720, dimensions.width * 2));
  const displayHeight = Math.round(displayWidth * aspectRatio);
  const fileId = `recovered-thumbnail-${now}` as any;
  const mimeType = thumbnail.match(/^data:([^;]+);/)?.[1] || 'image/png';

  return {
    elements: [
      {
        id: `recovered-thumbnail-element-${now}`,
        type: 'image',
        x: 80,
        y: 80,
        width: displayWidth,
        height: displayHeight,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 1_000_000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1_000_000),
        index: null,
        isDeleted: false,
        boundElements: null,
        updated: now,
        link: null,
        locked: false,
        status: 'saved',
        fileId,
        scale: [1, 1],
        crop: null,
        customData: {
          recoveredFromThumbnail: true,
        },
      },
    ],
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: 20,
      scrollX: 80,
      scrollY: 80,
    },
    files: {
      [fileId]: {
        id: fileId,
        mimeType: mimeType as any,
        dataURL: thumbnail as any,
        created: now,
        lastRetrieved: now,
      },
    },
  };
}

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
  const hasSeenInitialChangeRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const lastSceneSignatureRef = useRef<string | null>(null);
  const hasAppliedInitialSceneRef = useRef(false);
  const isApplyingInitialSceneRef = useRef(false);
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

  // Excalidraw may emit an initial blank scene before the loaded scene is
  // fully hydrated. Re-apply stored data once the imperative API is ready so
  // opening a saved board cannot accidentally display or persist a blank scene.
  useEffect(() => {
    const api = excalidrawAPIRef.current;
    if (!api || !excalidrawReady || !initialData || hasAppliedInitialSceneRef.current) return;

    hasAppliedInitialSceneRef.current = true;
    isApplyingInitialSceneRef.current = true;

    const files = initialData.files || {};
    const elements = Array.isArray(initialData.elements) ? initialData.elements : [];
    const appState = {
      ...(initialData.appState || {}),
      gridModeEnabled: true,
      objectsSnapModeEnabled: true,
    };

    if (Object.keys(files).length > 0) {
      api.addFiles(Object.values(files) as any);
    }

    api.updateScene({
      elements,
      appState,
      captureUpdate: 'NEVER' as any,
    });

    requestAnimationFrame(() => {
      const currentAppState = api.getAppState();
      lastSceneSignatureRef.current = getSceneSignature(api.getSceneElements(), currentAppState, api.getFiles());
      isApplyingInitialSceneRef.current = false;
    });
  }, [excalidrawReady, initialData]);

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

        // Load snapshot if exists. Some older saves have an empty editable
        // scene but still have a valid thumbnail preview; show that preview on
        // canvas so the board never opens as a confusing blank grid.
        const { data } = await api.get(`/boards/${id}/snapshot`);
        if (snapshotHasVisibleContent(data.data)) {
          setInitialData(data.data);
        } else if (board.thumbnail) {
          setInitialData(await createThumbnailRecoverySnapshot(board.thumbnail));
        } else if (data.data) {
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
      const snap = createWhiteboardSnapshot(elements, appState, files);

      // Generate thumbnail
      let thumbnail: string | null = null;
      const visibleElements = getVisibleElements(elements);
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

      await api.post(`/boards/${id}/snapshot`, {
        snapshot: snap,
        thumbnail,
        allowEmptySnapshot: visibleElements.length === 0 && hasUserEditedRef.current,
      });
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

  // Cleanup save timeout on unmount.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Excalidraw onChange — triggers auto-save on user edits
  const handleChange = useCallback(
    (elements: readonly any[], appState: AppState, files: BinaryFiles) => {
      const signature = getSceneSignature(elements, appState, files);

      if (!hasSeenInitialChangeRef.current || isApplyingInitialSceneRef.current) {
        hasSeenInitialChangeRef.current = true;
        lastSceneSignatureRef.current = signature;
        return;
      }

      if (signature === lastSceneSignatureRef.current) {
        return;
      }

      lastSceneSignatureRef.current = signature;
      hasUserEditedRef.current = true;
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
