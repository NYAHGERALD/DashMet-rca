'use client';

import { useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Position,
  Handle,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';

/* ────────────────────────────────────────────────────────────────────────────
 * MindMapEditor — React Flow + dagre auto-layout mind map
 *
 * Features:
 *   • Auto-layout (horizontal tree via dagre)
 *   • Tab = add child, Enter = add sibling, Delete = remove
 *   • Click node to select, double-click to edit label
 *   • Drag nodes to reposition
 *   • Smooth bezier edges with gradient colors
 *   • Custom node component with depth-based coloring
 *   • Zoom, pan, minimap, controls
 * ──────────────────────────────────────────────────────────────────────────── */

// ─── Types ───

export interface MindMapSaveData {
  nodes: Array<{ id: string; label: string; parentId: string | null; color?: string }>;
}

export interface MindMapEditorHandle {
  getData: () => MindMapSaveData;
}

interface MindMapEditorProps {
  initialData?: MindMapSaveData | null;
  onChange?: () => void;
}

// ─── Color palette by depth ───

const DEPTH_COLORS = [
  { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' }, // root — blue
  { bg: '#f0f5ff', text: '#1e40af', border: '#93b4f5' }, // depth 1
  { bg: '#f0fdf4', text: '#166534', border: '#86efac' }, // depth 2
  { bg: '#fefce8', text: '#854d0e', border: '#fde047' }, // depth 3
  { bg: '#fdf2f8', text: '#9d174d', border: '#f9a8d4' }, // depth 4
  { bg: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' }, // depth 5+
];

function getDepthColor(depth: number) {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

// ─── Dagre layout ───

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 30, ranksep: 80, edgesep: 20 });

  nodes.forEach((node) => {
    const w = node.data.isRoot ? 160 : Math.max(120, (node.data.label as string).length * 9 + 40);
    const h = node.data.isRoot ? 48 : 38;
    g.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const w = node.data.isRoot ? 160 : Math.max(120, (node.data.label as string).length * 9 + 40);
    const h = node.data.isRoot ? 48 : 38;
    return {
      ...node,
      position: { x: dagreNode.x - w / 2, y: dagreNode.y - h / 2 },
      style: { width: w },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ─── Default mind map data ───

const DEFAULT_DATA: MindMapSaveData = {
  nodes: [
    { id: 'root', label: 'Central Idea', parentId: null },
    { id: 'topic1', label: 'Topic 1', parentId: 'root' },
    { id: 'topic2', label: 'Topic 2', parentId: 'root' },
    { id: 'topic3', label: 'Topic 3', parentId: 'root' },
    { id: 'topic4', label: 'Topic 4', parentId: 'root' },
    { id: 'sub1_1', label: 'Sub-topic 1.1', parentId: 'topic1' },
    { id: 'sub1_2', label: 'Sub-topic 1.2', parentId: 'topic1' },
    { id: 'sub2_1', label: 'Sub-topic 2.1', parentId: 'topic2' },
    { id: 'sub3_1', label: 'Sub-topic 3.1', parentId: 'topic3' },
  ],
};

// ─── Helpers ───

function buildDepthMap(saveNodes: MindMapSaveData['nodes']): Map<string, number> {
  const map = new Map<string, number>();
  const root = saveNodes.find((n) => !n.parentId);
  if (!root) return map;
  map.set(root.id, 0);
  const queue = [root.id];
  while (queue.length) {
    const parentId = queue.shift()!;
    const parentDepth = map.get(parentId)!;
    for (const child of saveNodes.filter((n) => n.parentId === parentId)) {
      map.set(child.id, parentDepth + 1);
      queue.push(child.id);
    }
  }
  return map;
}

function saveDataToFlow(data: MindMapSaveData) {
  const depthMap = buildDepthMap(data.nodes);

  const nodes: Node[] = data.nodes.map((n) => {
    const depth = depthMap.get(n.id) ?? 0;
    const isRoot = !n.parentId;
    return {
      id: n.id,
      type: 'mindNode',
      position: { x: 0, y: 0 },
      data: { label: n.label, depth, isRoot, color: n.color },
    };
  });

  const edges: Edge[] = data.nodes
    .filter((n) => n.parentId)
    .map((n) => {
      const parentDepth = depthMap.get(n.parentId!) ?? 0;
      const c = getDepthColor(parentDepth);
      return {
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: c.border, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: c.border, width: 14, height: 14 },
      };
    });

  return getLayoutedElements(nodes, edges);
}

function flowToSaveData(nodes: Node[], edges: Edge[]): MindMapSaveData {
  const parentMap = new Map<string, string>();
  edges.forEach((e) => parentMap.set(e.target, e.source));
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.data.label as string,
      parentId: parentMap.get(n.id) || null,
      color: n.data.color as string | undefined,
    })),
  };
}

