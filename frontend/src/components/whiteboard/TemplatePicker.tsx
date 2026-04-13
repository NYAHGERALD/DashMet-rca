'use client';

import { MutableRefObject } from 'react';
import { applyFishboneTemplate } from './templates/fishboneTemplate';
import { applyFlowchartTemplate } from './templates/flowchartTemplate';
import { applySwotTemplate } from './templates/swotTemplate';
import { applyMindMapTemplate } from './templates/mindMapTemplate';
import { X, Fish, GitBranch, Grid3X3, Network, LayoutTemplate } from 'lucide-react';

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * TemplatePicker — Modal overlay for inserting diagram templates
 *
 * Shows a gallery of professional diagram templates that users can
 * insert onto the current canvas. Each template creates shapes
 * programmatically using the Excalidraw API.
 * ──────────────────────────────────────────────────────────────────────────── */

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  excalidrawAPI: MutableRefObject<ExcalidrawImperativeAPI | null>;
}

interface TemplateDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: React.ReactNode;
  apply: (api: ExcalidrawImperativeAPI) => void;
}

/* ── Fishbone SVG Preview ─────────────────────────────────────────────────── */
function FishbonePreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Spine */}
      <line x1="20" y1="80" x2="220" y2="80" stroke="currentColor" strokeWidth="2.5" />
      <polygon points="220,80 212,75 212,85" fill="currentColor" />

      {/* Effect box */}
      <rect x="225" y="62" width="48" height="36" rx="4" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.5" />
      <text x="249" y="83" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="600">Effect</text>

      {/* Top ribs */}
      <line x1="55" y1="30" x2="85" y2="80" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="110" y1="30" x2="140" y2="80" stroke="#ef4444" strokeWidth="1.5" />
      <line x1="165" y1="30" x2="195" y2="80" stroke="#22c55e" strokeWidth="1.5" />

      {/* Bottom ribs */}
      <line x1="55" y1="130" x2="85" y2="80" stroke="#f97316" strokeWidth="1.5" />
      <line x1="110" y1="130" x2="140" y2="80" stroke="#8b5cf6" strokeWidth="1.5" />
      <line x1="165" y1="130" x2="195" y2="80" stroke="#eab308" strokeWidth="1.5" />

      {/* Top labels */}
      <rect x="28" y="14" width="50" height="18" rx="3" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
      <text x="53" y="27" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="500">Man</text>

      <rect x="83" y="14" width="55" height="18" rx="3" fill="#fee2e2" stroke="#ef4444" strokeWidth="1" />
      <text x="111" y="27" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="500">Machine</text>

      <rect x="140" y="14" width="52" height="18" rx="3" fill="#dcfce7" stroke="#22c55e" strokeWidth="1" />
      <text x="166" y="27" textAnchor="middle" fontSize="7" fill="#22c55e" fontWeight="500">Method</text>

      {/* Bottom labels */}
      <rect x="23" y="128" width="58" height="18" rx="3" fill="#ffedd5" stroke="#f97316" strokeWidth="1" />
      <text x="52" y="141" textAnchor="middle" fontSize="7" fill="#f97316" fontWeight="500">Material</text>

      <rect x="73" y="128" width="72" height="18" rx="3" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
      <text x="109" y="141" textAnchor="middle" fontSize="7" fill="#8b5cf6" fontWeight="500">Measurement</text>

      <rect x="150" y="128" width="62" height="18" rx="3" fill="#fef9c3" stroke="#eab308" strokeWidth="1" />
      <text x="181" y="141" textAnchor="middle" fontSize="7" fill="#eab308" fontWeight="500">Environment</text>

      {/* Sub-cause lines (top) */}
      <line x1="52" y1="42" x2="63" y2="55" stroke="#3b82f6" strokeWidth="0.8" />
      <line x1="62" y1="38" x2="73" y2="55" stroke="#3b82f6" strokeWidth="0.8" />
      <line x1="105" y1="42" x2="118" y2="55" stroke="#ef4444" strokeWidth="0.8" />
      <line x1="117" y1="38" x2="128" y2="55" stroke="#ef4444" strokeWidth="0.8" />
      <line x1="162" y1="42" x2="173" y2="55" stroke="#22c55e" strokeWidth="0.8" />
      <line x1="172" y1="38" x2="183" y2="55" stroke="#22c55e" strokeWidth="0.8" />

      {/* Sub-cause lines (bottom) */}
      <line x1="52" y1="118" x2="63" y2="105" stroke="#f97316" strokeWidth="0.8" />
      <line x1="62" y1="122" x2="73" y2="105" stroke="#f97316" strokeWidth="0.8" />
      <line x1="105" y1="118" x2="118" y2="105" stroke="#8b5cf6" strokeWidth="0.8" />
      <line x1="117" y1="122" x2="128" y2="105" stroke="#8b5cf6" strokeWidth="0.8" />
      <line x1="162" y1="118" x2="173" y2="105" stroke="#eab308" strokeWidth="0.8" />
      <line x1="172" y1="122" x2="183" y2="105" stroke="#eab308" strokeWidth="0.8" />
    </svg>
  );
}

