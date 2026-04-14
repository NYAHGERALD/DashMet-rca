'use client';

import { MutableRefObject, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { applyFishboneTemplate } from './templates/fishboneTemplate';
import { applyFlowchartTemplate } from './templates/flowchartTemplate';
import { applySwotTemplate } from './templates/swotTemplate';
import { applyMindMapTemplate } from './templates/mindMapTemplate';
import { applyProjectTimelineTemplate } from './templates/projectTimelineTemplate';
import { applyOrgChartTemplate } from './templates/orgChartTemplate';
import { applyKanbanTemplate } from './templates/kanbanTemplate';
import { applyRaciTemplate } from './templates/raciTemplate';
import { applyStakeholderMapTemplate } from './templates/stakeholderMapTemplate';
import { applyBusinessModelCanvasTemplate } from './templates/businessModelCanvasTemplate';
import { applyCustomerJourneyTemplate } from './templates/customerJourneyTemplate';
import { applyFiveWhysTemplate } from './templates/fiveWhysTemplate';
import { applyFaultTreeTemplate } from './templates/faultTreeTemplate';
import { applyBowTieTemplate } from './templates/bowTieTemplate';
import { applyParetoTemplate } from './templates/paretoTemplate';
import { applyCurrentRealityTreeTemplate } from './templates/currentRealityTreeTemplate';
import { applyAffinityDiagramTemplate } from './templates/affinityDiagramTemplate';
import { applyFishbone4STemplate } from './templates/fishbone4STemplate';
import { applyFishbone8PTemplate } from './templates/fishbone8PTemplate';
import { applyFishboneCEDACTemplate } from './templates/fishboneCEDACTemplate';
import { X, Fish, GitBranch, Grid3X3, Network, LayoutTemplate, CalendarRange, Users, Columns, Table2, Target, Briefcase, Map, HelpCircle, GitFork, ShieldAlert, BarChart3, Workflow, StickyNote, Building2, Megaphone, ClipboardList } from 'lucide-react';

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

/* ── Project Timeline SVG Preview ─────────────────────────────────────────── */
function TimelinePreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Timeline arrow */}
      <line x1="15" y1="30" x2="265" y2="30" stroke="currentColor" strokeWidth="2" />
      <polygon points="265,30 258,26 258,34" fill="currentColor" />
      {/* Phase 1 */}
      <rect x="20" y="42" width="55" height="14" rx="3" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
      <text x="47" y="52" textAnchor="middle" fontSize="6" fill="#3b82f6" fontWeight="600">Phase 1</text>
      <diamond />
      <rect x="25" y="62" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="25" y="76" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="25" y="90" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      {/* Phase 2 */}
      <rect x="82" y="42" width="55" height="14" rx="3" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
      <text x="109" y="52" textAnchor="middle" fontSize="6" fill="#8b5cf6" fontWeight="600">Phase 2</text>
      <rect x="87" y="62" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="87" y="76" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="87" y="90" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      {/* Phase 3 */}
      <rect x="144" y="42" width="55" height="14" rx="3" fill="#d1fae5" stroke="#10b981" strokeWidth="1" />
      <text x="171" y="52" textAnchor="middle" fontSize="6" fill="#10b981" fontWeight="600">Phase 3</text>
      <rect x="149" y="62" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="149" y="76" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="149" y="90" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      {/* Phase 4 */}
      <rect x="206" y="42" width="55" height="14" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      <text x="233" y="52" textAnchor="middle" fontSize="6" fill="#d97706" fontWeight="600">Phase 4</text>
      <rect x="211" y="62" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="211" y="76" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="211" y="90" width="45" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      {/* Milestones */}
      <polygon points="47,30 50,26 53,30 50,34" fill="#3b82f6" />
      <polygon points="109,30 112,26 115,30 112,34" fill="#8b5cf6" />
      <polygon points="171,30 174,26 177,30 174,34" fill="#10b981" />
      <polygon points="233,30 236,26 239,30 236,34" fill="#d97706" />
      {/* Legend */}
      <text x="140" y="118" textAnchor="middle" fontSize="5.5" fill="#94a3b8">● Completed  ○ Pending  ◇ Milestone</text>
    </svg>
  );
}

/* ── Org Chart SVG Preview ────────────────────────────────────────────────── */
function OrgChartPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* CEO */}
      <rect x="105" y="8" width="70" height="28" rx="4" fill="#e0e7ff" stroke="#1e3a5f" strokeWidth="1.5" />
      <rect x="106" y="9" width="68" height="4" rx="2" fill="#1e3a5f" />
      <text x="140" y="28" textAnchor="middle" fontSize="7" fill="#1e3a5f" fontWeight="600">CEO</text>
      {/* Lines to VPs */}
      <line x1="140" y1="36" x2="140" y2="48" stroke="#94a3b8" strokeWidth="1" />
      <line x1="50" y1="48" x2="230" y2="48" stroke="#94a3b8" strokeWidth="1" />
      <line x1="50" y1="48" x2="50" y2="55" stroke="#94a3b8" strokeWidth="1" />
      <line x1="140" y1="48" x2="140" y2="55" stroke="#94a3b8" strokeWidth="1" />
      <line x1="230" y1="48" x2="230" y2="55" stroke="#94a3b8" strokeWidth="1" />
      {/* VP Engineering */}
      <rect x="15" y="55" width="70" height="25" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
      <rect x="16" y="56" width="68" height="3" rx="1.5" fill="#3b82f6" />
      <text x="50" y="73" textAnchor="middle" fontSize="6" fill="#3b82f6" fontWeight="500">VP Engineering</text>
      {/* VP Product */}
      <rect x="105" y="55" width="70" height="25" rx="4" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
      <rect x="106" y="56" width="68" height="3" rx="1.5" fill="#8b5cf6" />
      <text x="140" y="73" textAnchor="middle" fontSize="6" fill="#8b5cf6" fontWeight="500">VP Product</text>
      {/* VP Ops */}
      <rect x="195" y="55" width="70" height="25" rx="4" fill="#d1fae5" stroke="#10b981" strokeWidth="1" />
      <rect x="196" y="56" width="68" height="3" rx="1.5" fill="#10b981" />
      <text x="230" y="73" textAnchor="middle" fontSize="6" fill="#10b981" fontWeight="500">VP Operations</text>
      {/* Director lines */}
      <line x1="50" y1="80" x2="50" y2="88" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2" />
      <line x1="25" y1="88" x2="75" y2="88" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2" />
      <line x1="25" y1="88" x2="25" y2="95" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2" />
      <line x1="75" y1="88" x2="75" y2="95" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2" />
      {/* Directors */}
      <rect x="5" y="95" width="42" height="18" rx="3" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="0.8" />
      <text x="26" y="107" textAnchor="middle" fontSize="5" fill="#0ea5e9">Frontend</text>
      <rect x="55" y="95" width="42" height="18" rx="3" fill="#ccfbf1" stroke="#0d9488" strokeWidth="0.8" />
      <text x="76" y="107" textAnchor="middle" fontSize="5" fill="#0d9488">Backend</text>
      <rect x="115" y="95" width="42" height="18" rx="3" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="0.8" />
      <text x="136" y="107" textAnchor="middle" fontSize="5" fill="#4f46e5">Design</text>
      <rect x="165" y="95" width="42" height="18" rx="3" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="0.8" />
      <text x="186" y="107" textAnchor="middle" fontSize="5" fill="#8b5cf6">Strategy</text>
      <rect x="215" y="95" width="42" height="18" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" />
      <text x="236" y="107" textAnchor="middle" fontSize="5" fill="#d97706">Supply</text>
    </svg>
  );
}

/* ── Kanban SVG Preview ───────────────────────────────────────────────────── */
function KanbanPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Column 1: Backlog */}
      <rect x="8" y="8" width="62" height="140" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <text x="39" y="22" textAnchor="middle" fontSize="7" fill="#475569" fontWeight="600">Backlog</text>
      <line x1="14" y1="27" x2="64" y2="27" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="13" y="32" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="17" y="35" width="18" height="6" rx="2" fill="#dbeafe" /><text x="26" y="40" textAnchor="middle" fontSize="4" fill="#3b82f6">Low</text>
      <rect x="13" y="59" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="17" y="62" width="18" height="6" rx="2" fill="#fef3c7" /><text x="26" y="67" textAnchor="middle" fontSize="4" fill="#d97706">Med</text>
      <rect x="13" y="86" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="17" y="89" width="18" height="6" rx="2" fill="#fee2e2" /><text x="26" y="94" textAnchor="middle" fontSize="4" fill="#dc2626">High</text>
      {/* Column 2: To Do */}
      <rect x="76" y="8" width="62" height="140" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <text x="107" y="22" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="600">To Do</text>
      <line x1="82" y1="27" x2="132" y2="27" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="81" y="32" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="81" y="59" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      {/* Column 3: In Progress */}
      <rect x="144" y="8" width="62" height="140" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <text x="175" y="22" textAnchor="middle" fontSize="6.5" fill="#d97706" fontWeight="600">In Progress</text>
      <line x1="150" y1="27" x2="200" y2="27" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="149" y="32" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="149" y="59" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      {/* Column 4: Done */}
      <rect x="212" y="8" width="62" height="140" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <text x="243" y="22" textAnchor="middle" fontSize="7" fill="#10b981" fontWeight="600">Done</text>
      <line x1="218" y1="27" x2="268" y2="27" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="217" y="32" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="221" y="35" width="18" height="6" rx="2" fill="#d1fae5" /><text x="230" y="40" textAnchor="middle" fontSize="4" fill="#10b981">Done</text>
      <rect x="217" y="59" width="52" height="22" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8" />
      <rect x="221" y="62" width="18" height="6" rx="2" fill="#d1fae5" /><text x="230" y="67" textAnchor="middle" fontSize="4" fill="#10b981">Done</text>
    </svg>
  );
}

