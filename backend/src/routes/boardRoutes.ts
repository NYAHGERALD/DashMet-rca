import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import boardService from '../services/boardService';

const router = Router();

// All board routes require authentication
router.use(authenticate);

// ─── Board CRUD ───

// POST /api/boards — Create a new board
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id: userId, organizationId } = (req as any).user;
    const { title } = req.body;
    const board = await boardService.createBoard(userId, organizationId, title);
    res.status(201).json({ success: true, data: board });
  } catch (error: any) {
    console.error('Error creating board:', error);
    res.status(500).json({ success: false, message: 'Failed to create board' });
  }
});

// GET /api/boards — List all boards
router.get('/', async (req: Request, res: Response) => {
  try {
    const { id: userId, organizationId } = (req as any).user;
    const boards = await boardService.listBoards(userId, organizationId);
    res.json({ success: true, data: boards });
  } catch (error: any) {
    console.error('Error listing boards:', error);
    res.status(500).json({ success: false, message: 'Failed to list boards' });
  }
});

// GET /api/boards/:id — Get board metadata
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id: userId } = (req as any).user;
    const board = await boardService.getBoard(req.params.id, userId);
    if (!board) return res.status(404).json({ success: false, message: 'Board not found' });
    res.json({ success: true, data: board });
  } catch (error: any) {
    console.error('Error getting board:', error);
    res.status(500).json({ success: false, message: 'Failed to get board' });
  }
});

// PATCH /api/boards/:id — Update board
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id: userId } = (req as any).user;
    const { title, description, visibility, isFavorite, isArchived } = req.body;
    const board = await boardService.updateBoard(req.params.id, userId, { title, description, visibility, isFavorite, isArchived });
    if (!board) return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, data: board });
  } catch (error: any) {
    console.error('Error updating board:', error);
    res.status(500).json({ success: false, message: 'Failed to update board' });
  }
});

// DELETE /api/boards/:id — Delete board
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id: userId } = (req as any).user;
    const deleted = await boardService.deleteBoard(req.params.id, userId);
    if (!deleted) return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, message: 'Board deleted' });
  } catch (error: any) {
    console.error('Error deleting board:', error);
    res.status(500).json({ success: false, message: 'Failed to delete board' });
  }
});

// POST /api/boards/:id/duplicate — Duplicate board
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const { id: userId } = (req as any).user;
    const board = await boardService.duplicateBoard(req.params.id, userId);
    if (!board) return res.status(404).json({ success: false, message: 'Board not found' });
    res.status(201).json({ success: true, data: board });
  } catch (error: any) {
    console.error('Error duplicating board:', error);
    res.status(500).json({ success: false, message: 'Failed to duplicate board' });
  }
});

// ─── Tldraw Snapshot ───

// POST /api/boards/:id/snapshot — Save tldraw snapshot
router.post('/:id/snapshot', async (req: Request, res: Response) => {
  try {
    const { snapshot, thumbnail } = req.body;
    if (!snapshot) return res.status(400).json({ success: false, message: 'snapshot required' });
    await boardService.saveSnapshot(req.params.id, snapshot, thumbnail);
    res.json({ success: true, message: 'Snapshot saved' });
  } catch (error: any) {
    console.error('Error saving snapshot:', error);
    res.status(500).json({ success: false, message: 'Failed to save snapshot' });
  }
});

// GET /api/boards/:id/snapshot — Load tldraw snapshot
router.get('/:id/snapshot', async (req: Request, res: Response) => {
  try {
    const snapshot = await boardService.loadSnapshot(req.params.id);
    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    console.error('Error loading snapshot:', error);
    res.status(500).json({ success: false, message: 'Failed to load snapshot' });
  }
});

// ─── Version History ───

// POST /api/boards/:id/versions — Create version snapshot
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id: userId } = (req as any).user;
    const { label } = req.body;
    const version = await boardService.createVersion(req.params.id, userId, label);
    if (!version) return res.status(400).json({ success: false, message: 'No state to save' });
    res.status(201).json({ success: true, data: version });
  } catch (error: any) {
    console.error('Error creating version:', error);
    res.status(500).json({ success: false, message: 'Failed to create version' });
  }
});

// GET /api/boards/:id/versions — List versions
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await boardService.listVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (error: any) {
    console.error('Error listing versions:', error);
    res.status(500).json({ success: false, message: 'Failed to list versions' });
  }
});

// POST /api/boards/:id/restore/:versionId — Restore version
router.post('/:id/restore/:versionId', async (req: Request, res: Response) => {
  try {
    const board = await boardService.restoreVersion(req.params.id, req.params.versionId);
    if (!board) return res.status(404).json({ success: false, message: 'Version not found' });
    res.json({ success: true, data: board });
  } catch (error: any) {
    console.error('Error restoring version:', error);
    res.status(500).json({ success: false, message: 'Failed to restore version' });
  }
});

// ─── Collaborators ───

// POST /api/boards/:id/collaborators — Add collaborator
router.post('/:id/collaborators', async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
    const collab = await boardService.addCollaborator(req.params.id, userId, role);
    res.status(201).json({ success: true, data: collab });
  } catch (error: any) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ success: false, message: 'Failed to add collaborator' });
  }
});

// DELETE /api/boards/:id/collaborators/:userId — Remove collaborator
router.delete('/:id/collaborators/:userId', async (req: Request, res: Response) => {
  try {
    const removed = await boardService.removeCollaborator(req.params.id, req.params.userId);
    if (!removed) return res.status(400).json({ success: false, message: 'Cannot remove owner' });
    res.json({ success: true, message: 'Collaborator removed' });
  } catch (error: any) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ success: false, message: 'Failed to remove collaborator' });
  }
});

// ─── Comments ───

// POST /api/boards/:id/comments — Add comment
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id: userId } = (req as any).user;
    const { content, posX, posY, parentId } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'content required' });
    const comment = await boardService.addComment(req.params.id, userId, content, posX, posY, parentId);
    res.status(201).json({ success: true, data: comment });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
});

// GET /api/boards/:id/comments — List comments
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await boardService.listComments(req.params.id);
    res.json({ success: true, data: comments });
  } catch (error: any) {
    console.error('Error listing comments:', error);
    res.status(500).json({ success: false, message: 'Failed to list comments' });
  }
});

export default router;
