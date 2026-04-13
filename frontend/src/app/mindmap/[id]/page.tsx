'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import { getMindMap, updateMindMap } from '@/lib/mindmapApi';
import api from '@/lib/api';
import { ArrowLeft, Save, Star, StarOff, Loader2 } from 'lucide-react';
import type { MindMapEditorHandle, MindMapSaveData } from '@/components/mindmap/MindMapEditor';

// React Flow must load client-side only
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
  const [initialData, setInitialData] = useState<MindMapSaveData | null>(null);
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

      {/* Mind Map Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MindMapEditor
          ref={editorRef}
          initialData={initialData}
          onChange={debouncedSave}
        />
      </div>
    </div>
  );
}