/* ── RACI Matrix SVG Preview ──────────────────────────────────────────────── */
function RaciPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Header bar */}
      <rect x="10" y="10" width="260" height="22" rx="4" fill="#1e293b" />
      <text x="55" y="24" textAnchor="middle" fontSize="6" fill="#e2e8f0" fontWeight="500">Task</text>
      <text x="115" y="24" textAnchor="middle" fontSize="5.5" fill="#e2e8f0">PM</text>
      <text x="150" y="24" textAnchor="middle" fontSize="5.5" fill="#e2e8f0">Lead</text>
      <text x="185" y="24" textAnchor="middle" fontSize="5.5" fill="#e2e8f0">Dev</text>
      <text x="220" y="24" textAnchor="middle" fontSize="5.5" fill="#e2e8f0">QA</text>
      <text x="250" y="24" textAnchor="middle" fontSize="5.5" fill="#e2e8f0">UX</text>
      {/* Row 1 */}
      <rect x="10" y="34" width="260" height="20" rx="0" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="55" y="47" textAnchor="middle" fontSize="5.5" fill="#475569">Requirements</text>
      <circle cx="115" cy="44" r="7" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" /><text x="115" y="47" textAnchor="middle" fontSize="7" fill="#dc2626" fontWeight="600">A</text>
      <circle cx="150" cy="44" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="150" y="47" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      <circle cx="185" cy="44" r="7" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" /><text x="185" y="47" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">I</text>
      <circle cx="220" cy="44" r="7" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" /><text x="220" y="47" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">I</text>
      <circle cx="250" cy="44" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="250" y="47" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      {/* Row 2 */}
      <rect x="10" y="56" width="260" height="20" rx="0" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="55" y="69" textAnchor="middle" fontSize="5.5" fill="#475569">Development</text>
      <circle cx="115" cy="66" r="7" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" /><text x="115" y="69" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">I</text>
      <circle cx="150" cy="66" r="7" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" /><text x="150" y="69" textAnchor="middle" fontSize="7" fill="#dc2626" fontWeight="600">A</text>
      <circle cx="185" cy="66" r="7" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" /><text x="185" y="69" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="600">R</text>
      <circle cx="220" cy="66" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="220" y="69" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      <circle cx="250" cy="66" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="250" y="69" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      {/* Row 3 */}
      <rect x="10" y="78" width="260" height="20" rx="0" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="55" y="91" textAnchor="middle" fontSize="5.5" fill="#475569">Testing</text>
      <circle cx="115" cy="88" r="7" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" /><text x="115" y="91" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">I</text>
      <circle cx="150" cy="88" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="150" y="91" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      <circle cx="185" cy="88" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="185" y="91" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      <circle cx="220" cy="88" r="7" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" /><text x="220" y="91" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="600">R</text>
      <circle cx="250" cy="88" r="7" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" /><text x="250" y="91" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">I</text>
      {/* Row 4 */}
      <rect x="10" y="100" width="260" height="20" rx="0" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="55" y="113" textAnchor="middle" fontSize="5.5" fill="#475569">Deployment</text>
      <circle cx="115" cy="110" r="7" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" /><text x="115" y="113" textAnchor="middle" fontSize="7" fill="#dc2626" fontWeight="600">A</text>
      <circle cx="150" cy="110" r="7" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" /><text x="150" y="113" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="600">R</text>
      <circle cx="185" cy="110" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="185" y="113" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      <circle cx="220" cy="110" r="7" fill="#fef3c7" stroke="#d97706" strokeWidth="1" /><text x="220" y="113" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">C</text>
      <circle cx="250" cy="110" r="7" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" /><text x="250" y="113" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">I</text>
      {/* Legend */}
      <circle cx="55" cy="136" r="5" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" /><text x="55" y="139" textAnchor="middle" fontSize="5.5" fill="#3b82f6" fontWeight="600">R</text>
      <text x="75" y="139" fontSize="5" fill="#94a3b8">Responsible</text>
      <circle cx="120" cy="136" r="5" fill="#fee2e2" stroke="#dc2626" strokeWidth="0.8" /><text x="120" y="139" textAnchor="middle" fontSize="5.5" fill="#dc2626" fontWeight="600">A</text>
      <text x="140" y="139" fontSize="5" fill="#94a3b8">Accountable</text>
      <circle cx="185" cy="136" r="5" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" /><text x="185" y="139" textAnchor="middle" fontSize="5.5" fill="#d97706" fontWeight="600">C</text>
      <text x="205" y="139" fontSize="5" fill="#94a3b8">Consulted</text>
      <circle cx="240" cy="136" r="5" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.8" /><text x="240" y="139" textAnchor="middle" fontSize="5.5" fill="#94a3b8" fontWeight="600">I</text>
      <text x="258" y="139" fontSize="5" fill="#94a3b8">Informed</text>
    </svg>
  );
}

/* ── Stakeholder Map SVG Preview ──────────────────────────────────────────── */
function StakeholderPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Quadrant backgrounds */}
      <rect x="40" y="10" width="110" height="65" rx="0" fill="#fef3c7" opacity="0.4" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="150" y="10" width="110" height="65" rx="0" fill="#fee2e2" opacity="0.4" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="40" y="75" width="110" height="65" rx="0" fill="#f1f5f9" opacity="0.5" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="150" y="75" width="110" height="65" rx="0" fill="#dbeafe" opacity="0.4" stroke="#e2e8f0" strokeWidth="0.5" />
      {/* Axes */}
      <line x1="40" y1="140" x2="40" y2="8" stroke="#475569" strokeWidth="1.5" />
      <polygon points="40,8 37,14 43,14" fill="#475569" />
      <line x1="40" y1="140" x2="262" y2="140" stroke="#475569" strokeWidth="1.5" />
      <polygon points="262,140 256,137 256,143" fill="#475569" />
      {/* Axis labels */}
      <text x="15" y="78" fontSize="6" fill="#475569" fontWeight="600" transform="rotate(-90 15 78)">POWER</text>
      <text x="150" y="154" textAnchor="middle" fontSize="6" fill="#475569" fontWeight="600">INTEREST</text>
      {/* Quadrant labels */}
      <text x="50" y="22" fontSize="6" fill="#d97706" fontWeight="600">Keep Satisfied</text>
      <text x="160" y="22" fontSize="6" fill="#dc2626" fontWeight="600">Manage Closely</text>
      <text x="50" y="87" fontSize="6" fill="#475569" fontWeight="600">Monitor</text>
      <text x="160" y="87" fontSize="6" fill="#3b82f6" fontWeight="600">Keep Informed</text>
      {/* Stakeholder bubbles */}
      <rect x="55" y="32" width="55" height="20" rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      <text x="82" y="45" textAnchor="middle" fontSize="5.5" fill="#d97706">Board</text>
      <rect x="165" y="30" width="55" height="20" rx="4" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" />
      <text x="192" y="43" textAnchor="middle" fontSize="5.5" fill="#dc2626">Sponsor</text>
      <rect x="200" y="52" width="50" height="20" rx="4" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" />
      <text x="225" y="65" textAnchor="middle" fontSize="5.5" fill="#dc2626">Customer</text>
      <rect x="60" y="100" width="50" height="20" rx="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
      <text x="85" y="113" textAnchor="middle" fontSize="5.5" fill="#94a3b8">Staff</text>
      <rect x="170" y="98" width="50" height="20" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
      <text x="195" y="111" textAnchor="middle" fontSize="5.5" fill="#3b82f6">Dev Team</text>
    </svg>
  );
}

