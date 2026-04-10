import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import boardService from './boardService';

const docs = new Map<string, Y.Doc>();

/**
 * Get or create a Yjs document for a board.
 * Loads persisted state from the database on first access.
 */
async function getYDoc(boardId: string): Promise<Y.Doc> {
  let doc = docs.get(boardId);
  if (doc) return doc;

  doc = new Y.Doc();
  docs.set(boardId, doc);

  // Load persisted state
  const state = await boardService.loadYjsState(boardId);
  if (state) {
    Y.applyUpdate(doc, new Uint8Array(state));
  }

  // Auto-persist on updates (debounced)
  let saveTimeout: NodeJS.Timeout | null = null;
  doc.on('update', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const encoded = Y.encodeStateAsUpdate(doc!);
      await boardService.saveYjsState(boardId, Buffer.from(encoded));
    }, 2000); // Save 2s after last change
  });

  return doc;
}

/**
 * Initialize the Yjs WebSocket server on the existing HTTP server.
 * Clients connect to: ws://host:port/ws/board/:boardId
 */
export function initializeYjsWebSocket(httpServer: HTTPServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = request.url || '';

    // Only handle /ws/board/:boardId
    const match = url.match(/^\/ws\/board\/([a-zA-Z0-9-]+)/);
    if (!match) return; // Let other upgrade handlers (existing websocketService) handle it

    const boardId = match[1];

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, boardId);
    });
  });

  wss.on('connection', async (ws: WebSocket, _request: any, boardId: string) => {
    const doc = await getYDoc(boardId);

    // Send current state to new client
    const currentState = Y.encodeStateAsUpdate(doc);
    ws.send(currentState);

    // Listen for updates from this client
    ws.on('message', (message: Buffer) => {
      try {
        const update = new Uint8Array(message);
        Y.applyUpdate(doc, update);

        // Broadcast to all other clients on this board
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      } catch (e) {
        console.error('Yjs message error:', e);
      }
    });

    ws.on('close', () => {
      // Clean up doc if no more clients
      let hasClients = false;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) hasClients = true;
      });
      if (!hasClients && docs.has(boardId)) {
        // Persist final state and remove from memory
        const encoded = Y.encodeStateAsUpdate(doc);
        boardService.saveYjsState(boardId, Buffer.from(encoded)).catch(console.error);
        doc.destroy();
        docs.delete(boardId);
      }
    });
  });

  console.log('📋 Canvas AI: Yjs WebSocket server initialized at /ws/board/:boardId');
}

export default { initializeYjsWebSocket };