/* ── Flowchart SVG Preview ─────────────────────────────────────────────────── */
function FlowchartPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Start oval */}
      <ellipse cx="140" cy="18" rx="35" ry="14" fill="#d3f9d8" stroke="#22c55e" strokeWidth="1.5" />
      <text x="140" y="22" textAnchor="middle" fontSize="8" fill="#22c55e" fontWeight="600">Start</text>

      {/* Arrow down */}
      <line x1="140" y1="32" x2="140" y2="46" stroke="currentColor" strokeWidth="1.2" />
      <polygon points="140,48 137,43 143,43" fill="currentColor" />

      {/* Process box */}
      <rect x="100" y="48" width="80" height="24" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
      <text x="140" y="63" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="500">Process Step</text>

      {/* Arrow down */}
      <line x1="140" y1="72" x2="140" y2="84" stroke="currentColor" strokeWidth="1.2" />
      <polygon points="140,86 137,81 143,81" fill="currentColor" />

      {/* Decision diamond */}
      <polygon points="140,86 175,103 140,120 105,103" fill="#ffe8cc" stroke="#f97316" strokeWidth="1.5" />
      <text x="140" y="107" textAnchor="middle" fontSize="7" fill="#f97316" fontWeight="600">Decision?</text>

      {/* Yes arrow down */}
      <line x1="140" y1="120" x2="140" y2="133" stroke="currentColor" strokeWidth="1.2" />
      <text x="147" y="130" fontSize="6" fill="#22c55e" fontWeight="600">Yes</text>

      {/* End oval */}
      <ellipse cx="140" cy="147" rx="30" ry="12" fill="#ffe3e3" stroke="#ef4444" strokeWidth="1.5" />
      <text x="140" y="150" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="600">End</text>

      {/* No arrow right */}
      <line x1="175" y1="103" x2="230" y2="103" stroke="currentColor" strokeWidth="1.2" />
      <text x="195" y="99" fontSize="6" fill="#ef4444" fontWeight="600">No</text>
      <rect x="230" y="91" width="40" height="24" rx="4" fill="#ffe3e3" stroke="#ef4444" strokeWidth="1" />
      <text x="250" y="106" textAnchor="middle" fontSize="6" fill="#ef4444" fontWeight="500">Alt Path</text>
    </svg>
  );
}