// ─── Custom Mind Node ───

function MindNodeComponent({ id, data, selected }: NodeProps) {
  const depth = (data.depth as number) ?? 0;
  const isRoot = data.isRoot as boolean;
  const label = data.label as string;
  const c = data.color ? { bg: data.color as string, text: '#ffffff', border: data.color as string } : getDepthColor(depth);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();

  useEffect(() => { setText(label); }, [label]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = useCallback(() => {
    const trimmed = text.trim() || label;
    setText(trimmed);
    setEditing(false);
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n)));
  }, [text, label, id, setNodes]);

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      className={`
        relative flex items-center justify-center
        transition-all duration-150 cursor-pointer select-none
        ${isRoot ? 'px-6 py-2.5 rounded-2xl shadow-lg' : 'px-4 py-1.5 rounded-xl shadow-sm'}
        ${selected ? 'ring-2 ring-offset-2 ring-blue-500 shadow-md' : 'hover:shadow-md'}
      `}
      style={{
        background: c.bg,
        color: c.text,
        border: `2px solid ${c.border}`,
        fontSize: isRoot ? 16 : 13,
        fontWeight: isRoot ? 700 : 500,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minWidth: isRoot ? 140 : 80,
      }}
    >
      {/* Left handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: c.border, width: 6, height: 6, border: 'none' }}
      />

      {editing ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setText(label); setEditing(false); }
          }}
          className="bg-transparent outline-none text-center w-full border-b border-current"
          style={{ color: c.text, fontSize: isRoot ? 16 : 13, fontWeight: isRoot ? 700 : 500 }}
        />
      ) : (
        <span className="truncate">{label}</span>
      )}

      {/* Right handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: c.border, width: 6, height: 6, border: 'none' }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { mindNode: MindNodeComponent };

// ─── Inner editor (needs ReactFlowProvider wrapper) ───

function MindMapInner({ initialData, onChange, onReady }: {
  initialData?: MindMapSaveData | null;
  onChange?: () => void;
  onReady: (handle: MindMapEditorHandle) => void;
}) {
  const data = initialData || DEFAULT_DATA;
  const initial = useMemo(() => saveDataToFlow(data), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  // Expose imperative handle via callback
  useEffect(() => {
    onReady({
      getData: () => flowToSaveData(nodes, edges),
    });
  }, [nodes, edges, onReady]);

  // Notify parent of changes
  const prevNodesRef = useRef(nodes);
  const prevEdgesRef = useRef(edges);
  useEffect(() => {
    if (nodes !== prevNodesRef.current || edges !== prevEdgesRef.current) {
      prevNodesRef.current = nodes;
      prevEdgesRef.current = edges;
      onChange?.();
    }
  }, [nodes, edges, onChange]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: false }, eds));
  }, [setEdges]);

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedNode(sel.length === 1 ? sel[0].id : null);
  }, []);

  // Re-layout helper
  const reLayout = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    const { nodes: ln, edges: le } = getLayoutedElements(newNodes, newEdges);
    setNodes(ln);
    setEdges(le);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [setNodes, setEdges, fitView]);

  // Add child to selected node
  const addChild = useCallback(() => {
    const parentId = selectedNode;
    if (!parentId) return;
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) return;
    const parentDepth = (parentNode.data.depth as number) ?? 0;
    const childDepth = parentDepth + 1;
    const c = getDepthColor(childDepth);
    const newId = `n_${Date.now()}`;

    const newNode: Node = {
      id: newId,
      type: 'mindNode',
      position: { x: 0, y: 0 },
      data: { label: 'New Topic', depth: childDepth, isRoot: false },
    };
    const newEdge: Edge = {
      id: `e-${parentId}-${newId}`,
      source: parentId,
      target: newId,
      type: 'smoothstep',
      style: { stroke: c.border, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: c.border, width: 14, height: 14 },
    };

    reLayout([...nodes, newNode], [...edges, newEdge]);
  }, [selectedNode, nodes, edges, reLayout]);

  // Add sibling to selected node
  const addSibling = useCallback(() => {
    if (!selectedNode) return;
    const parentEdge = edges.find((e) => e.target === selectedNode);
    if (!parentEdge) return; // root has no parent
    const parentId = parentEdge.source;
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) return;
    const siblingDepth = ((parentNode.data.depth as number) ?? 0) + 1;
    const c = getDepthColor(siblingDepth);
    const newId = `n_${Date.now()}`;

    const newNode: Node = {
      id: newId,
      type: 'mindNode',
      position: { x: 0, y: 0 },
      data: { label: 'New Topic', depth: siblingDepth, isRoot: false },
    };
    const newEdge: Edge = {
      id: `e-${parentId}-${newId}`,
      source: parentId,
      target: newId,
      type: 'smoothstep',
      style: { stroke: c.border, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: c.border, width: 14, height: 14 },
    };

    reLayout([...nodes, newNode], [...edges, newEdge]);
  }, [selectedNode, nodes, edges, reLayout]);

  // Delete selected node (and descendants)
  const deleteSelected = useCallback(() => {
    if (!selectedNode) return;
    const selNode = nodes.find((n) => n.id === selectedNode);
    if (!selNode || selNode.data.isRoot) return;

    // Find all descendants
    const toRemove = new Set<string>();
    const queue = [selectedNode];
    while (queue.length) {
      const cur = queue.shift()!;
      toRemove.add(cur);
      edges.filter((e) => e.source === cur).forEach((e) => queue.push(e.target));
    }

    const newNodes = nodes.filter((n) => !toRemove.has(n.id));
    const newEdges = edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target));
    setSelectedNode(null);
    reLayout(newNodes, newEdges);
  }, [selectedNode, nodes, edges, reLayout]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Tab') { e.preventDefault(); addChild(); }
      if (e.key === 'Enter') { e.preventDefault(); addSibling(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addChild, addSibling, deleteSelected]);

  // Fit view on mount
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onSelectionChange={onSelectionChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={3}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
      className="bg-gray-50 dark:bg-gray-950"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
      <Controls
        position="bottom-right"
        showInteractive={false}
        className="!bg-white/90 dark:!bg-gray-800/90 !border-gray-200 dark:!border-gray-700 !rounded-xl !shadow-lg"
      />
      <MiniMap
        position="bottom-right"
        style={{ bottom: 100 }}
        maskColor="rgba(0,0,0,0.08)"
        nodeStrokeColor="#94a3b8"
        nodeColor={(n) => {
          const depth = (n.data?.depth as number) ?? 0;
          return getDepthColor(depth).bg;
        }}
        className="!rounded-xl !border-gray-200 dark:!border-gray-700 !shadow-lg"
      />

      {/* Floating keyboard hints */}
      <Panel position="bottom-left" className="!mb-2">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
            <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Tab</kbd> Add child</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Enter</kbd> Add sibling</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Dbl-click</kbd> Edit</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">Del</kbd> Delete</span>
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}

// ─── Outer wrapper with Provider ───

const MindMapEditor = forwardRef<MindMapEditorHandle, MindMapEditorProps>(
  ({ initialData, onChange }, ref) => {
    const handleRef = useRef<MindMapEditorHandle | null>(null);

    useImperativeHandle(ref, () => ({
      getData: () => handleRef.current?.getData() ?? { nodes: [] },
    }));

    const onReady = useCallback((handle: MindMapEditorHandle) => {
      handleRef.current = handle;
    }, []);

    return (
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlowProvider>
          <MindMapInner initialData={initialData} onChange={onChange} onReady={onReady} />
        </ReactFlowProvider>
      </div>
    );
  }
);

MindMapEditor.displayName = 'MindMapEditor';
export default MindMapEditor;