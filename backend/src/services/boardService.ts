import { PrismaClient, BoardVisibility, BoardCollaboratorRole, BoardType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Board CRUD ───

export async function createBoard(userId: string, organizationId: string, title?: string, type: BoardType = 'WHITEBOARD') {
  return prisma.board.create({
    data: {
      type,
      title: title || 'Untitled Board',
      ownerId: userId,
      organizationId,
      collaborators: {
        create: { userId, role: 'OWNER' },
      },
    },
    include: { collaborators: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true } } } } },
  });
}

export async function listBoards(userId: string, organizationId: string, type?: BoardType) {
  return prisma.board.findMany({
    where: {
      organizationId,
      isArchived: false,
      ...(type ? { type } : {}),
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId } } },
        { visibility: 'TEAM' },
        { visibility: 'PUBLIC' },
      ],
    },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
      collaborators: { include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } } },
      _count: { select: { comments: true, versions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getBoard(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true } },
      collaborators: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true } } } },
      _count: { select: { comments: true, versions: true, assets: true } },
    },
  });
  if (!board) return null;

  // Check access
  const hasAccess =
    board.ownerId === userId ||
    board.visibility === 'PUBLIC' ||
    (board.visibility === 'TEAM' && board.organizationId) ||
    board.collaborators.some((c) => c.userId === userId);

  if (!hasAccess) return null;
  return board;
}

export async function updateBoard(boardId: string, userId: string, data: { title?: string; description?: string; visibility?: BoardVisibility; isFavorite?: boolean; isArchived?: boolean }) {
  // Verify ownership or editor role
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { collaborators: true },
  });
  if (!board) return null;
  const collab = board.collaborators.find((c) => c.userId === userId);
  if (board.ownerId !== userId && (!collab || collab.role === 'VIEWER')) return null;

  return prisma.board.update({
    where: { id: boardId },
    data,
  });
}

export async function deleteBoard(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board || board.ownerId !== userId) return false;
  await prisma.board.delete({ where: { id: boardId } });
  return true;
}

export async function duplicateBoard(boardId: string, userId: string) {
  const original = await prisma.board.findUnique({ where: { id: boardId } });
  if (!original) return null;

  return prisma.board.create({
    data: {
      type: original.type,
      title: `${original.title} (Copy)`,
      description: original.description,
      ownerId: userId,
      organizationId: original.organizationId,
      yjsState: original.yjsState,
      collaborators: {
        create: { userId, role: 'OWNER' },
      },
    },
  });
}

// ─── Yjs State Persistence ───

export async function saveYjsState(boardId: string, state: Buffer) {
  await prisma.board.update({
    where: { id: boardId },
    data: { yjsState: state, updatedAt: new Date() },
  });
}

export async function loadYjsState(boardId: string): Promise<Buffer | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { yjsState: true },
  });
  return board?.yjsState ? Buffer.from(board.yjsState) : null;
}

// ─── Version History ───

export async function createVersion(boardId: string, userId: string, label?: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { yjsState: true },
  });
  if (!board?.yjsState) return null;

  return prisma.boardVersion.create({
    data: {
      boardId,
      snapshot: board.yjsState,
      label,
      createdById: userId,
    },
  });
}

export async function listVersions(boardId: string) {
  return prisma.boardVersion.findMany({
    where: { boardId },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function restoreVersion(boardId: string, versionId: string) {
  const version = await prisma.boardVersion.findUnique({ where: { id: versionId } });
  if (!version || version.boardId !== boardId) return null;

  return prisma.board.update({
    where: { id: boardId },
    data: { yjsState: version.snapshot },
  });
}

// ─── Collaborators ───

export async function addCollaborator(boardId: string, userId: string, role: BoardCollaboratorRole = 'EDITOR') {
  return prisma.boardCollaborator.upsert({
    where: { boardId_userId: { boardId, userId } },
    update: { role },
    create: { boardId, userId, role },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true } } },
  });
}

export async function removeCollaborator(boardId: string, userId: string) {
  const collab = await prisma.boardCollaborator.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  if (!collab || collab.role === 'OWNER') return false;
  await prisma.boardCollaborator.delete({
    where: { boardId_userId: { boardId, userId } },
  });
  return true;
}

// ─── Comments ───

export async function addComment(boardId: string, userId: string, content: string, posX?: number, posY?: number, parentId?: string) {
  return prisma.boardComment.create({
    data: { boardId, userId, content, posX, posY, parentId },
    include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
  });
}

export async function listComments(boardId: string) {
  return prisma.boardComment.findMany({
    where: { boardId, parentId: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
      replies: {
        include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Tldraw Snapshot Persistence ───

export async function saveSnapshot(boardId: string, snapshot: any, thumbnail?: string) {
  const jsonStr = JSON.stringify(snapshot);
  const data: any = { yjsState: Buffer.from(jsonStr, 'utf-8'), updatedAt: new Date() };
  if (thumbnail) data.thumbnail = thumbnail;
  await prisma.board.update({
    where: { id: boardId },
    data,
  });
}

export async function loadSnapshot(boardId: string): Promise<any | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { yjsState: true },
  });
  if (!board?.yjsState) return null;
  try {
    return JSON.parse(Buffer.from(board.yjsState).toString('utf-8'));
  } catch {
    return null;
  }
}

export default {
  createBoard, listBoards, getBoard, updateBoard, deleteBoard, duplicateBoard,
  saveYjsState, loadYjsState,
  saveSnapshot, loadSnapshot,
  createVersion, listVersions, restoreVersion,
  addCollaborator, removeCollaborator,
  addComment, listComments,
};