/* ── SWOT SVG Preview ─────────────────────────────────────────────────────── */
function SwotPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* S - top left */}
      <rect x="20" y="15" width="115" height="60" rx="5" fill="none" stroke="#22c55e" strokeWidth="1.5" />
      <rect x="20" y="15" width="115" height="18" rx="5" fill="#d3f9d8" />
      <text x="77" y="28" textAnchor="middle" fontSize="8" fill="#22c55e" fontWeight="600">Strengths</text>
      <text x="30" y="46" fontSize="6" fill="#555">• Advantage 1</text>
      <text x="30" y="56" fontSize="6" fill="#555">• Advantage 2</text>
      <text x="30" y="66" fontSize="6" fill="#555">• Advantage 3</text>

      {/* W - top right */}
      <rect x="145" y="15" width="115" height="60" rx="5" fill="none" stroke="#ef4444" strokeWidth="1.5" />
      <rect x="145" y="15" width="115" height="18" rx="5" fill="#ffe3e3" />
      <text x="202" y="28" textAnchor="middle" fontSize="8" fill="#ef4444" fontWeight="600">Weaknesses</text>
      <text x="155" y="46" fontSize="6" fill="#555">• Weakness 1</text>
      <text x="155" y="56" fontSize="6" fill="#555">• Weakness 2</text>
      <text x="155" y="66" fontSize="6" fill="#555">• Weakness 3</text>

      {/* O - bottom left */}
      <rect x="20" y="85" width="115" height="60" rx="5" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      <rect x="20" y="85" width="115" height="18" rx="5" fill="#dbeafe" />
      <text x="77" y="98" textAnchor="middle" fontSize="8" fill="#3b82f6" fontWeight="600">Opportunities</text>
      <text x="30" y="116" fontSize="6" fill="#555">• Opportunity 1</text>
      <text x="30" y="126" fontSize="6" fill="#555">• Opportunity 2</text>
      <text x="30" y="136" fontSize="6" fill="#555">• Opportunity 3</text>

      {/* T - bottom right */}
      <rect x="145" y="85" width="115" height="60" rx="5" fill="none" stroke="#f97316" strokeWidth="1.5" />
      <rect x="145" y="85" width="115" height="18" rx="5" fill="#ffe8cc" />
      <text x="202" y="98" textAnchor="middle" fontSize="8" fill="#f97316" fontWeight="600">Threats</text>
      <text x="155" y="116" fontSize="6" fill="#555">• Threat 1</text>
      <text x="155" y="126" fontSize="6" fill="#555">• Threat 2</text>
      <text x="155" y="136" fontSize="6" fill="#555">• Threat 3</text>
    </svg>
  );
}

/* ── Mind Map SVG Preview ─────────────────────────────────────────────────── */
function MindMapPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Central node */}
      <ellipse cx="140" cy="80" rx="40" ry="18" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
      <text x="140" y="84" textAnchor="middle" fontSize="8" fill="#3b82f6" fontWeight="600">Central Idea</text>

      {/* Topic A - top left */}
      <line x1="108" y1="68" x2="55" y2="35" stroke="#ef4444" strokeWidth="1.2" />
      <rect x="20" y="22" width="60" height="22" rx="4" fill="#ffe3e3" stroke="#ef4444" strokeWidth="1" />
      <text x="50" y="36" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="500">Topic A</text>

      {/* Topic B - top right */}
      <line x1="172" y1="68" x2="225" y2="35" stroke="#22c55e" strokeWidth="1.2" />
      <rect x="200" y="22" width="60" height="22" rx="4" fill="#d3f9d8" stroke="#22c55e" strokeWidth="1" />
      <text x="230" y="36" textAnchor="middle" fontSize="7" fill="#22c55e" fontWeight="500">Topic B</text>

      {/* Topic C - bottom left */}
      <line x1="108" y1="92" x2="55" y2="125" stroke="#f97316" strokeWidth="1.2" />
      <rect x="20" y="116" width="60" height="22" rx="4" fill="#ffe8cc" stroke="#f97316" strokeWidth="1" />
      <text x="50" y="130" textAnchor="middle" fontSize="7" fill="#f97316" fontWeight="500">Topic C</text>

      {/* Topic D - bottom right */}
      <line x1="172" y1="92" x2="225" y2="125" stroke="#8b5cf6" strokeWidth="1.2" />
      <rect x="200" y="116" width="60" height="22" rx="4" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
      <text x="230" y="130" textAnchor="middle" fontSize="7" fill="#8b5cf6" fontWeight="500">Topic D</text>

      {/* Topic E - left */}
      <line x1="100" y1="80" x2="30" y2="80" stroke="#0ea5e9" strokeWidth="1.2" />
      <rect x="2" y="70" width="30" height="20" rx="3" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="1" />
      <text x="17" y="83" textAnchor="middle" fontSize="6" fill="#0ea5e9" fontWeight="500">E</text>

      {/* Topic F - right */}
      <line x1="180" y1="80" x2="250" y2="80" stroke="#ef4444" strokeWidth="1.2" />
      <rect x="248" y="70" width="30" height="20" rx="3" fill="#ffe3e3" stroke="#ef4444" strokeWidth="1" />
      <text x="263" y="83" textAnchor="middle" fontSize="6" fill="#ef4444" fontWeight="500">F</text>
    </svg>
  );
}

