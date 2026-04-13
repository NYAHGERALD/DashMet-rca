import api from './api';
import type { Board, BoardCollaborator } from './boardApi';

// Re-export the Board type for convenience
export type MindMap = Board;

// ─── MindMap CRUD (reuses Board API with type=MINDMAP) ───

export async function createMindMap(title?: string): Promise<MindMap> {
  const { data } = await api.post('/boards', { title, type: 'MINDMAP' });
  return data.data;
}

export async function listMindMaps(): Promise<MindMap[]> {
  const { data } = await api.get('/boards', { params: { type: 'MINDMAP' } });
  return data.data;
}

export async function getMindMap(id: string): Promise<MindMap> {
  const { data } = await api.get(`/boards/${id}`);
  return data.data;
}

export async function updateMindMap(id: string, updates: Partial<Pick<MindMap, 'title' | 'description' | 'isFavorite' | 'isArchived'>>): Promise<MindMap> {
  const { data } = await api.patch(`/boards/${id}`, updates);
  return data.data;
}

export async function deleteMindMap(id: string): Promise<void> {
  await api.delete(`/boards/${id}`);
}

export async function duplicateMindMap(id: string): Promise<MindMap> {
  const { data } = await api.post(`/boards/${id}/duplicate`);
  return data.data;
}