/* ── Business Model Canvas SVG Preview ────────────────────────────────────── */
function BMCPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Outer border */}
      <rect x="5" y="5" width="270" height="150" rx="4" stroke="#1e3a5f" strokeWidth="1.5" fill="none" />
      {/* Top row - 5 columns */}
      <rect x="5" y="5" width="54" height="105" fill="#ede9fe" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="32" y="18" textAnchor="middle" fontSize="5.5" fill="#7c3aed" fontWeight="600">Key</text>
      <text x="32" y="25" textAnchor="middle" fontSize="5.5" fill="#7c3aed" fontWeight="600">Partners</text>
      <text x="32" y="40" fontSize="4.5" fill="#666">• Alliances</text>
      <text x="32" y="48" fontSize="4.5" fill="#666">• Suppliers</text>
      {/* Col 2 split */}
      <rect x="59" y="5" width="54" height="52" fill="#dbeafe" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="86" y="18" textAnchor="middle" fontSize="5.5" fill="#3b82f6" fontWeight="600">Key</text>
      <text x="86" y="25" textAnchor="middle" fontSize="5.5" fill="#3b82f6" fontWeight="600">Activities</text>
      <rect x="59" y="57" width="54" height="53" fill="#e0f2fe" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="86" y="68" textAnchor="middle" fontSize="5.5" fill="#0ea5e9" fontWeight="600">Key</text>
      <text x="86" y="75" textAnchor="middle" fontSize="5.5" fill="#0ea5e9" fontWeight="600">Resources</text>
      {/* Col 3 center */}
      <rect x="113" y="5" width="54" height="105" fill="#fee2e2" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="140" y="18" textAnchor="middle" fontSize="5.5" fill="#dc2626" fontWeight="600">Value</text>
      <text x="140" y="25" textAnchor="middle" fontSize="5.5" fill="#dc2626" fontWeight="600">Propositions</text>
      <text x="140" y="45" textAnchor="middle" fontSize="13" fill="#dc2626">💎</text>
      {/* Col 4 split */}
      <rect x="167" y="5" width="54" height="52" fill="#fce7f3" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="194" y="18" textAnchor="middle" fontSize="5.5" fill="#db2777" fontWeight="600">Customer</text>
      <text x="194" y="25" textAnchor="middle" fontSize="5.5" fill="#db2777" fontWeight="600">Relations</text>
      <rect x="167" y="57" width="54" height="53" fill="#ffedd5" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="194" y="70" textAnchor="middle" fontSize="5.5" fill="#ea580c" fontWeight="600">Channels</text>
      {/* Col 5 */}
      <rect x="221" y="5" width="54" height="105" fill="#d1fae5" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="248" y="18" textAnchor="middle" fontSize="5.5" fill="#059669" fontWeight="600">Customer</text>
      <text x="248" y="25" textAnchor="middle" fontSize="5.5" fill="#059669" fontWeight="600">Segments</text>
      <text x="248" y="40" fontSize="4.5" fill="#666">• Mass</text>
      <text x="248" y="48" fontSize="4.5" fill="#666">• Niche</text>
      {/* Bottom row - 2 halves */}
      <rect x="5" y="110" width="135" height="45" fill="#fef3c7" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="72" y="125" textAnchor="middle" fontSize="6" fill="#d97706" fontWeight="600">💰 Cost Structure</text>
      <text x="72" y="138" textAnchor="middle" fontSize="4.5" fill="#666">Fixed & variable costs</text>
      <rect x="140" y="110" width="135" height="45" fill="#d1fae5" opacity="0.3" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="207" y="125" textAnchor="middle" fontSize="6" fill="#059669" fontWeight="600">📈 Revenue Streams</text>
      <text x="207" y="138" textAnchor="middle" fontSize="4.5" fill="#666">Sales, subscriptions, fees</text>
    </svg>
  );
}

/* ── Customer Journey SVG Preview ─────────────────────────────────────────── */
function JourneyPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Stage headers */}
      <rect x="8" y="8" width="50" height="22" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
      <text x="33" y="15" textAnchor="middle" fontSize="5" fill="#3b82f6">💡</text>
      <text x="33" y="24" textAnchor="middle" fontSize="5.5" fill="#3b82f6" fontWeight="600">Aware</text>
      <polygon points="60,19 64,16 64,22" fill="#94a3b8" />
      <rect x="66" y="8" width="50" height="22" rx="4" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
      <text x="91" y="15" textAnchor="middle" fontSize="5" fill="#8b5cf6">🔍</text>
      <text x="91" y="24" textAnchor="middle" fontSize="5.5" fill="#8b5cf6" fontWeight="600">Consider</text>
      <polygon points="118,19 122,16 122,22" fill="#94a3b8" />
      <rect x="124" y="8" width="50" height="22" rx="4" fill="#d1fae5" stroke="#10b981" strokeWidth="1" />
      <text x="149" y="15" textAnchor="middle" fontSize="5" fill="#10b981">🛒</text>
      <text x="149" y="24" textAnchor="middle" fontSize="5.5" fill="#10b981" fontWeight="600">Purchase</text>
      <polygon points="176,19 180,16 180,22" fill="#94a3b8" />
      <rect x="182" y="8" width="50" height="22" rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      <text x="207" y="15" textAnchor="middle" fontSize="5" fill="#d97706">🚀</text>
      <text x="207" y="24" textAnchor="middle" fontSize="5.5" fill="#d97706" fontWeight="600">Onboard</text>
      <polygon points="234,19 238,16 238,22" fill="#94a3b8" />
      <rect x="240" y="8" width="35" height="22" rx="4" fill="#fce7f3" stroke="#db2777" strokeWidth="1" />
      <text x="257" y="15" textAnchor="middle" fontSize="5" fill="#db2777">❤️</text>
      <text x="257" y="24" textAnchor="middle" fontSize="5.5" fill="#db2777" fontWeight="600">Retain</text>
      {/* Emotion curve */}
      <path d="M 33,75 Q 55,60 91,70 Q 120,80 149,55 Q 180,40 207,50 Q 235,55 257,60" stroke="#d97706" strokeWidth="1.5" strokeDasharray="3" fill="none" />
      <circle cx="33" cy="75" r="3" fill="#d97706" />
      <circle cx="91" cy="70" r="3" fill="#d97706" />
      <circle cx="149" cy="55" r="3" fill="#d97706" />
      <circle cx="207" cy="50" r="3" fill="#d97706" />
      <circle cx="257" cy="60" r="3" fill="#d97706" />
      <text x="33" y="70" textAnchor="middle" fontSize="7">🤔</text>
      <text x="91" y="64" textAnchor="middle" fontSize="7">😊</text>
      <text x="149" y="48" textAnchor="middle" fontSize="7">😅</text>
      <text x="207" y="44" textAnchor="middle" fontSize="7">🎉</text>
      <text x="257" y="54" textAnchor="middle" fontSize="7">😌</text>
      {/* Row labels */}
      <text x="6" y="100" fontSize="5" fill="#0ea5e9" fontWeight="500">Touchpoints</text>
      <text x="6" y="118" fontSize="5" fill="#dc2626" fontWeight="500">Pain Points</text>
      <text x="6" y="136" fontSize="5" fill="#059669" fontWeight="500">Opportunities</text>
      {/* Grid cells placeholder */}
      <rect x="55" y="92" width="220" height="14" rx="2" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="55" y="110" width="220" height="14" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="55" y="128" width="220" height="14" rx="2" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
    </svg>
  );
}

/* ── 5 Whys SVG Preview ───────────────────────────────────────────────────── */
function FiveWhysPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Problem box */}
      <rect x="70" y="6" width="140" height="24" rx="4" fill="#e0e7ff" stroke="#1e3a5f" strokeWidth="1.5" />
      <text x="140" y="21" textAnchor="middle" fontSize="7" fill="#1e3a5f" fontWeight="600">Problem Statement</text>
      {/* Why 1 */}
      <line x1="140" y1="30" x2="140" y2="36" stroke="#94a3b8" strokeWidth="1" />
      <polygon points="140,38 137,34 143,34" fill="#94a3b8" />
      <circle cx="60" cy="48" r="8" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" /><text x="60" y="51" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="600">1</text>
      <rect x="72" y="38" width="140" height="20" rx="3" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" />
      <text x="142" y="51" textAnchor="middle" fontSize="6" fill="#3b82f6">Why? → Cause 1</text>
      {/* Why 2 */}
      <line x1="140" y1="58" x2="140" y2="64" stroke="#94a3b8" strokeWidth="1" />
      <polygon points="140,66 137,62 143,62" fill="#94a3b8" />
      <circle cx="60" cy="76" r="8" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.8" /><text x="60" y="79" textAnchor="middle" fontSize="7" fill="#e8590c" fontWeight="600">2</text>
      <rect x="72" y="66" width="140" height="20" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.8" />
      <text x="142" y="79" textAnchor="middle" fontSize="6" fill="#e8590c">Why? → Cause 2</text>
      {/* Why 3 */}
      <line x1="140" y1="86" x2="140" y2="92" stroke="#94a3b8" strokeWidth="1" />
      <polygon points="140,94 137,90 143,90" fill="#94a3b8" />
      <circle cx="60" cy="104" r="8" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" /><text x="60" y="107" textAnchor="middle" fontSize="7" fill="#d97706" fontWeight="600">3</text>
      <rect x="72" y="94" width="140" height="20" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" />
      <text x="142" y="107" textAnchor="middle" fontSize="6" fill="#d97706">Why? → Cause 3</text>
      {/* Why 4-5 compressed */}
      <line x1="140" y1="114" x2="140" y2="118" stroke="#94a3b8" strokeWidth="1" />
      <text x="140" y="124" textAnchor="middle" fontSize="6" fill="#94a3b8">⋮</text>
      {/* Root cause */}
      <rect x="70" y="130" width="140" height="24" rx="4" fill="#d1fae5" stroke="#2f9e44" strokeWidth="1.5" />
      <text x="140" y="145" textAnchor="middle" fontSize="7" fill="#2f9e44" fontWeight="600">✅ Root Cause</text>
    </svg>
  );
}

