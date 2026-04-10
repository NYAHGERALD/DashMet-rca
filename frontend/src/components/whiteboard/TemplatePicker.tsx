'use client';

import { MutableRefObject } from 'react';
import { applyFishboneTemplate } from './templates/fishboneTemplate';
import { X, Fish, LayoutTemplate } from 'lucide-react';

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

            {/* "More coming" placeholder */}
            <div className="
              flex flex-col items-center justify-center
              border-2 border-dashed border-gray-200 dark:border-gray-700
              rounded-xl
              min-h-[200px]
              text-gray-400 dark:text-gray-600
            ">
              <LayoutTemplate size={32} className="mb-2 opacity-40" />
              <span className="text-sm">More templates coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
