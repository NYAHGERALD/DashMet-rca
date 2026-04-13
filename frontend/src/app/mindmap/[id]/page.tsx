'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import { getMindMap, updateMindMap } from '@/lib/mindmapApi';
import api from '@/lib/api';
import { ArrowLeft, Save, Star, StarOff, Loader2, ZoomIn, ZoomOut, Maximize2, Plus, Trash2 } from 'lucide-react';
import type { MindMapEditorHandle, MindMapData } from '@/components/mindmap/MindMapEditor';

// jsMind must load client-side only (canvas + DOM)
const MindMapEditor = dynamic(
  () => import('@/components/mindmap/MindMapEditor'),
  { ssr: false },
);

export default function MindMapEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const editorRef = useRef<MindMapEditorHandle>(null);
  const [title, setTitle] = useState('Untitled Mind Map');
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<MindMapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);

  // Load mind map data
  useEffect(() => {
    if (!id || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    (async () => {
      try {
        const mm = await getMindMap(id);
        setTitle(mm.title);
        setIsFavorite(mm.isFavorite);

        // Load snapshot
        const { data } = await api.get(`/boards/${id}/snapshot`);
        if (data.data) {
          setInitialData(data.data);
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError('Mind map not found');
        } else {
          setError('Failed to load mind map');
        }
        console.error('Failed to load mind map:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Save snapshot
  const saveSnapshot = useCallback(async () => {
    const data = editorRef.current?.getData();
    if (!data || !id) return;

    setSaving(true);
    try {
      await api.post(`/boards/${id}/snapshot`, { snapshot: data });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save mind map:', err);
    } finally {
      setSaving(false);
    }
  }, [id]);

  // Auto-save debounced (3s after change)
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveSnapshot(), 3000);
  }, [saveSnapshot]);

  // Cleanup + final save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const data = editorRef.current?.getData();
      if (data && id) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
        const blob = new Blob([JSON.stringify({ snapshot: data })], { type: 'application/json' });
        navigator.sendBeacon(`${apiUrl}/boards/${id}/snapshot`, blob);
      }
    };
  }, [id]);

  // Title update
  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);
    try {
      await updateMindMap(id, { title: newTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  }, [id]);

  // Favorite toggle
  const handleToggleFavorite = useCallback(async () => {
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    try {
      await updateMindMap(id, { isFavorite: newVal });
    } catch (err) {
      setIsFavorite(!newVal);
      console.error('Failed to update favorite:', err);
    }
  }, [id, isFavorite]);

  // Zoom controls
  const handleZoomIn = () => {
    const jm = editorRef.current?.getInstance();
    if (jm?.view) jm.view.zoomIn();
  };
  const handleZoomOut = () => {
    const jm = editorRef.current?.getInstance();
    if (jm?.view) jm.view.zoomOut();
  };
  const handleFitCenter = () => {
    const jm = editorRef.current?.getInstance();
    if (jm) {
      try {
        jm.scroll_node_to_center('root');
      } catch (e) {
        // fallback
      }
    }
  };

  // Node operations
  const handleAddChild = () => {
    const jm = editorRef.current?.getInstance();
    if (!jm) return;
    const selected = jm.get_selected_node();
    if (!selected) return;
    const nodeId = `n_${Date.now()}`;
    jm.add_node(selected, nodeId, 'New Topic');
    debouncedSave();
  };

  const handleDeleteNode = () => {
    const jm = editorRef.current?.getInstance();
    if (!jm) return;
    const selected = jm.get_selected_node();
    if (!selected || selected.isroot) return;
    jm.remove_node(selected);
    debouncedSave();
  };

  if (!user) return null;

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{error}</h1>
          <button
            onClick={() => router.push('/mindmaps')}
            className="text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Back to mind maps
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col z-50 bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="shrink-0 h-12 flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/mindmaps')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Back to mind maps"
          >
            <ArrowLeft size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            title="Mind map title"
            placeholder="Untitled Mind Map"
            className="text-sm font-medium bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 
                       hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 
                       px-2 py-1 rounded transition-colors max-w-[300px]"
          />
        </div>

        {/* Center: node actions */}
        <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={handleAddChild}
            title="Add child node (Tab)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
          >
            <Plus size={14} />
            Add Child
          </button>
          <button
            onClick={handleDeleteNode}
            title="Delete selected node (Delete)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
          >
            <Trash2 size={14} />
            Delete
          </button>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
          <button onClick={handleZoomOut} title="Zoom out" className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors text-gray-500">
            <ZoomOut size={14} />
          </button>
          <button onClick={handleZoomIn} title="Zoom in" className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors text-gray-500">
            <ZoomIn size={14} />
          </button>
          <button onClick={handleFitCenter} title="Center view" className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors text-gray-500">
            <Maximize2 size={14} />
          </button>
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
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center gap-1.5"
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      {/* jsMind CSS */}
      <link rel="stylesheet" href="/jsmind.css" />
      <style>{`
        #jsmind_container {
          background: #fafbfc;
        }
        .dark #jsmind_container {
          background: #111827;
        }
        /* jsMind theme: primary */
        jmnodes.theme-primary jmnode {
          background-color: #f0f5ff;
          border-color: #93b4f5;
          color: #1e293b;
          border-radius: 8px;
          padding: 6px 16px;
          font-size: 14px;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          transition: all 0.15s ease;
        }
        jmnodes.theme-primary jmnode:hover {
          box-shadow: 0 2px 8px rgba(59,130,246,0.15);
        }
        jmnodes.theme-primary jmnode.selected {
          background-color: #3b82f6;
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
        }
        jmnodes.theme-primary jmnode.root {
          background-color: #3b82f6;
          color: #ffffff;
          border-color: #2563eb;
          font-size: 16px;
          font-weight: 600;
          padding: 10px 24px;
          border-radius: 12px;
        }
        jmnodes.theme-primary jmexpander {
          border-color: #93b4f5;
          background-color: #f0f5ff;
        }
        jmnodes.theme-primary jmexpander:hover {
          border-color: #3b82f6;
          background-color: #dbeafe;
        }
        /* Dark mode overrides */
        .dark jmnodes.theme-primary jmnode {
          background-color: #1e293b;
          border-color: #475569;
          color: #e2e8f0;
        }
        .dark jmnodes.theme-primary jmnode.selected {
          background-color: #3b82f6;
          color: #ffffff;
          border-color: #60a5fa;
        }
        .dark jmnodes.theme-primary jmnode.root {
          background-color: #3b82f6;
          color: #ffffff;
        }
        .dark jmnodes.theme-primary jmexpander {
          border-color: #475569;
          background-color: #1e293b;
        }
      `}</style>

      {/* Keyboard shortcuts help */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Tab</kbd> Add child</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Enter</kbd> Add sibling</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">F2</kbd> Edit</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Del</kbd> Delete</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Space</kbd> Expand/Collapse</span>
        </div>
      </div>

      {/* Mind Map Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MindMapEditor
          ref={editorRef}
          initialData={initialData}
          onChange={debouncedSave}
          editable={true}
          theme="primary"
        />
      </div>
    </div>
  );
}