/* ── Fault Tree SVG Preview ───────────────────────────────────────────────── */
function FaultTreePreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Top event */}
      <rect x="95" y="6" width="90" height="26" rx="4" fill="#fee2e2" stroke="#e03131" strokeWidth="1.2" />
      <text x="140" y="22" textAnchor="middle" fontSize="6.5" fill="#e03131" fontWeight="600">TOP EVENT</text>
      {/* OR gate */}
      <line x1="140" y1="32" x2="140" y2="42" stroke="#94a3b8" strokeWidth="1" />
      <ellipse cx="140" cy="51" rx="14" ry="10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
      <text x="140" y="54" textAnchor="middle" fontSize="6" fill="#3b82f6" fontWeight="600">OR</text>
      {/* Branches */}
      <line x1="140" y1="61" x2="70" y2="75" stroke="#94a3b8" strokeWidth="1" />
      <line x1="140" y1="61" x2="210" y2="75" stroke="#94a3b8" strokeWidth="1" />
      {/* Intermediate A */}
      <rect x="25" y="75" width="90" height="22" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.8" />
      <text x="70" y="89" textAnchor="middle" fontSize="6" fill="#e8590c">Intermediate A</text>
      {/* Intermediate B */}
      <rect x="165" y="75" width="90" height="22" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" />
      <text x="210" y="89" textAnchor="middle" fontSize="6" fill="#d97706">Intermediate B</text>
      {/* AND gate left */}
      <line x1="70" y1="97" x2="70" y2="105" stroke="#94a3b8" strokeWidth="0.8" />
      <rect x="58" y="105" width="24" height="16" rx="3" fill="#ede9fe" stroke="#7048e8" strokeWidth="0.8" />
      <text x="70" y="116" textAnchor="middle" fontSize="5.5" fill="#7048e8" fontWeight="600">AND</text>
      {/* Basic events */}
      <line x1="58" y1="121" x2="40" y2="130" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="82" y1="121" x2="100" y2="130" stroke="#94a3b8" strokeWidth="0.8" />
      <circle cx="40" cy="140" r="10" fill="#d1fae5" stroke="#2f9e44" strokeWidth="0.8" />
      <text x="40" y="143" textAnchor="middle" fontSize="5" fill="#2f9e44">BE1</text>
      <circle cx="100" cy="140" r="10" fill="#d1fae5" stroke="#2f9e44" strokeWidth="0.8" />
      <text x="100" y="143" textAnchor="middle" fontSize="5" fill="#2f9e44">BE2</text>
      {/* OR gate right */}
      <line x1="210" y1="97" x2="210" y2="105" stroke="#94a3b8" strokeWidth="0.8" />
      <ellipse cx="210" cy="113" rx="12" ry="8" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" />
      <text x="210" y="116" textAnchor="middle" fontSize="5.5" fill="#3b82f6" fontWeight="600">OR</text>
      <line x1="198" y1="121" x2="180" y2="130" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="222" y1="121" x2="240" y2="130" stroke="#94a3b8" strokeWidth="0.8" />
      <circle cx="180" cy="140" r="10" fill="#dbeafe" stroke="#1971c2" strokeWidth="0.8" />
      <text x="180" y="143" textAnchor="middle" fontSize="5" fill="#1971c2">BE3</text>
      <circle cx="240" cy="140" r="10" fill="#dbeafe" stroke="#1971c2" strokeWidth="0.8" />
      <text x="240" y="143" textAnchor="middle" fontSize="5" fill="#1971c2">BE4</text>
    </svg>
  );
}

/* ── Bow-Tie SVG Preview ──────────────────────────────────────────────────── */
function BowTiePreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Left zone */}
      <rect x="4" y="10" width="80" height="140" rx="4" fill="#fef2f2" opacity="0.5" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="44" y="22" textAnchor="middle" fontSize="5.5" fill="#e03131" fontWeight="500">Threats</text>
      {/* Threats */}
      <rect x="10" y="30" width="68" height="18" rx="3" fill="#fee2e2" stroke="#e03131" strokeWidth="0.7" />
      <text x="44" y="42" textAnchor="middle" fontSize="5" fill="#e03131">Equipment</text>
      <rect x="10" y="54" width="68" height="18" rx="3" fill="#fee2e2" stroke="#e03131" strokeWidth="0.7" />
      <text x="44" y="66" textAnchor="middle" fontSize="5" fill="#e03131">Human Error</text>
      <rect x="10" y="78" width="68" height="18" rx="3" fill="#fee2e2" stroke="#e03131" strokeWidth="0.7" />
      <text x="44" y="90" textAnchor="middle" fontSize="5" fill="#e03131">External</text>
      <rect x="10" y="102" width="68" height="18" rx="3" fill="#fee2e2" stroke="#e03131" strokeWidth="0.7" />
      <text x="44" y="114" textAnchor="middle" fontSize="5" fill="#e03131">Design</text>
      {/* Arrows to barriers */}
      <line x1="78" y1="40" x2="92" y2="75" stroke="#94a3b8" strokeWidth="0.7" />
      <line x1="78" y1="63" x2="92" y2="78" stroke="#94a3b8" strokeWidth="0.7" />
      <line x1="78" y1="87" x2="92" y2="82" stroke="#94a3b8" strokeWidth="0.7" />
      <line x1="78" y1="111" x2="92" y2="86" stroke="#94a3b8" strokeWidth="0.7" />
      {/* Preventive barriers */}
      <rect x="92" y="55" width="6" height="50" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.7" />
      <rect x="103" y="55" width="6" height="50" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.7" />
      <rect x="114" y="55" width="6" height="50" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.7" />
      <text x="106" y="115" textAnchor="middle" fontSize="4.5" fill="#3b82f6">Preventive</text>
      {/* Central event */}
      <polygon points="140,55 160,80 140,105 120,80" fill="#fee2e2" stroke="#e03131" strokeWidth="1.2" />
      <text x="140" y="78" textAnchor="middle" fontSize="5.5" fill="#e03131" fontWeight="600">HAZARD</text>
      <text x="140" y="86" textAnchor="middle" fontSize="5" fill="#e03131">EVENT</text>
      {/* Mitigating barriers */}
      <rect x="162" y="55" width="6" height="50" rx="2" fill="#d1fae5" stroke="#2f9e44" strokeWidth="0.7" />
      <rect x="173" y="55" width="6" height="50" rx="2" fill="#d1fae5" stroke="#2f9e44" strokeWidth="0.7" />
      <rect x="184" y="55" width="6" height="50" rx="2" fill="#d1fae5" stroke="#2f9e44" strokeWidth="0.7" />
      <text x="174" y="115" textAnchor="middle" fontSize="4.5" fill="#2f9e44">Mitigating</text>
      {/* Right zone */}
      <rect x="196" y="10" width="80" height="140" rx="4" fill="#fef9ee" opacity="0.5" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="236" y="22" textAnchor="middle" fontSize="5.5" fill="#e8590c" fontWeight="500">Consequences</text>
      {/* Consequences */}
      <rect x="202" y="30" width="68" height="18" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.7" />
      <text x="236" y="42" textAnchor="middle" fontSize="5" fill="#e8590c">Prod. Loss</text>
      <rect x="202" y="54" width="68" height="18" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.7" />
      <text x="236" y="66" textAnchor="middle" fontSize="5" fill="#e8590c">Safety</text>
      <rect x="202" y="78" width="68" height="18" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.7" />
      <text x="236" y="90" textAnchor="middle" fontSize="5" fill="#e8590c">Financial</text>
      <rect x="202" y="102" width="68" height="18" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.7" />
      <text x="236" y="114" textAnchor="middle" fontSize="5" fill="#e8590c">Reputation</text>
      {/* Arrows from barriers */}
      <line x1="190" y1="75" x2="202" y2="40" stroke="#94a3b8" strokeWidth="0.7" />
      <line x1="190" y1="78" x2="202" y2="63" stroke="#94a3b8" strokeWidth="0.7" />
      <line x1="190" y1="82" x2="202" y2="87" stroke="#94a3b8" strokeWidth="0.7" />
      <line x1="190" y1="86" x2="202" y2="111" stroke="#94a3b8" strokeWidth="0.7" />
    </svg>
  );
}

