import api from './api';

export interface Board {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  ownerId: string;
  organizationId: string;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; firstName: string; lastName: string; profilePicture: string | null };
  collaborators?: BoardCollaborator[];
  _count?: { comments: number; versions: number; assets?: number };
}

export interface BoardCollaborator {
  id: string;
  boardId: string;
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  joinedAt: string;
  user: { id: string; firstName: string; lastName: string; email?: string; profilePicture: string | null };
}

// ─── Board CRUD ───

export async function createBoard(title?: string): Promise<Board> {
  const { data } = await api.post('/boards', { title });
  return data.data;
}

export async function listBoards(): Promise<Board[]> {
  const { data } = await api.get('/boards');
  return data.data;
}

export async function getBoard(boardId: string): Promise<Board> {
  const { data } = await api.get(`/boards/${boardId}`);
  return data.data;
}

export async function updateBoard(boardId: string, updates: Partial<Pick<Board, 'title' | 'description' | 'visibility' | 'isFavorite' | 'isArchived'>>): Promise<Board> {
  const { data } = await api.patch(`/boards/${boardId}`, updates);
  return data.data;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}`);
}

export async function duplicateBoard(boardId: string): Promise<Board> {
  const { data } = await api.post(`/boards/${boardId}/duplicate`);
  return data.data;
}

// ─── Collaborators ───

export async function addCollaborator(boardId: string, userId: string, role?: 'EDITOR' | 'VIEWER'): Promise<BoardCollaborator> {
  const { data } = await api.post(`/boards/${boardId}/collaborators`, { userId, role });
  return data.data;
}

export async function removeCollaborator(boardId: string, userId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/collaborators/${userId}`);
}

// ─── Versions ───

export async function createVersion(boardId: string, label?: string) {
  const { data } = await api.post(`/boards/${boardId}/versions`, { label });
  return data.data;
}

export async function listVersions(boardId: string) {
  const { data } = await api.get(`/boards/${boardId}/versions`);
  return data.data;
}

export async function restoreVersion(boardId: string, versionId: string) {
  const { data } = await api.post(`/boards/${boardId}/restore/${versionId}`);
  return data.data;
}
