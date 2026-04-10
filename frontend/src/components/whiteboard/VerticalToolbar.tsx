'use client';

import { useState, useEffect, MutableRefObject } from 'react';
import {
  MousePointer2,
  Hand,
  Pen,
  Eraser,
  Type,
  Square,
  Image,
  Circle,
  Diamond,
  Minus,
  ArrowRight,
  LayoutTemplate,
} from 'lucide-react';

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * VerticalToolbar — Professional left-side tool palette for Excalidraw
 *
 * Replaces the default horizontal bottom toolbar with a sleek vertical
 * toolbar on the left, using Lucide icons with smooth hover animations.
 * ──────────────────────────────────────────────────────────────────────────── */

/* ── Template picker callback: set by parent to open the template modal ── */
let _onOpenTemplatePicker: (() => void) | null = null;
export function setOnOpenTemplatePicker(fn: (() => void) | null) { _onOpenTemplatePicker = fn; }

interface ToolDef {
  id: string;
  excalidrawTool: string;
  label: string;
  icon: React.ReactNode;
  kbd?: string;
}

const ICON_SIZE = 18;

const PRIMARY_TOOLS: ToolDef[] = [
  { id: 'selection', excalidrawTool: 'selection', label: 'Select', icon: <MousePointer2 size={ICON_SIZE} />, kbd: 'V' },
  { id: 'hand', excalidrawTool: 'hand', label: 'Hand', icon: <Hand size={ICON_SIZE} />, kbd: 'H' },
];

const DRAWING_TOOLS: ToolDef[] = [
  { id: 'freedraw', excalidrawTool: 'freedraw', label: 'Pencil', icon: <Pen size={ICON_SIZE} />, kbd: 'P' },
  { id: 'eraser', excalidrawTool: 'eraser', label: 'Eraser', icon: <Eraser size={ICON_SIZE} />, kbd: 'E' },
  { id: 'line', excalidrawTool: 'line', label: 'Line', icon: <Minus size={ICON_SIZE} />, kbd: 'L' },
  { id: 'arrow', excalidrawTool: 'arrow', label: 'Arrow', icon: <ArrowRight size={ICON_SIZE} />, kbd: 'A' },
];

const SHAPE_TOOLS: ToolDef[] = [
  { id: 'rectangle', excalidrawTool: 'rectangle', label: 'Rectangle', icon: <Square size={ICON_SIZE} />, kbd: 'R' },
  { id: 'ellipse', excalidrawTool: 'ellipse', label: 'Ellipse', icon: <Circle size={ICON_SIZE} /> },
  { id: 'diamond', excalidrawTool: 'diamond', label: 'Diamond', icon: <Diamond size={ICON_SIZE} /> },
  { id: 'text', excalidrawTool: 'text', label: 'Text', icon: <Type size={ICON_SIZE} />, kbd: 'T' },
  { id: 'image', excalidrawTool: 'image', label: 'Image', icon: <Image size={ICON_SIZE} /> },
];

interface VerticalToolbarProps {
  excalidrawAPI: MutableRefObject<ExcalidrawImperativeAPI | null>;
}

/* ── Standard tool button ── */
function ToolButton({ tool, activeTool, onSelect }: { tool: ToolDef; activeTool: string; onSelect: (t: string) => void }) {
  const isActive = activeTool === tool.excalidrawTool;

  return (
    <button
      onClick={() => onSelect(tool.excalidrawTool)}
      title={`${tool.label}${tool.kbd ? ` (${tool.kbd})` : ''}`}
      className={`
        wbt-tool-btn
        relative flex items-center justify-center
        w-9 h-9 rounded-lg
        transition-all duration-150 ease-out
        ${isActive
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-white/10 active:scale-95'
        }
      `}
    >
      {tool.icon}
      {isActive && (
        <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-blue-400 animate-pulse" />
      )}
    </button>
  );
}

function ToolGroup({ tools, activeTool, onSelect }: { tools: ToolDef[]; activeTool: string; onSelect: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {tools.map((t) => (
        <ToolButton key={t.id} tool={t} activeTool={activeTool} onSelect={onSelect} />
      ))}
    </div>
  );
}

function Divider() {
  return <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 my-1" />;
}

export default function VerticalToolbar({ excalidrawAPI }: VerticalToolbarProps) {
  const [activeTool, setActiveTool] = useState('selection');

  const handleToolSelect = (toolType: string) => {
    const api = excalidrawAPI.current;
    if (!api) return;
    api.setActiveTool({ type: toolType });
    setActiveTool(toolType);
  };

  // Poll the active tool from Excalidraw to stay in sync (e.g. keyboard shortcuts)
  useEffect(() => {
    const interval = setInterval(() => {
      const api = excalidrawAPI.current;
      if (!api) return;
      const appState = api.getAppState();
      if (appState.activeTool?.type && appState.activeTool.type !== activeTool) {
        setActiveTool(appState.activeTool.type);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [activeTool, excalidrawAPI]);

  return (
    <div
      className="
        wbt-vertical-toolbar
        absolute left-3 top-1/2 -translate-y-1/2 z-[300]
        flex flex-col items-center gap-0.5
        bg-white/90 dark:bg-gray-900/90
        backdrop-blur-xl
        border border-gray-200/80 dark:border-gray-700/80
        rounded-2xl
        py-2 px-1
        shadow-lg shadow-black/8
      "
    >
      <ToolGroup tools={PRIMARY_TOOLS} activeTool={activeTool} onSelect={handleToolSelect} />
      <Divider />
      <ToolGroup tools={DRAWING_TOOLS} activeTool={activeTool} onSelect={handleToolSelect} />
      <Divider />
      <ToolGroup tools={SHAPE_TOOLS} activeTool={activeTool} onSelect={handleToolSelect} />
      <Divider />
      {/* Templates */}
      <button
        onClick={() => _onOpenTemplatePicker?.()}
        title="Diagram Templates"
        className="
          wbt-tool-btn
          relative flex items-center justify-center
          w-9 h-9 rounded-lg
          transition-all duration-150 ease-out
          text-gray-500 hover:text-gray-800 hover:bg-gray-100
          dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-white/10
          active:scale-95
        "
      >
        <LayoutTemplate size={ICON_SIZE} />
      </button>
    </div>
  );
}