/* ── Pareto SVG Preview ───────────────────────────────────────────────────── */
function ParetoPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Axis */}
      <line x1="68" y1="10" x2="68" y2="135" stroke="#475569" strokeWidth="1.5" />
      {/* 80% line */}
      <line x1="68" y1="10" x2="265" y2="10" stroke="#e03131" strokeWidth="1" strokeDasharray="3" />
      <text x="267" y="14" fontSize="5" fill="#e03131">80%</text>
      {/* Bars */}
      <rect x="70" y="18" width="170" height="16" rx="3" fill="#fee2e2" stroke="#e03131" strokeWidth="0.8" />
      <text x="20" y="29" fontSize="5.5" fill="#1e3a5f" fontWeight="500">Process</text>
      <text x="155" y="29" textAnchor="middle" fontSize="6" fill="#e03131" fontWeight="600">35%</text>
      <rect x="70" y="38" width="120" height="16" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.8" />
      <text x="16" y="49" fontSize="5.5" fill="#1e3a5f" fontWeight="500">Equip.</text>
      <text x="130" y="49" textAnchor="middle" fontSize="6" fill="#e8590c" fontWeight="600">25%</text>
      <rect x="70" y="58" width="72" height="16" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" />
      <text x="16" y="69" fontSize="5.5" fill="#1e3a5f" fontWeight="500">Training</text>
      <text x="106" y="69" textAnchor="middle" fontSize="6" fill="#d97706" fontWeight="600">15%</text>
      <rect x="70" y="78" width="48" height="16" rx="3" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" />
      <text x="17" y="89" fontSize="5.5" fill="#1e3a5f" fontWeight="500">Material</text>
      <text x="94" y="89" textAnchor="middle" fontSize="6" fill="#3b82f6" fontWeight="600">10%</text>
      <rect x="70" y="98" width="39" height="16" rx="3" fill="#ccfbf1" stroke="#0c8599" strokeWidth="0.8" />
      <text x="20" y="109" fontSize="5.5" fill="#1e3a5f" fontWeight="500">Env.</text>
      <rect x="70" y="118" width="24" height="16" rx="3" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.8" />
      <text x="22" y="129" fontSize="5.5" fill="#1e3a5f" fontWeight="500">Other</text>
      {/* Cumulative line */}
      <polyline points="240,26 190,46 142,66 118,86 107,106 94,126" stroke="#d97706" strokeWidth="1.5" fill="none" />
      <circle cx="240" cy="26" r="3" fill="#d97706" />
      <circle cx="190" cy="46" r="3" fill="#d97706" />
      <circle cx="142" cy="66" r="3" fill="#d97706" />
      {/* Vital few bracket */}
      <rect x="70" y="140" width="170" height="12" rx="2" fill="#fee2e2" opacity="0.5" stroke="#e03131" strokeWidth="0.5" />
      <text x="155" y="149" textAnchor="middle" fontSize="5" fill="#e03131">Vital Few (~80%)</text>
    </svg>
  );
}

/* ── Current Reality Tree SVG Preview ─────────────────────────────────────── */
function CRTPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* UDEs (top) */}
      <rect x="25" y="6" width="100" height="22" rx="3" fill="#fee2e2" stroke="#e03131" strokeWidth="0.8" />
      <text x="75" y="20" textAnchor="middle" fontSize="6" fill="#e03131" fontWeight="500">UDE 1</text>
      <rect x="155" y="6" width="100" height="22" rx="3" fill="#fee2e2" stroke="#e03131" strokeWidth="0.8" />
      <text x="205" y="20" textAnchor="middle" fontSize="6" fill="#e03131" fontWeight="500">UDE 2</text>
      <text x="260" y="20" fontSize="5" fill="#e03131">UDEs</text>
      {/* Arrows */}
      <line x1="140" y1="42" x2="75" y2="28" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="140" y1="42" x2="205" y2="28" stroke="#94a3b8" strokeWidth="0.8" />
      {/* Intermediate effects */}
      <rect x="15" y="48" width="85" height="22" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.8" />
      <text x="57" y="62" textAnchor="middle" fontSize="5.5" fill="#e8590c">Effect A</text>
      <rect x="110" y="48" width="85" height="22" rx="3" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.8" />
      <text x="152" y="62" textAnchor="middle" fontSize="5.5" fill="#e8590c">Effect B</text>
      <rect x="205" y="48" width="65" height="22" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" />
      <text x="237" y="62" textAnchor="middle" fontSize="5.5" fill="#d97706">Effect C</text>
      {/* Arrows to causes */}
      <line x1="57" y1="70" x2="57" y2="90" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="152" y1="70" x2="152" y2="90" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="237" y1="70" x2="237" y2="90" stroke="#94a3b8" strokeWidth="0.8" />
      {/* Contributing causes */}
      <rect x="15" y="92" width="85" height="22" rx="3" fill="#dbeafe" stroke="#1971c2" strokeWidth="0.8" />
      <text x="57" y="106" textAnchor="middle" fontSize="5.5" fill="#1971c2">Cause 1</text>
      <rect x="110" y="92" width="85" height="22" rx="3" fill="#dbeafe" stroke="#1971c2" strokeWidth="0.8" />
      <text x="152" y="106" textAnchor="middle" fontSize="5.5" fill="#1971c2">Cause 2</text>
      <rect x="205" y="92" width="65" height="22" rx="3" fill="#ccfbf1" stroke="#0c8599" strokeWidth="0.8" />
      <text x="237" y="106" textAnchor="middle" fontSize="5.5" fill="#0c8599">Cause 3</text>
      {/* Root causes */}
      <line x1="100" y1="114" x2="100" y2="130" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="190" y1="114" x2="190" y2="130" stroke="#94a3b8" strokeWidth="0.8" />
      <rect x="35" y="130" width="130" height="22" rx="4" fill="#d1fae5" stroke="#2f9e44" strokeWidth="1" />
      <text x="100" y="144" textAnchor="middle" fontSize="6" fill="#2f9e44" fontWeight="600">🔴 Root Cause 1</text>
      <rect x="175" y="130" width="80" height="22" rx="4" fill="#d1fae5" stroke="#2f9e44" strokeWidth="1" />
      <text x="215" y="144" textAnchor="middle" fontSize="6" fill="#2f9e44" fontWeight="600">🔴 Root 2</text>
      {/* Direction */}
      <text x="6" y="82" fontSize="5" fill="#94a3b8">↑ Read</text>
    </svg>
  );
}

/* ── Affinity Diagram SVG Preview ─────────────────────────────────────────── */
function AffinityPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Problem */}
      <rect x="70" y="4" width="140" height="20" rx="4" fill="#e0e7ff" stroke="#1e3a5f" strokeWidth="1" />
      <text x="140" y="17" textAnchor="middle" fontSize="6" fill="#1e3a5f" fontWeight="600">Problem Statement</text>
      {/* Group 1 */}
      <rect x="8" y="30" width="82" height="56" rx="4" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="2" fill="none" />
      <rect x="8" y="30" width="82" height="16" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" />
      <text x="49" y="41" textAnchor="middle" fontSize="5.5" fill="#3b82f6" fontWeight="500">🔧 Process</text>
      <rect x="14" y="50" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="14" y="50" width="3" height="10" rx="1" fill="#3b82f6" />
      <rect x="14" y="63" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="14" y="63" width="3" height="10" rx="1" fill="#3b82f6" />
      {/* Group 2 */}
      <rect x="98" y="30" width="82" height="56" rx="4" stroke="#7048e8" strokeWidth="0.8" strokeDasharray="2" fill="none" />
      <rect x="98" y="30" width="82" height="16" rx="4" fill="#ede9fe" stroke="#7048e8" strokeWidth="0.8" />
      <text x="139" y="41" textAnchor="middle" fontSize="5.5" fill="#7048e8" fontWeight="500">👥 People</text>
      <rect x="104" y="50" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="104" y="50" width="3" height="10" rx="1" fill="#7048e8" />
      <rect x="104" y="63" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="104" y="63" width="3" height="10" rx="1" fill="#7048e8" />
      {/* Group 3 */}
      <rect x="188" y="30" width="82" height="56" rx="4" stroke="#0c8599" strokeWidth="0.8" strokeDasharray="2" fill="none" />
      <rect x="188" y="30" width="82" height="16" rx="4" fill="#ccfbf1" stroke="#0c8599" strokeWidth="0.8" />
      <text x="229" y="41" textAnchor="middle" fontSize="5.5" fill="#0c8599" fontWeight="500">🖥️ Tech</text>
      <rect x="194" y="50" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="194" y="50" width="3" height="10" rx="1" fill="#0c8599" />
      <rect x="194" y="63" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="194" y="63" width="3" height="10" rx="1" fill="#0c8599" />
      {/* Group 4 */}
      <rect x="8" y="94" width="82" height="56" rx="4" stroke="#e8590c" strokeWidth="0.8" strokeDasharray="2" fill="none" />
      <rect x="8" y="94" width="82" height="16" rx="4" fill="#ffedd5" stroke="#e8590c" strokeWidth="0.8" />
      <text x="49" y="105" textAnchor="middle" fontSize="5.5" fill="#e8590c" fontWeight="500">📊 Data</text>
      <rect x="14" y="114" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="14" y="114" width="3" height="10" rx="1" fill="#e8590c" />
      <rect x="14" y="127" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="14" y="127" width="3" height="10" rx="1" fill="#e8590c" />
      {/* Group 5 */}
      <rect x="98" y="94" width="82" height="56" rx="4" stroke="#c2255c" strokeWidth="0.8" strokeDasharray="2" fill="none" />
      <rect x="98" y="94" width="82" height="16" rx="4" fill="#fce7f3" stroke="#c2255c" strokeWidth="0.8" />
      <text x="139" y="105" textAnchor="middle" fontSize="5.5" fill="#c2255c" fontWeight="500">🏢 Culture</text>
      <rect x="104" y="114" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="104" y="114" width="3" height="10" rx="1" fill="#c2255c" />
      <rect x="104" y="127" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="104" y="127" width="3" height="10" rx="1" fill="#c2255c" />
      {/* Group 6 */}
      <rect x="188" y="94" width="82" height="56" rx="4" stroke="#2f9e44" strokeWidth="0.8" strokeDasharray="2" fill="none" />
      <rect x="188" y="94" width="82" height="16" rx="4" fill="#d1fae5" stroke="#2f9e44" strokeWidth="0.8" />
      <text x="229" y="105" textAnchor="middle" fontSize="5.5" fill="#2f9e44" fontWeight="500">📋 Resources</text>
      <rect x="194" y="114" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="194" y="114" width="3" height="10" rx="1" fill="#2f9e44" />
      <rect x="194" y="127" width="70" height="10" rx="2" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="194" y="127" width="3" height="10" rx="1" fill="#2f9e44" />
    </svg>
  );
}