/* ── Template Definitions ─────────────────────────────────────────────────── */
const TEMPLATES: TemplateDef[] = [
  {
    id: 'fishbone',
    name: 'Fishbone Diagram',
    description: '6M Ishikawa root cause analysis — Man, Machine, Method, Material, Measurement, Environment',
    icon: <Fish size={24} />,
    preview: <FishbonePreview />,
    apply: applyFishboneTemplate,
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Process flow with start/end, steps, decision diamond, and branching paths',
    icon: <GitBranch size={24} />,
    preview: <FlowchartPreview />,
    apply: applyFlowchartTemplate,
  },
  {
    id: 'swot',
    name: 'SWOT Analysis',
    description: 'Strategic planning grid — Strengths, Weaknesses, Opportunities, Threats',
    icon: <Grid3X3 size={24} />,
    preview: <SwotPreview />,
    apply: applySwotTemplate,
  },
  {
    id: 'mindmap',
    name: 'Mind Map',
    description: 'Radial brainstorming layout — central idea with branching topics and sub-topics',
    icon: <Network size={24} />,
    preview: <MindMapPreview />,
    apply: applyMindMapTemplate,
  },
];

/* ── Template Card ────────────────────────────────────────────────────────── */
function TemplateCard({ template, onSelect }: { template: TemplateDef; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="
        group relative flex flex-col
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        rounded-xl overflow-hidden
        hover:border-blue-400 dark:hover:border-blue-500
        hover:shadow-lg hover:shadow-blue-500/10
        transition-all duration-200
        text-left
      "
    >
      {/* Preview area */}
      <div className="
        relative w-full aspect-[16/10]
        bg-gray-50 dark:bg-gray-900/50
        p-4
        text-gray-400 dark:text-gray-500
        group-hover:text-gray-600 dark:group-hover:text-gray-300
        transition-colors
      ">
        {template.preview}
        {/* Hover overlay */}
        <div className="
          absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5
          flex items-center justify-center
          transition-all duration-200
        ">
          <span className="
            opacity-0 group-hover:opacity-100
            bg-blue-600 text-white
            px-4 py-2 rounded-lg
            text-sm font-medium
            shadow-lg shadow-blue-600/20
            transform scale-90 group-hover:scale-100
            transition-all duration-200
          ">
            Use Template
          </span>
        </div>
      </div>

      {/* Info area */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-600 dark:text-blue-400">
            {template.icon}
          </span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {template.name}
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          {template.description}
        </p>
      </div>
    </button>
  );
}

/* ── Main TemplatePicker Component ────────────────────────────────────────── */
export default function TemplatePicker({ open, onClose, excalidrawAPI }: TemplatePickerProps) {
  if (!open) return null;

  const handleSelect = (template: TemplateDef) => {
    const api = excalidrawAPI.current;
    if (!api) return;
    template.apply(api);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal */}
      <div className="
        relative
        w-full max-w-2xl max-h-[85vh]
        mx-4
        bg-white dark:bg-gray-900
        border border-gray-200 dark:border-gray-700
        rounded-2xl
        shadow-2xl shadow-black/20
        animate-in fade-in zoom-in-95 duration-200
        flex flex-col
        overflow-hidden
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <LayoutTemplate size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Diagram Templates
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Start with a professional template and customize it
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onSelect={() => handleSelect(t)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
