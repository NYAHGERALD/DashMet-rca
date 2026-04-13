'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { MindMap, createMindMap, listMindMaps, deleteMindMap, updateMindMap, duplicateMindMap } from '@/lib/mindmapApi';
import {
  Plus, Star, StarOff, Trash2, Copy, MoreHorizontal,
  Loader2, Network, Clock, Users, Search,
} from 'lucide-react';

function MindMapListContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [mindmaps, setMindmaps] = useState<MindMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'mine'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const fetchMindmaps = useCallback(async () => {
    try {
      const data = await listMindMaps();
      setMindmaps(data);
    } catch (err) {
      console.error('Failed to load mind maps:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    fetchMindmaps().finally(() => clearTimeout(timeout));
    return () => clearTimeout(timeout);
  }, [fetchMindmaps]);

  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    if (menuOpenId) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpenId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const mm = await createMindMap();
      router.push(`/mindmap/${mm.id}`);
    } catch (err) {
      console.error('Failed to create mind map:', err);
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this mind map? This cannot be undone.')) return;
    try {
      await deleteMindMap(id);
      setMindmaps((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Failed to delete mind map:', err);
    }
  };

  const handleToggleFavorite = async (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateMindMap(id, { isFavorite: !current });
      setMindmaps((prev) => prev.map((m) => (m.id === id ? { ...m, isFavorite: !current } : m)));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newMm = await duplicateMindMap(id);
      setMindmaps((prev) => [newMm, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate mind map:', err);
    }
  };

  const filtered = mindmaps.filter((m) => {
    if (filter === 'favorites' && !m.isFavorite) return false;
    if (filter === 'mine' && m.ownerId !== user?.id) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!user) return null;

  return (
    <div className="h-full flex flex-col p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Network size={24} className="text-violet-600" />
            Mind Maps
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Interactive mind maps for brainstorming, planning & idea organization
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                     bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium text-sm
                     hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          New Mind Map
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search mind maps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
          {(['all', 'favorites', 'mine'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize
                ${filter === f
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Mind Map Grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Network size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
              {search || filter !== 'all' ? 'No matching mind maps' : 'No mind maps yet'}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              {search || filter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first mind map to get started'}
            </p>
            {!search && filter === 'all' && (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                <Plus size={16} />
                Create Mind Map
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((mm) => (
              <div
                key={mm.id}
                onClick={() => router.push(`/mindmap/${mm.id}`)}
                className="group relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800/80 hover:border-violet-300 dark:hover:border-violet-600
                           hover:shadow-lg hover:shadow-violet-500/10 transition-all cursor-pointer overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="h-40 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                  {mm.thumbnail ? (
                    <img src={mm.thumbnail} alt={mm.title} className="w-full h-full object-cover" />
                  ) : (
                    <Network size={32} className="text-violet-300 dark:text-violet-700" />
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex-1">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {mm.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(mm.updatedAt)}
                    </span>
                    {mm.collaborators && mm.collaborators.length > 1 && (
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {mm.collaborators.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions overlay */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleToggleFavorite(mm.id, mm.isFavorite, e)}
                    className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
                  >
                    {mm.isFavorite ? (
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff size={14} className="text-gray-400" />
                    )}
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === mm.id ? null : mm.id);
                      }}
                      title="More actions"
                      className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
                    >
                      <MoreHorizontal size={14} className="text-gray-500" />
                    </button>
                    {menuOpenId === mm.id && (
                      <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20">
                        <button
                          onClick={(e) => handleDuplicate(mm.id, e)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <Copy size={12} /> Duplicate
                        </button>
                        {mm.ownerId === user?.id && (
                          <button
                            onClick={(e) => handleDelete(mm.id, e)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MindMapsPage() {
  return (
    <ProtectedRoute>
      <MindMapListContent />
    </ProtectedRoute>
  );
}