/* ── Fishbone 4S Preview ──────────────────────────────────────────────────── */
function Fishbone4SPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Title */}
      <text x="10" y="12" fontSize="6" fill="#1e1e1e" fontWeight="600">Fishbone 4S — Service Industry</text>
      {/* Spine */}
      <line x1="30" y1="80" x2="230" y2="80" stroke="#1e1e1e" strokeWidth="1.5" />
      <polygon points="230,80 225,77 225,83" fill="#1e1e1e" />
      {/* Effect box */}
      <rect x="232" y="68" width="42" height="24" rx="4" fill="#ffe3e3" stroke="#e03131" strokeWidth="1" />
      <text x="253" y="82" textAnchor="middle" fontSize="5" fill="#e03131" fontWeight="600">DEFECT</text>
      {/* Surroundings (top-left) */}
      <line x1="50" y1="30" x2="100" y2="80" stroke="#4263eb" strokeWidth="1" />
      <rect x="22" y="16" width="56" height="14" rx="3" fill="#dbe4ff" stroke="#4263eb" strokeWidth="0.8" />
      <text x="50" y="26" textAnchor="middle" fontSize="5" fill="#4263eb" fontWeight="500">Surroundings</text>
      <line x1="55" y1="40" x2="65" y2="50" stroke="#4263eb" strokeWidth="0.5" />
      <line x1="65" y1="48" x2="75" y2="58" stroke="#4263eb" strokeWidth="0.5" />
      <line x1="75" y1="55" x2="85" y2="65" stroke="#4263eb" strokeWidth="0.5" />
      <circle cx="53" cy="38" r="2" fill="#e03131" />
      <circle cx="63" cy="46" r="2" fill="#f59f00" />
      <circle cx="73" cy="53" r="2" fill="#868e96" />
      {/* Suppliers (top-right) */}
      <line x1="130" y1="30" x2="180" y2="80" stroke="#f59f00" strokeWidth="1" />
      <rect x="102" y="16" width="56" height="14" rx="3" fill="#fff3bf" stroke="#f59f00" strokeWidth="0.8" />
      <text x="130" y="26" textAnchor="middle" fontSize="5" fill="#f59f00" fontWeight="500">Suppliers</text>
      <line x1="135" y1="40" x2="145" y2="50" stroke="#f59f00" strokeWidth="0.5" />
      <line x1="145" y1="48" x2="155" y2="58" stroke="#f59f00" strokeWidth="0.5" />
      <line x1="155" y1="55" x2="165" y2="65" stroke="#f59f00" strokeWidth="0.5" />
      {/* Systems (bottom-left) */}
      <line x1="50" y1="130" x2="100" y2="80" stroke="#2f9e44" strokeWidth="1" />
      <rect x="22" y="130" width="56" height="14" rx="3" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.8" />
      <text x="50" y="140" textAnchor="middle" fontSize="5" fill="#2f9e44" fontWeight="500">Systems</text>
      <line x1="55" y1="120" x2="65" y2="110" stroke="#2f9e44" strokeWidth="0.5" />
      <line x1="65" y1="112" x2="75" y2="102" stroke="#2f9e44" strokeWidth="0.5" />
      <line x1="75" y1="105" x2="85" y2="95" stroke="#2f9e44" strokeWidth="0.5" />
      {/* Skills (bottom-right) */}
      <line x1="130" y1="130" x2="180" y2="80" stroke="#e8590c" strokeWidth="1" />
      <rect x="102" y="130" width="56" height="14" rx="3" fill="#ffe8cc" stroke="#e8590c" strokeWidth="0.8" />
      <text x="130" y="140" textAnchor="middle" fontSize="5" fill="#e8590c" fontWeight="500">Skills</text>
      <line x1="135" y1="120" x2="145" y2="110" stroke="#e8590c" strokeWidth="0.5" />
      <line x1="145" y1="112" x2="155" y2="102" stroke="#e8590c" strokeWidth="0.5" />
      <line x1="155" y1="105" x2="165" y2="95" stroke="#e8590c" strokeWidth="0.5" />
      {/* Legend */}
      <rect x="180" y="6" width="90" height="22" rx="3" fill="#f8f9fa" stroke="#adb5bd" strokeWidth="0.5" />
      <circle cx="188" cy="13" r="2" fill="#e03131" />
      <text x="194" y="15" fontSize="4" fill="#495057">High</text>
      <circle cx="212" cy="13" r="2" fill="#f59f00" />
      <text x="218" y="15" fontSize="4" fill="#495057">Med</text>
      <circle cx="236" cy="13" r="2" fill="#868e96" />
      <text x="242" y="15" fontSize="4" fill="#495057">Low</text>
      <text x="225" y="24" textAnchor="middle" fontSize="3.5" fill="#868e96">Severity Coded</text>
    </svg>
  );
}

/* ── Fishbone 8P Preview ──────────────────────────────────────────────────── */
function Fishbone8PPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Title */}
      <text x="10" y="12" fontSize="6" fill="#1e1e1e" fontWeight="600">Fishbone 8P — Marketing & Service</text>
      {/* Spine */}
      <line x1="15" y1="80" x2="232" y2="80" stroke="#1e1e1e" strokeWidth="1.5" />
      <polygon points="232,80 227,77 227,83" fill="#1e1e1e" />
      {/* Effect box */}
      <rect x="234" y="65" width="42" height="30" rx="4" fill="#ffe3e3" stroke="#e03131" strokeWidth="1" />
      <text x="255" y="79" textAnchor="middle" fontSize="4.5" fill="#e03131" fontWeight="600">MARKET</text>
      <text x="255" y="86" textAnchor="middle" fontSize="4" fill="#e03131">GAP</text>
      {/* Top ribs — Product, Price, Place, Promotion */}
      <line x1="30" y1="32" x2="60" y2="80" stroke="#1971c2" strokeWidth="0.8" />
      <rect x="10" y="20" width="40" height="12" rx="3" fill="#d0ebff" stroke="#1971c2" strokeWidth="0.7" />
      <circle cx="8" cy="26" r="5" fill="#1971c2" />
      <text x="8" y="28" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">1</text>
      <text x="30" y="29" textAnchor="middle" fontSize="4.5" fill="#1971c2" fontWeight="500">Product</text>
      <line x1="80" y1="32" x2="110" y2="80" stroke="#2f9e44" strokeWidth="0.8" />
      <rect x="60" y="20" width="40" height="12" rx="3" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.7" />
      <circle cx="58" cy="26" r="5" fill="#2f9e44" />
      <text x="58" y="28" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">2</text>
      <text x="80" y="29" textAnchor="middle" fontSize="4.5" fill="#2f9e44" fontWeight="500">Price</text>
      <line x1="130" y1="32" x2="160" y2="80" stroke="#7048e8" strokeWidth="0.8" />
      <rect x="110" y="20" width="40" height="12" rx="3" fill="#e5dbff" stroke="#7048e8" strokeWidth="0.7" />
      <circle cx="108" cy="26" r="5" fill="#7048e8" />
      <text x="108" y="28" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">3</text>
      <text x="130" y="29" textAnchor="middle" fontSize="4.5" fill="#7048e8" fontWeight="500">Place</text>
      <line x1="180" y1="32" x2="210" y2="80" stroke="#d6336c" strokeWidth="0.8" />
      <rect x="160" y="20" width="40" height="12" rx="3" fill="#ffe0f0" stroke="#d6336c" strokeWidth="0.7" />
      <circle cx="158" cy="26" r="5" fill="#d6336c" />
      <text x="158" y="28" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">4</text>
      <text x="180" y="29" textAnchor="middle" fontSize="4" fill="#d6336c" fontWeight="500">Promotion</text>
      {/* Bottom ribs — People, Process, Physical Evid., Productivity */}
      <line x1="30" y1="128" x2="60" y2="80" stroke="#0c8599" strokeWidth="0.8" />
      <rect x="10" y="128" width="40" height="12" rx="3" fill="#c3fae8" stroke="#0c8599" strokeWidth="0.7" />
      <circle cx="8" cy="134" r="5" fill="#0c8599" />
      <text x="8" y="136" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">5</text>
      <text x="30" y="137" textAnchor="middle" fontSize="4.5" fill="#0c8599" fontWeight="500">People</text>
      <line x1="80" y1="128" x2="110" y2="80" stroke="#e8590c" strokeWidth="0.8" />
      <rect x="60" y="128" width="40" height="12" rx="3" fill="#ffe8cc" stroke="#e8590c" strokeWidth="0.7" />
      <circle cx="58" cy="134" r="5" fill="#e8590c" />
      <text x="58" y="136" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">6</text>
      <text x="80" y="137" textAnchor="middle" fontSize="4.5" fill="#e8590c" fontWeight="500">Process</text>
      <line x1="130" y1="128" x2="160" y2="80" stroke="#1098ad" strokeWidth="0.8" />
      <rect x="110" y="128" width="40" height="12" rx="3" fill="#c3fae8" stroke="#1098ad" strokeWidth="0.7" />
      <circle cx="108" cy="134" r="5" fill="#1098ad" />
      <text x="108" y="136" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">7</text>
      <text x="130" y="137" textAnchor="middle" fontSize="3.8" fill="#1098ad" fontWeight="500">Phys. Evid.</text>
      <line x1="180" y1="128" x2="210" y2="80" stroke="#e03131" strokeWidth="0.8" />
      <rect x="160" y="128" width="40" height="12" rx="3" fill="#ffe3e3" stroke="#e03131" strokeWidth="0.7" />
      <circle cx="158" cy="134" r="5" fill="#e03131" />
      <text x="158" y="136" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="600">8</text>
      <text x="180" y="137" textAnchor="middle" fontSize="3.8" fill="#e03131" fontWeight="500">Productivity</text>
      {/* Sub-cause tick marks top */}
      <line x1="35" y1="44" x2="42" y2="52" stroke="#1971c2" strokeWidth="0.4" />
      <line x1="42" y1="52" x2="50" y2="60" stroke="#1971c2" strokeWidth="0.4" />
      <line x1="85" y1="44" x2="92" y2="52" stroke="#2f9e44" strokeWidth="0.4" />
      <line x1="92" y1="52" x2="100" y2="60" stroke="#2f9e44" strokeWidth="0.4" />
      <line x1="135" y1="44" x2="142" y2="52" stroke="#7048e8" strokeWidth="0.4" />
      <line x1="142" y1="52" x2="150" y2="60" stroke="#7048e8" strokeWidth="0.4" />
      <line x1="185" y1="44" x2="192" y2="52" stroke="#d6336c" strokeWidth="0.4" />
      <line x1="192" y1="52" x2="200" y2="60" stroke="#d6336c" strokeWidth="0.4" />
      {/* Metadata box */}
      <rect x="210" y="8" width="64" height="16" rx="2" fill="#f8f9fa" stroke="#adb5bd" strokeWidth="0.5" />
      <text x="242" y="18" textAnchor="middle" fontSize="3.5" fill="#868e96">Analysis Metadata</text>
    </svg>
  );
}

/* ── Fishbone CEDAC Preview ───────────────────────────────────────────────── */
function FishboneCEDACPreview() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      {/* Title */}
      <text x="10" y="12" fontSize="5.5" fill="#1e1e1e" fontWeight="600">CEDAC — Cause & Effect + Cards</text>
      {/* Spine */}
      <line x1="30" y1="80" x2="228" y2="80" stroke="#1e1e1e" strokeWidth="1.5" />
      <polygon points="228,80 223,77 223,83" fill="#1e1e1e" />
      {/* Effect box */}
      <rect x="230" y="65" width="44" height="30" rx="4" fill="#ffe3e3" stroke="#e03131" strokeWidth="1" />
      <text x="252" y="79" textAnchor="middle" fontSize="4.5" fill="#e03131" fontWeight="600">QUALITY</text>
      <text x="252" y="86" textAnchor="middle" fontSize="4" fill="#e03131">GAP</text>
      {/* Top ribs — People, Process, Equipment */}
      <line x1="40" y1="30" x2="75" y2="80" stroke="#1971c2" strokeWidth="0.8" />
      <rect x="16" y="16" width="48" height="14" rx="3" fill="#d0ebff" stroke="#1971c2" strokeWidth="0.7" />
      <text x="40" y="26" textAnchor="middle" fontSize="5" fill="#1971c2" fontWeight="500">People</text>
      <line x1="100" y1="30" x2="135" y2="80" stroke="#2f9e44" strokeWidth="0.8" />
      <rect x="76" y="16" width="48" height="14" rx="3" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.7" />
      <text x="100" y="26" textAnchor="middle" fontSize="5" fill="#2f9e44" fontWeight="500">Process</text>
      <line x1="160" y1="30" x2="195" y2="80" stroke="#7048e8" strokeWidth="0.8" />
      <rect x="136" y="16" width="48" height="14" rx="3" fill="#e5dbff" stroke="#7048e8" strokeWidth="0.7" />
      <text x="160" y="26" textAnchor="middle" fontSize="4.5" fill="#7048e8" fontWeight="500">Equipment</text>
      {/* Bottom ribs — Materials, Standards */}
      <line x1="60" y1="130" x2="100" y2="80" stroke="#e8590c" strokeWidth="0.8" />
      <rect x="36" y="130" width="48" height="14" rx="3" fill="#ffe8cc" stroke="#e8590c" strokeWidth="0.7" />
      <text x="60" y="140" textAnchor="middle" fontSize="5" fill="#e8590c" fontWeight="500">Materials</text>
      <line x1="140" y1="130" x2="170" y2="80" stroke="#0c8599" strokeWidth="0.8" />
      <rect x="116" y="130" width="48" height="14" rx="3" fill="#c3fae8" stroke="#0c8599" strokeWidth="0.7" />
      <text x="140" y="140" textAnchor="middle" fontSize="5" fill="#0c8599" fontWeight="500">Standards</text>
      {/* CEDAC Fact/Idea card pairs */}
      <rect x="10" y="36" width="18" height="12" rx="2" fill="#dbe4ff" stroke="#1971c2" strokeWidth="0.5" />
      <text x="19" y="44" textAnchor="middle" fontSize="3.5" fill="#1971c2">FACT</text>
      <rect x="30" y="36" width="18" height="12" rx="2" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.5" />
      <text x="39" y="44" textAnchor="middle" fontSize="3.5" fill="#2f9e44">IDEA</text>
      <rect x="70" y="36" width="18" height="12" rx="2" fill="#dbe4ff" stroke="#1971c2" strokeWidth="0.5" />
      <text x="79" y="44" textAnchor="middle" fontSize="3.5" fill="#1971c2">FACT</text>
      <rect x="90" y="36" width="18" height="12" rx="2" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.5" />
      <text x="99" y="44" textAnchor="middle" fontSize="3.5" fill="#2f9e44">IDEA</text>
      <rect x="130" y="36" width="18" height="12" rx="2" fill="#dbe4ff" stroke="#1971c2" strokeWidth="0.5" />
      <text x="139" y="44" textAnchor="middle" fontSize="3.5" fill="#1971c2">FACT</text>
      <rect x="150" y="36" width="18" height="12" rx="2" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.5" />
      <text x="159" y="44" textAnchor="middle" fontSize="3.5" fill="#2f9e44">IDEA</text>
      {/* Bottom CEDAC cards */}
      <rect x="28" y="116" width="18" height="12" rx="2" fill="#dbe4ff" stroke="#1971c2" strokeWidth="0.5" />
      <text x="37" y="124" textAnchor="middle" fontSize="3.5" fill="#1971c2">FACT</text>
      <rect x="48" y="116" width="18" height="12" rx="2" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.5" />
      <text x="57" y="124" textAnchor="middle" fontSize="3.5" fill="#2f9e44">IDEA</text>
      <rect x="110" y="116" width="18" height="12" rx="2" fill="#dbe4ff" stroke="#1971c2" strokeWidth="0.5" />
      <text x="119" y="124" textAnchor="middle" fontSize="3.5" fill="#1971c2">FACT</text>
      <rect x="130" y="116" width="18" height="12" rx="2" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.5" />
      <text x="139" y="124" textAnchor="middle" fontSize="3.5" fill="#2f9e44">IDEA</text>
      {/* Legend */}
      <rect x="192" y="6" width="82" height="26" rx="3" fill="#f8f9fa" stroke="#adb5bd" strokeWidth="0.5" />
      <text x="233" y="14" textAnchor="middle" fontSize="3.8" fill="#495057" fontWeight="500">CEDAC Card System</text>
      <rect x="198" y="19" width="14" height="8" rx="1" fill="#dbe4ff" stroke="#1971c2" strokeWidth="0.4" />
      <text x="205" y="25" textAnchor="middle" fontSize="3" fill="#1971c2">F</text>
      <text x="220" y="25" fontSize="3" fill="#495057">= Data</text>
      <rect x="240" y="19" width="14" height="8" rx="1" fill="#d3f9d8" stroke="#2f9e44" strokeWidth="0.4" />
      <text x="247" y="25" textAnchor="middle" fontSize="3" fill="#2f9e44">I</text>
      <text x="260" y="25" fontSize="3" fill="#495057">= Fix</text>
      {/* Sub-cause tick marks */}
      <line x1="45" y1="42" x2="53" y2="50" stroke="#1971c2" strokeWidth="0.4" />
      <line x1="105" y1="42" x2="113" y2="50" stroke="#2f9e44" strokeWidth="0.4" />
      <line x1="165" y1="42" x2="173" y2="50" stroke="#7048e8" strokeWidth="0.4" />
      <line x1="65" y1="118" x2="75" y2="108" stroke="#e8590c" strokeWidth="0.4" />
      <line x1="145" y1="118" x2="155" y2="108" stroke="#0c8599" strokeWidth="0.4" />
    </svg>
  );
}

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
  {
    id: 'project-timeline',
    name: 'Project Timeline',
    description: '4-phase horizontal timeline with milestones, task bars, and status tracking',
    icon: <CalendarRange size={24} />,
    preview: <TimelinePreview />,
    apply: applyProjectTimelineTemplate,
  },
  {
    id: 'org-chart',
    name: 'Org Chart',
    description: 'Hierarchical organization chart — CEO, VPs, and Directors with role cards',
    icon: <Users size={24} />,
    preview: <OrgChartPreview />,
    apply: applyOrgChartTemplate,
  },
  {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'Sprint kanban with Backlog, To Do, In Progress, Done columns and priority cards',
    icon: <Columns size={24} />,
    preview: <KanbanPreview />,
    apply: applyKanbanTemplate,
  },
  {
    id: 'raci',
    name: 'RACI Matrix',
    description: 'Responsibility assignment matrix — Responsible, Accountable, Consulted, Informed',
    icon: <Table2 size={24} />,
    preview: <RaciPreview />,
    apply: applyRaciTemplate,
  },
  {
    id: 'stakeholder-map',
    name: 'Stakeholder Map',
    description: 'Power/Interest quadrant matrix for stakeholder analysis and engagement planning',
    icon: <Target size={24} />,
    preview: <StakeholderPreview />,
    apply: applyStakeholderMapTemplate,
  },
  {
    id: 'business-model-canvas',
    name: 'Business Model Canvas',
    description: "Osterwalder's 9-block canvas — Key Partners, Value Propositions, Revenue Streams & more",
    icon: <Briefcase size={24} />,
    preview: <BMCPreview />,
    apply: applyBusinessModelCanvasTemplate,
  },
  {
    id: 'customer-journey',
    name: 'Customer Journey Map',
    description: '5-stage journey map with touchpoints, emotions, pain points, and opportunities',
    icon: <Map size={24} />,
    preview: <JourneyPreview />,
    apply: applyCustomerJourneyTemplate,
  },
  {
    id: 'five-whys',
    name: '5 Whys Analysis',
    description: 'Cascading "Why?" drill-down from problem statement to verified root cause',
    icon: <HelpCircle size={24} />,
    preview: <FiveWhysPreview />,
    apply: applyFiveWhysTemplate,
  },
  {
    id: 'fault-tree',
    name: 'Fault Tree Analysis',
    description: 'Top-down logic tree with AND/OR gates — systematic failure mode decomposition',
    icon: <GitFork size={24} />,
    preview: <FaultTreePreview />,
    apply: applyFaultTreeTemplate,
  },
  {
    id: 'bow-tie',
    name: 'Bow-Tie Analysis',
    description: 'Threats → preventive barriers → hazard event → mitigating barriers → consequences',
    icon: <ShieldAlert size={24} />,
    preview: <BowTiePreview />,
    apply: applyBowTieTemplate,
  },
  {
    id: 'pareto',
    name: 'Pareto Analysis',
    description: '80/20 ranked cause chart with cumulative line and vital-few threshold marker',
    icon: <BarChart3 size={24} />,
    preview: <ParetoPreview />,
    apply: applyParetoTemplate,
  },
  {
    id: 'current-reality-tree',
    name: 'Current Reality Tree',
    description: 'TOC thinking process — bottom-up "If…Then" cause-effect chain to find core conflicts',
    icon: <Workflow size={24} />,
    preview: <CRTPreview />,
    apply: applyCurrentRealityTreeTemplate,
  },
  {
    id: 'affinity-diagram',
    name: 'Affinity Diagram',
    description: 'KJ Method — brainstorm causes, cluster into themed groups, identify root cause patterns',
    icon: <StickyNote size={24} />,
    preview: <AffinityPreview />,
    apply: applyAffinityDiagramTemplate,
  },
  {
    id: 'fishbone-4s',
    name: 'Fishbone 4S (Service)',
    description: 'Service industry Ishikawa — Surroundings, Suppliers, Systems, Skills with severity-coded sub-causes',
    icon: <Building2 size={24} />,
    preview: <Fishbone4SPreview />,
    apply: applyFishbone4STemplate,
  },
  {
    id: 'fishbone-8p',
    name: 'Fishbone 8P (Marketing)',
    description: '8P marketing mix RCA — Product, Price, Place, Promotion, People, Process, Physical Evidence, Productivity',
    icon: <Megaphone size={24} />,
    preview: <Fishbone8PPreview />,
    apply: applyFishbone8PTemplate,
  },
  {
    id: 'fishbone-cedac',
    name: 'Fishbone CEDAC',
    description: 'Fukuda CEDAC method — Ishikawa with Fact & Idea card attachments for Kaizen workshops',
    icon: <ClipboardList size={24} />,
    preview: <FishboneCEDACPreview />,
    apply: applyFishboneCEDACTemplate,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Callback ref: fires synchronously when the DOM node mounts/unmounts.
  const modalCallbackRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous listener if any
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!node) return;
    console.log('[TemplatePicker] callback ref fired, attaching wheel listener to', node.tagName);

    const handleWheel = (e: WheelEvent) => {
      console.log('[TemplatePicker] wheel event caught!', {
        deltaY: e.deltaY,
        target: (e.target as HTMLElement)?.tagName,
        targetClass: (e.target as HTMLElement)?.className?.substring?.(0, 50),
        scrollRefExists: !!scrollRef.current,
        scrollTop: scrollRef.current?.scrollTop,
        scrollHeight: scrollRef.current?.scrollHeight,
        clientHeight: scrollRef.current?.clientHeight,
      });

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const el = scrollRef.current;
      if (el) {
        el.scrollTop += e.deltaY;
        console.log('[TemplatePicker] scrollTop set to', el.scrollTop);
      }
    };

    node.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    cleanupRef.current = () =>
      node.removeEventListener('wheel', handleWheel, { capture: true } as any);
  }, []);

  if (!open || typeof document === 'undefined') return null;

  const handleSelect = (template: TemplateDef) => {
    const api = excalidrawAPI.current;
    if (!api) return;
    template.apply(api);
    onClose();
  };

  return createPortal(
    <div
      ref={modalCallbackRef}
      data-template-modal
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
        relative
        w-full max-w-4xl max-h-[90vh]
        mx-4
        bg-white dark:bg-gray-900
        border border-gray-200 dark:border-gray-700
        rounded-2xl
        shadow-2xl shadow-black/20
        animate-in fade-in zoom-in-95 duration-200
        flex flex-col
        overflow-hidden
      "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
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

        {/* Template grid — min-h-0 is critical for flex overflow scroll */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>,
    document.body,
  );
}
