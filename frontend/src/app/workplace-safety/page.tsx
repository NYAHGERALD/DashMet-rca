'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';
import { useHasMinimumRole } from '@/lib/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { storage, auth } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getIdToken } from 'firebase/auth';
import AIEnhancedTextarea from '@/components/fmir/AIEnhancedTextarea';
import {
  Shield,
  HardHat,
  Lock,
  Cog,
  Zap,
  Forklift,
  Anchor,
  Tag,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MinusCircle,
  Save,
  FileText,
  Calendar,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  Plus,
  History,
  Loader2,
  ArrowLeft,
  Trash2,
  Camera,
  Pen,
  Eraser,
  Upload,
  Eye,
  Clock,
  RefreshCw,
  Printer,
  Download,
  Paperclip,
  Wrench,
  Smartphone,
  FilePlus,
  ClipboardList,
  Bell,
  MousePointer2,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

// API Base URL for direct fetch calls
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';

// Types
interface DynamicEntry {
  id: string;
  employeeName?: string;
  equipmentName?: string;
}

interface PhotoAttachment {
  id: string;
  file?: File;
  preview: string;
  name: string;
  fileUrl?: string; // Firebase URL after upload
  uploaded?: boolean;
  uploading?: boolean;
}

interface AssessmentSection {
  id: string;
  title: string;
  icon: React.ElementType;
  items: AssessmentItem[];
}

interface AssessmentItem {
  id: string;
  description: string;
  status: 'A' | 'U' | 'NA' | null;
  deficiency?: string;
  correctiveAction?: string;
  // Special fields for lockout-5, lockout-6, mg-7, and eap-1
  dynamicEntries?: DynamicEntry[];
  // Fields for Unacceptable status
  photos?: PhotoAttachment[];
  workOrderPlaced?: boolean;
  reportedViaSafetyApp?: boolean;
  safetyAppReportDate?: string;
  workOrderDateCreated?: string;
  workOrderAssignedTo?: string;
  workOrderAttachment?: {
    id: string;
    name: string;
    fileUrl?: string;
    file?: File;
    isCreated?: boolean; // True if work order was created via form, false/undefined if uploaded
    formData?: {
      workOrderNumber: string;
      title: string;
      priority: string;
      assignedTo: string;
      dueDate: string;
      description: string;
      notes: string;
      createdAt: string;
      createdBy: string;
    };
  };
}

// Items that require work orders when marked as Unacceptable
// Work order is only required for items that need PHYSICAL REPAIR, INSTALLATION, or MAINTENANCE
// NOT for behavioral/compliance issues, documentation, or items that can be immediately fixed
const WORK_ORDER_REQUIRED_ITEMS = [
  // Lockout - only label installation
  'lockout-4', // Lockout disconnects need labels - physical installation
  'lockout-6', // Safety switches need repair/maintenance
  // Machine Guarding - all require physical guarding repairs/installation
  'mg-1', 'mg-2', 'mg-3', 'mg-4', 'mg-5', 'mg-6', 'mg-7',
  // Electrical - physical repairs (excluding elec-4 which is just moving items)
  'elec-1', 'elec-2', 'elec-3',
  // Material Handling - only equipment repair
  'mh-6', // Backup horn and lights need repair
  // Fall Protection - all require physical installation/repair
  'fp-1', 'fp-2', 'fp-3',
  // Labeling - all need physical signs/labels to be made and installed
  'lbl-1', 'lbl-2', 'lbl-3', 'lbl-4',
  // Housekeeping - only maintenance/repair items
  'hk-2', // Ladders need repair/replacement
  'hk-4', // Lighting needs electrical repair
  'hk-7', // Fire extinguishers need service/mounting
];

interface SignatureData {
  name: string;
  signatureDataUrl: string | null;
}

interface SafetyAssessment {
  id?: string;
  assessmentNumber: string;
  department: string;
  version: string;
  date: string;
  teamLeaderName: string;
  teamLeaderSignature?: SignatureData;
  employeeName: string;
  employeeSignature?: SignatureData;
  operationManagerSignature?: SignatureData;
  plantManagerSignature?: SignatureData;
  safetyManagerSignature?: SignatureData;
  status: 'DRAFT' | 'SUBMITTED' | 'COMPLETED';
  sections: AssessmentSection[];
  createdAt?: string;
  updatedAt?: string;
}

// Initial sections data based on the form images
const getInitialSections = (): AssessmentSection[] => [
  {
    id: 'ppe',
    title: 'PPE (Personal Protective Equipment)',
    icon: HardHat,
    items: [
      { id: 'ppe-1', description: 'Conduct PPE audit of all employees - verify proper PPE is worn for each job and is in good condition, including footwear. Outer most clothing layer must be over chemical boots.', status: null },
      { id: 'ppe-2', description: 'Verify proper PPE is being worn during chemical usage and verify with label / SDS', status: null },
    ],
  },
  {
    id: 'lockout',
    title: 'LOCKOUT',
    icon: Lock,
    items: [
      { id: 'lockout-1', description: 'Verify all authorized employees have lockout devices on their person', status: null },
      { id: 'lockout-2', description: 'Verify all authorized operators have their name or unique identifier on their lockout locks', status: null },
      { id: 'lockout-3', description: 'Verify that employees are not reaching into equipment without proper lockout procedures being completed during setup, tear down, or changeovers', status: null },
      { id: 'lockout-4', description: 'Verify all lockout disconnects are labeled with name of equipment they service', status: null },
      { 
        id: 'lockout-5', 
        description: 'Verify the proper lockout of equipment by an employee', 
        status: null,
        dynamicEntries: [
          { id: 'entry-1', employeeName: '', equipmentName: '' }
        ]
      },
      { 
        id: 'lockout-6', 
        description: 'Verify safety switches for alternative lockout procedures are being checked and documented', 
        status: null,
        dynamicEntries: [
          { id: 'entry-1', equipmentName: '' }
        ]
      },
    ],
  },
  {
    id: 'machine-guarding',
    title: 'MACHINE GUARDING',
    icon: Cog,
    items: [
      { id: 'mg-1', description: 'Rotating Motion - shafts, pulleys etc. are fully guarded and secured properly', status: null },
      { id: 'mg-2', description: 'Fan guard openings do not exceed 1/4 inch anywhere on fan guard', status: null },
      { id: 'mg-3', description: 'Shafts do not extend out greater than 1/2 their diameter, are smooth, with no extended set screws or open keyways', status: null },
      { id: 'mg-4', description: 'Traverse Motion - belts, sprockets, pulleys, drums, chains', status: null },
      { id: 'mg-5', description: 'Reciprocating Motion - Back and forth, up and down', status: null },
      { id: 'mg-6', description: 'Cutting and Shearing Action - Knives, blades, sealing', status: null },
      { 
        id: 'mg-7', 
        description: 'Verify all safety switches work on at least one piece of equipment', 
        status: null,
        dynamicEntries: [
          { id: 'entry-1', equipmentName: '' }
        ]
      },
    ],
  },
  {
    id: 'electrical',
    title: 'ELECTRICAL',
    icon: Zap,
    items: [
      { id: 'elec-1', description: 'Verify cord insulation and conduits are in good repair and grounding prong is intact', status: null },
      { id: 'elec-2', description: 'Verify no power strips are in use, or extension cords as permanent wiring in production areas', status: null },
      { id: 'elec-3', description: 'Verify electrical/welding outlet cover plates are in place and in good repair', status: null },
      { id: 'elec-4', description: 'Verify electrical panel access is not blocked (ie. pallets, carts)', status: null },
    ],
  },
  {
    id: 'material-handling',
    title: 'Powered Material Handling Equipment',
    icon: Forklift,
    items: [
      { id: 'mh-1', description: 'Verify only authorized employees are operating equipment and wearing seatbelts if applicable', status: null },
      { id: 'mh-2', description: 'Operators drive in reverse when load blocks vision', status: null },
      { id: 'mh-3', description: 'Operators use horns at intersections or at blind corners', status: null },
      { id: 'mh-4', description: 'Operators drive at safe speeds based on environment and facing the direction of travel', status: null },
      { id: 'mh-5', description: 'Verify pre-shift inspection sheets are completed prior to use and drivers qualification is current', status: null },
      { id: 'mh-6', description: 'Ensure backup horn and lights work if equipped', status: null },
      { id: 'mh-7', description: 'Verify all observation mirrors are clean', status: null },
    ],
  },
  {
    id: 'fall-protection',
    title: 'FALL PROTECTION',
    icon: Anchor,
    items: [
      { id: 'fp-1', description: 'Platforms over 4 foot in height, or where imminent danger of falling is present, have top rail, mid rail, toe board, and swing gate', status: null },
      { id: 'fp-2', description: 'Stairs with 4 or more risers have standard railings, includes top tread on platform', status: null },
      { id: 'fp-3', description: 'Fixed ladders over 20 feet above a lower level are equipped with a personal fall arrest system, ladder safety system, cage, or well', status: null },
    ],
  },
  {
    id: 'labeling',
    title: 'LABELING',
    icon: Tag,
    items: [
      { id: 'lbl-1', description: 'Secondary chemical containers have required GHS labels and are legible', status: null },
      { id: 'lbl-2', description: 'Confined spaces are clearly labeled', status: null },
      { id: 'lbl-3', description: 'Overhead pipelines are identified with contents', status: null },
      { id: 'lbl-4', description: 'Exits labeled with EXIT sign', status: null },
    ],
  },
  {
    id: 'housekeeping',
    title: 'HOUSEKEEPING',
    icon: Sparkles,
    items: [
      { id: 'hk-1', description: 'Floors and walkways free of slip and trip hazards - i.e. meat, ice, etc.', status: null },
      { id: 'hk-2', description: 'Fixed and portable ladders are in good condition and secured. 6 month inspection is complete', status: null },
      { id: 'hk-3', description: 'All chemical containers are secured to prevent unauthorized use', status: null },
      { id: 'hk-4', description: 'All lighting in working order and in good repair', status: null },
      { id: 'hk-5', description: 'Walkways that are used as exit routes are free of obstructions with a minimum of 28" of clearance (boxes, pallets, forklifts, etc)', status: null },
      { id: 'hk-6', description: 'Eyewash/Showers unobstructed and weekly inspections completed', status: null },
      { id: 'hk-7', description: 'Fire extinguishers mounted, inspections up to date, and monthly/yearly tags attached', status: null },
      { id: 'hk-8', description: 'Pallets stored flat and less than 6 feet in height', status: null },
    ],
  },
  {
    id: 'emergency-action',
    title: 'EMERGENCY ACTION PLAN',
    icon: AlertTriangle,
    items: [
      { 
        id: 'eap-1', 
        description: 'Verify at least two employees know their evacuation routes, central meeting areas, and inclement weather shelters', 
        status: null,
        dynamicEntries: [
          { id: 'entry-1', employeeName: '' },
          { id: 'entry-2', employeeName: '' }
        ]
      },
    ],
  },
];

// Status options
const statusOptions = [
  { value: 'A', label: 'Acceptable', color: 'bg-green-500', icon: CheckCircle },
  { value: 'U', label: 'Unacceptable', color: 'bg-red-500', icon: XCircle },
  { value: 'NA', label: 'Not Applicable', color: 'bg-gray-400', icon: MinusCircle },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 12,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
  hover: {
    scale: 1.01,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

// Signature Pad Component
interface SignaturePadProps {
  label: string;
  signatureData?: SignatureData;
  onChange: (data: SignatureData) => void;
}

// Portal component to render outside the parent container
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div style={{ pointerEvents: 'auto' }}>{children}</div>,
    document.body
  );
}

// Signature Pad Modal Component - Hover to draw (no click/hold needed)
interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
  label: string;
}

function SignatureModal({ isOpen, onClose, onSave, label }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [strokeStarted, setStrokeStarted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    // Wait for modal animation to complete before initializing canvas
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get the actual displayed size
      const rect = canvas.getBoundingClientRect();
      
      // Set canvas internal resolution to match displayed size (1:1 ratio)
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Set drawing styles - white for dark theme, black for light theme
      const isDarkMode = document.documentElement.classList.contains('dark');
      ctx.strokeStyle = isDarkMode ? '#ffffff' : '#000000';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Store context reference
      ctxRef.current = ctx;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawing(false);
      setStrokeStarted(false);
    }, 300); // Wait for animation

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Get coordinates relative to canvas
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  // Handle left click - start a new signature stroke
  const handleLeftClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Start a new stroke
    setStrokeStarted(true);
    setHasDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Handle right click - end the current stroke (lift pen)
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Just stop the current stroke, don't save
    setStrokeStarted(false);
  };

  // Handle mouse move - only draw if stroke has been started
  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Only draw if left click was pressed to start the stroke
    if (!strokeStarted) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Handle mouse leave - stop drawing but keep stroke started
  const handleMouseLeave = () => {
    // Don't end the stroke, just pause drawing
  };

  // Handle mouse enter - continue drawing if stroke was started
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!strokeStarted) return;
    
    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Handle touch start for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;

    setHasDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Handle touch move for mobile
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Handle touch end for mobile
  const handleTouchEnd = () => {
    // Touch ended
  };

  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    setStrokeStarted(false);
  };

  // Save signature
  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
        onClick={onClose}
      />
      
      {/* Draggable Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        drag
        dragMomentum={false}
        dragConstraints={false}
        className="fixed bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
        style={{ 
          top: '10%', 
          left: '5%',
          right: '5%',
          maxWidth: '700px',
          margin: '0 auto',
          zIndex: 99999,
        }}
      >
        {/* Draggable Header */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 cursor-move">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                {label} Signature
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Drag to move</span>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Left Click = Start | Hover = Draw | Right Click = Stop
          </p>
        </div>

        {/* Signature Canvas */}
        <div className="p-4">
          <div className="relative w-full h-[350px] md:h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900/50">
            <canvas
              ref={canvasRef}
              onClick={handleLeftClick}
              onContextMenu={handleRightClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full h-full cursor-crosshair touch-none select-none"
              style={{ touchAction: 'none' }}
            />
            
            {/* Hint Text */}
            {!hasDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 text-center">
                  <Pen className="w-8 h-8 md:w-10 md:h-10" />
                  <span className="text-sm font-medium">Click or touch to start signing</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
          <button
            onClick={clearCanvas}
            disabled={!hasDrawing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eraser className="w-4 h-4" />
            Clear
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveSignature}
              disabled={!hasDrawing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-600 rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </Portal>
  );
}

// Main Signature Pad Component
function SignaturePad({ label, signatureData, onChange }: SignaturePadProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState(signatureData?.name || '');

  const handleSave = (signatureDataUrl: string) => {
    onChange({
      name: name,
      signatureDataUrl: signatureDataUrl,
    });
  };

  const handleRemove = () => {
    onChange({
      name: name,
      signatureDataUrl: null,
    });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    onChange({
      name: newName,
      signatureDataUrl: signatureData?.signatureDataUrl || null,
    });
  };

  const hasSignature = !!signatureData?.signatureDataUrl;
  const signatureDate = hasSignature ? new Date().toLocaleString() : null;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      
      {/* Name Input */}
      <input
        type="text"
        value={name}
        onChange={handleNameChange}
        placeholder="Enter name"
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-400"
      />

      {/* Signature Display or Add Button */}
      <div className="relative">
        {!hasSignature ? (
          // Add Signature Button
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
          >
            <Pen className="w-5 h-5" />
            <span className="font-medium">Add Signature</span>
          </motion.button>
        ) : (
          // Signature Display with Timestamp
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Signed
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {signatureDate}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleRemove}
                className="p-1.5 text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Remove signature"
              >
                <XCircle className="w-5 h-5" />
              </motion.button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
              <img
                src={signatureData?.signatureDataUrl || ''}
                alt="Signature"
                className="h-20 object-contain mx-auto"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        label={label}
      />
    </div>
  );
}

function WorkplaceSafetyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { user } = useAuth();
  const isSupervisorPlus = useHasMinimumRole('SUPERVISOR');

  // Get user's full name
  const userFullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
  
  // State for facility and departments
  const [facilityName, setFacilityName] = useState<string>('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  // State
  const [assessment, setAssessment] = useState<SafetyAssessment>({
    assessmentNumber: `WSA-${format(new Date(), 'yyyyMM')}-001`,
    department: '',
    version: '3/19/25',
    date: format(new Date(), 'yyyy-MM-dd'),
    teamLeaderName: userFullName,
    employeeName: '',
    status: 'DRAFT',
    sections: getInitialSections(),
  });

  // Fetch facility and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [facilitiesRes, departmentsRes] = await Promise.all([
          api.get('/facilities'),
          api.get('/facilities/departments'),
        ]);
        
        // Handle facilities
        const facilitiesData = facilitiesRes.data;
        let facilities: { id: string; name: string }[] = [];
        
        if (Array.isArray(facilitiesData)) {
          facilities = facilitiesData;
        } else if (facilitiesData.data && Array.isArray(facilitiesData.data.Facility)) {
          facilities = facilitiesData.data.Facility;
        } else if (facilitiesData.data && Array.isArray(facilitiesData.data.facilities)) {
          facilities = facilitiesData.data.facilities;
        } else if (facilitiesData.data && Array.isArray(facilitiesData.data)) {
          facilities = facilitiesData.data;
        }
        
        if (facilities.length > 0) {
          setFacilityName(facilities[0].name);
        }
        
        // Handle departments
        const departmentsData = departmentsRes.data.data?.departments || [];
        setDepartments(departmentsData.map((d: any) => ({ id: d.id, name: d.name })));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    fetchData();
  }, []);

  // Fetch active work order template for organization
  useEffect(() => {
    const fetchWorkOrderTemplate = async () => {
      try {
        const response = await api.get('/work-order-templates');
        if (response.data?.success && response.data?.data?.template) {
          setWorkOrderTemplate(response.data.data.template);
        }
      } catch (error) {
        // Template may not exist - that's okay, users can still create work orders manually
        console.log('No work order template found:', error);
      }
    };

    const fetchWorkOrderSettings = async () => {
      try {
        const response = await api.get('/work-order-templates/settings');
        if (response.data?.data?.settings) {
          setWorkOrderSettings(response.data.data.settings);
        }
      } catch (error) {
        console.log('No work order settings found:', error);
      }
    };
    
    fetchWorkOrderTemplate();
    fetchWorkOrderSettings();
  }, []);

  // Load assessment from URL edit parameter
  useEffect(() => {
    const loadAssessmentById = async (id: string) => {
      setLoadingDraft(true);
      try {
        const response = await api.get(`/workplace-safety/${id}`);
        if (response.data?.success && response.data?.data?.assessment) {
          const assessmentData = response.data.data.assessment;
          
          // Get photos from the response and map them by itemId
          const photosFromDb = assessmentData.Photos || [];
          const photosByItemId: Record<string, PhotoAttachment[]> = {};
          
          photosFromDb.forEach((photo: any) => {
            if (photo.itemId) {
              if (!photosByItemId[photo.itemId]) {
                photosByItemId[photo.itemId] = [];
              }
              photosByItemId[photo.itemId].push({
                id: photo.id,
                preview: photo.fileUrl, // Use Firebase URL as preview
                name: photo.fileName,
                fileUrl: photo.fileUrl,
                uploaded: true,
                uploading: false,
              });
            }
          });
          
          // Rebuild sections with icons and photos
          const sectionsWithIcons = getInitialSections().map((initialSection) => {
            const savedSection = assessmentData.Sections?.find(
              (s: any) => s.sectionId === initialSection.id
            );
            if (savedSection) {
              return {
                ...initialSection,
                items: initialSection.items.map((initialItem) => {
                  const savedItem = savedSection.Items?.find(
                    (i: any) => i.itemId === initialItem.id
                  );
                  // Get photos for this item
                  const itemPhotos = photosByItemId[initialItem.id] || [];
                  
                  if (savedItem) {
                    return {
                      ...initialItem,
                      status: savedItem.status,
                      deficiency: savedItem.deficiency,
                      correctiveAction: savedItem.correctiveAction,
                      dynamicEntries: savedItem.dynamicEntries || initialItem.dynamicEntries,
                      workOrderPlaced: savedItem.workOrderPlaced,
                      reportedViaSafetyApp: savedItem.reportedViaSafetyApp,
                      safetyAppReportDate: savedItem.safetyAppReportDate,
                      workOrderDateCreated: savedItem.workOrderDateCreated,
                      workOrderAssignedTo: savedItem.workOrderAssignedTo,
                      workOrderAttachment: savedItem.workOrderAttachment,
                      photos: itemPhotos.length > 0 ? itemPhotos : undefined,
                    };
                  }
                  return {
                    ...initialItem,
                    photos: itemPhotos.length > 0 ? itemPhotos : undefined,
                  };
                }),
              };
            }
            return initialSection;
          });

          setAssessment({
            id: assessmentData.id,
            assessmentNumber: assessmentData.assessmentNumber,
            department: assessmentData.departmentId || '',
            version: assessmentData.version || '3/19/25',
            date: assessmentData.date ? format(new Date(assessmentData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            teamLeaderName: assessmentData.teamLeaderName || userFullName,
            employeeName: assessmentData.employeeName || '',
            status: assessmentData.status || 'DRAFT',
            sections: sectionsWithIcons,
            teamLeaderSignature: assessmentData.teamLeaderSignature ? {
              name: assessmentData.teamLeaderName,
              signatureDataUrl: assessmentData.teamLeaderSignature,
            } : undefined,
            employeeSignature: assessmentData.employeeSignature ? {
              name: assessmentData.employeeName,
              signatureDataUrl: assessmentData.employeeSignature,
            } : undefined,
          });
        }
      } catch (error) {
        console.error('Error loading assessment:', error);
      } finally {
        setLoadingDraft(false);
      }
    };

    if (editId) {
      loadAssessmentById(editId);
    }
  }, [editId, userFullName]);

  // Update teamLeaderName and assessmentNumber when user or facility changes
  useEffect(() => {
    if (userFullName && !assessment.teamLeaderName) {
      setAssessment(prev => ({ ...prev, teamLeaderName: userFullName }));
    }
    // Update assessment number with facility initials
    if (facilityName) {
      // Get initials from facility name (e.g., "MegaMex Foods" -> "MMF")
      const initials = facilityName
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase())
        .join('');
      
      if (!assessment.assessmentNumber.endsWith(`-${initials}`)) {
        setAssessment(prev => ({
          ...prev,
          assessmentNumber: `WSA-${format(new Date(), 'yyyyMM')}-001-${initials}`
        }));
      }
    }
  }, [userFullName, facilityName]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['ppe']));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history' | 'view'>('form');
  const [showIncompleteDropdown, setShowIncompleteDropdown] = useState(false);
  const incompleteDropdownRef = useRef<HTMLDivElement>(null);
  const [savedAssessments, setSavedAssessments] = useState<SafetyAssessment[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; assessment: any; index: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ assessment: any } | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  
  // Track photos that need to be saved to database (uploaded before assessment had an ID)
  const pendingPhotosSaveRef = useRef<Array<{
    photoId: string;
    sectionId: string;
    itemId: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }>>([]);

  // Close incomplete dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (incompleteDropdownRef.current && !incompleteDropdownRef.current.contains(e.target as Node)) {
        setShowIncompleteDropdown(false);
      }
    };
    if (showIncompleteDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showIncompleteDropdown]);

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const closeOnScroll = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [contextMenu]);

  // Load full report for viewing
  const loadReportForViewing = useCallback(async (assessmentNumber: string) => {
    setLoadingReport(true);
    try {
      const response = await api.get(`/workplace-safety/view/${encodeURIComponent(assessmentNumber)}`);
      const { assessment: loadedAssessment } = response.data?.data || {};
      
      if (loadedAssessment) {
        // Map the sections with item details
        const mappedSections = getInitialSections().map((section) => {
          const loadedSection = loadedAssessment.Sections?.find((s: any) => s.sectionId === section.id);
          if (loadedSection) {
            return {
              ...section,
              items: section.items.map((item) => {
                const loadedItem = loadedSection.Items?.find((i: any) => i.itemId === item.id);
                if (loadedItem) {
                  return {
                    ...item,
                    status: loadedItem.status as 'A' | 'U' | 'NA' | null,
                    deficiency: loadedItem.deficiency || undefined,
                    correctiveAction: loadedItem.correctiveAction || undefined,
                    photos: loadedItem.Photos?.map((photo: any) => ({
                      id: photo.id,
                      name: photo.fileName,
                      fileUrl: photo.fileUrl,
                      preview: photo.fileUrl,
                    })) || [],
                  };
                }
                return item;
              }),
            };
          }
          return section;
        });

        setViewReportData({
          ...loadedAssessment,
          sections: mappedSections,
        });
        setActiveTab('view'); // Switch to view tab
      }
    } catch (error) {
      console.error('Error loading report:', error);
      setShowToast({ type: 'error', message: 'Failed to load report' });
    } finally {
      setLoadingReport(false);
    }
  }, []);

  // Row click handler — view or select depending on mode
  const handleRowClick = useCallback((assessment: any, index: number, e: React.MouseEvent) => {
    if (selectionMode) {
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (e.shiftKey && lastSelectedIndexRef.current !== null) {
          const start = Math.min(lastSelectedIndexRef.current, index);
          const end = Math.max(lastSelectedIndexRef.current, index);
          for (let i = start; i <= end; i++) {
            next.add(savedAssessments[i]?.id);
          }
        } else {
          if (next.has(assessment.id)) {
            next.delete(assessment.id);
          } else {
            next.add(assessment.id);
          }
          lastSelectedIndexRef.current = index;
        }
        return next;
      });
    } else {
      loadReportForViewing(assessment.assessmentNumber);
    }
  }, [selectionMode, savedAssessments, loadReportForViewing]);

  // Right-click context menu handler
  const handleRowContextMenu = useCallback((e: React.MouseEvent, assessment: any, index: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, assessment, index });
  }, []);

  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedRows(new Set());
    lastSelectedIndexRef.current = null;
  }, []);

  // Delete assessment handler
  const handleDeleteAssessment = useCallback(async () => {
    if (!deleteConfirm || deleteInput !== deleteConfirm.assessment.assessmentNumber) return;
    setDeleting(true);
    try {
      await api.delete(`/workplace-safety/${deleteConfirm.assessment.id}`, {
        data: { confirmNumber: deleteInput },
      });
      setShowToast({ type: 'success', message: `Assessment ${deleteConfirm.assessment.assessmentNumber} permanently deleted` });
      setDeleteConfirm(null);
      setDeleteInput('');
      // Refresh history
      setSavedAssessments(prev => prev.filter(a => a.id !== deleteConfirm.assessment.id));
    } catch (error: any) {
      console.error('Error deleting assessment:', error);
      setShowToast({ type: 'error', message: error?.response?.data?.error || 'Failed to delete assessment' });
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirm, deleteInput]);

  // Edit assessment handler — navigate to form tab with edit param
  const handleEditAssessment = useCallback((assessment: any) => {
    window.history.replaceState(null, '', `/workplace-safety?edit=${assessment.id}`);
    window.location.reload();
  }, []);
  
  const [completionStats, setCompletionStats] = useState<{
    totalItems: number;
    completedItems: number;
    pendingItems: number;
    completionPercentage: number;
    incompleteSections: { id: string; title: string; totalItems: number; completedItems: number; pendingItemIds: string[] }[];
    unacceptableCount: number;
  } | null>(null);
  const assessmentNumberRef = useRef<string>('');
  
  // Auto-save state
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('workplace-safety-autosave-enabled');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  
  // View Report Modal State
  const [viewReportData, setViewReportData] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const reportPrintRef = useRef<HTMLDivElement>(null);

  // Work Order Template State (for download modal)
  const [workOrderTemplate, setWorkOrderTemplate] = useState<{
    id: string;
    name: string;
    fileName: string;
    fileUrl: string;
    description: string | null;
  } | null>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadModalContext, setDownloadModalContext] = useState<{
    sectionId: string;
    itemId: string;
    itemDescription: string;
  }>({ sectionId: '', itemId: '', itemDescription: '' });
  const [noTemplateModalOpen, setNoTemplateModalOpen] = useState(false);

  // Work Order Settings State
  const [workOrderSettings, setWorkOrderSettings] = useState({
    enableInAppForm: true,
    enableTemplateDownload: false,
    preferredOption: 'form',
    formTitle: 'Maintenance Work Order Request',
  });

  // Work Order Form Modal State
  const [workOrderFormModalOpen, setWorkOrderFormModalOpen] = useState(false);
  const [workOrderFormContext, setWorkOrderFormContext] = useState<{
    sectionId: string;
    itemId: string;
    itemDescription: string;
  }>({ sectionId: '', itemId: '', itemDescription: '' });
  const [workOrderFormData, setWorkOrderFormData] = useState({
    requestor: '',
    department: '',
    dateOfRequest: format(new Date(), 'yyyy-MM-dd'),
    type: '' as '' | 'Repair' | 'Modify' | 'PMD',
    class: '' as '' | 'Fabrication' | 'Safety' | 'Ergonomics' | 'Equipment' | 'USDA' | 'QA' | 'Other',
    priority: '' as '' | '1' | '2' | '3',
    equipmentNameNumber: '',
    natureOfProblem: '',
  });
  const [workOrderFormDragging, setWorkOrderFormDragging] = useState(false);
  const [workOrderFormPosition, setWorkOrderFormPosition] = useState({ x: 0, y: 0 });
  const [workOrderFormScale, setWorkOrderFormScale] = useState(1);
  const workOrderFormDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Global mouse event handlers for smooth dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (workOrderFormDragging && workOrderFormDragRef.current) {
        const deltaX = e.clientX - workOrderFormDragRef.current.startX;
        const deltaY = e.clientY - workOrderFormDragRef.current.startY;
        setWorkOrderFormPosition({
          x: workOrderFormDragRef.current.initialX + deltaX,
          y: workOrderFormDragRef.current.initialY + deltaY,
        });
      }
    };

    const handleMouseUp = () => {
      setWorkOrderFormDragging(false);
    };

    if (workOrderFormDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [workOrderFormDragging]);

  // Calculate statistics
  const stats = assessment.sections.reduce(
    (acc, section) => {
      section.items.forEach((item) => {
        acc.total++;
        if (item.status === 'A') acc.acceptable++;
        else if (item.status === 'U') acc.unacceptable++;
        else if (item.status === 'NA') acc.na++;
        else acc.pending++;
      });
      return acc;
    },
    { total: 0, acceptable: 0, unacceptable: 0, na: 0, pending: 0 }
  );

  const completionPercentage = Math.round(((stats.total - stats.pending) / stats.total) * 100) || 0;

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Update item status
  const updateItemStatus = (sectionId: string, itemId: string, status: 'A' | 'U' | 'NA') => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, status } : item
              ),
            }
          : section
      ),
    }));
  };

  // Update deficiency
  const updateDeficiency = (sectionId: string, itemId: string, deficiency: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, deficiency } : item
              ),
            }
          : section
      ),
    }));
  };

  // Update corrective action
  const updateCorrectiveAction = (sectionId: string, itemId: string, correctiveAction: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, correctiveAction } : item
              ),
            }
          : section
      ),
    }));
  };

  // Update work order placed status
  const updateWorkOrderPlaced = (sectionId: string, itemId: string, workOrderPlaced: boolean) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId 
                  ? { 
                      ...item, 
                      workOrderPlaced,
                      // Reset related fields when unchecked
                      ...(workOrderPlaced ? {} : {
                        reportedViaSafetyApp: false,
                        safetyAppReportDate: undefined,
                        workOrderDateCreated: undefined,
                        workOrderAssignedTo: undefined,
                        workOrderAttachment: undefined,
                      })
                    } 
                  : item
              ),
            }
          : section
      ),
    }));
  };

  // Update reported via safety app status
  const updateReportedViaSafetyApp = (sectionId: string, itemId: string, reportedViaSafetyApp: boolean) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId 
                  ? { 
                      ...item, 
                      reportedViaSafetyApp,
                      // Reset other work order fields when switching to safety app
                      ...(reportedViaSafetyApp ? {
                        workOrderDateCreated: undefined,
                        workOrderAssignedTo: undefined,
                        workOrderAttachment: undefined,
                      } : {
                        safetyAppReportDate: undefined,
                      })
                    } 
                  : item
              ),
            }
          : section
      ),
    }));
  };

  // Update safety app report date
  const updateSafetyAppReportDate = (sectionId: string, itemId: string, safetyAppReportDate: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, safetyAppReportDate } : item
              ),
            }
          : section
      ),
    }));
  };

  // Update work order date created
  const updateWorkOrderDateCreated = (sectionId: string, itemId: string, workOrderDateCreated: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, workOrderDateCreated } : item
              ),
            }
          : section
      ),
    }));
  };

  // Update work order assigned to
  const updateWorkOrderAssignedTo = (sectionId: string, itemId: string, workOrderAssignedTo: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, workOrderAssignedTo } : item
              ),
            }
          : section
      ),
    }));
  };

  // Handle work order attachment upload
  const handleWorkOrderAttachment = async (sectionId: string, itemId: string, file: File) => {
    // Find item description
    const section = assessment.sections.find(s => s.id === sectionId);
    const item = section?.items.find(i => i.id === itemId);
    const itemDescription = item?.description || '';

    // First, set the file locally
    const attachment = {
      id: `wo-${Date.now()}`,
      name: file.name,
      file,
    };

    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((i) =>
                i.id === itemId ? { ...i, workOrderAttachment: attachment } : i
              ),
            }
          : s
      ),
    }));

    // Upload to Firebase
    try {
      const fileName = `workplace-safety/${assessment.assessmentNumber}/work-orders/${itemId}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        () => {},
        (error) => {
          console.error('Work order attachment upload error:', error);
          setShowToast({ type: 'error', message: 'Failed to upload attachment' });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setAssessment((prev) => ({
            ...prev,
            sections: prev.sections.map((s) =>
              s.id === sectionId
                ? {
                    ...s,
                    items: s.items.map((i) =>
                      i.id === itemId 
                        ? { 
                            ...i, 
                            workOrderAttachment: { 
                              ...i.workOrderAttachment!, 
                              fileUrl: downloadURL 
                            } 
                          } 
                        : i
                    ),
                  }
                : s
            ),
          }));

          // Create WorkOrder record in backend for uploaded file
          if (assessment.id) {
            try {
              const token = await getIdToken(auth.currentUser!);
              await fetch(`${API_BASE}/work-orders/uploaded`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  assessmentId: assessment.id,
                  assessmentNumber: assessment.assessmentNumber,
                  sectionId,
                  itemId,
                  itemDescription,
                  fileName: file.name,
                  fileUrl: downloadURL,
                  fileSize: file.size,
                }),
              });
              console.log('Work order record created for uploaded file');
            } catch (error) {
              console.error('Failed to create work order record:', error);
            }
          }
        }
      );
    } catch (error) {
      console.error('Work order attachment upload error:', error);
    }
  };

  // Remove work order attachment
  const removeWorkOrderAttachment = (sectionId: string, itemId: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, workOrderAttachment: undefined } : item
              ),
            }
          : section
      ),
    }));
  };

  // Rename work order attachment
  const renameWorkOrderAttachment = (sectionId: string, itemId: string, newName: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId && item.workOrderAttachment
                  ? { ...item, workOrderAttachment: { ...item.workOrderAttachment, name: newName } }
                  : item
              ),
            }
          : section
      ),
    }));
  };

  // Add dynamic entry for special lockout items
  const addDynamicEntry = (sectionId: string, itemId: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) => {
                if (item.id === itemId && item.dynamicEntries) {
                  const newEntry: DynamicEntry = {
                    id: `entry-${Date.now()}`,
                    employeeName: (item.id === 'lockout-5' || item.id === 'eap-1') ? '' : undefined,
                    equipmentName: (item.id === 'lockout-5' || item.id === 'lockout-6' || item.id === 'mg-7') ? '' : undefined,
                  };
                  return {
                    ...item,
                    dynamicEntries: [...item.dynamicEntries, newEntry],
                  };
                }
                return item;
              }),
            }
          : section
      ),
    }));
  };

  // Remove dynamic entry
  const removeDynamicEntry = (sectionId: string, itemId: string, entryId: string) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) => {
                if (item.id === itemId && item.dynamicEntries) {
                  return {
                    ...item,
                    dynamicEntries: item.dynamicEntries.filter((e) => e.id !== entryId),
                  };
                }
                return item;
              }),
            }
          : section
      ),
    }));
  };

  // Upload photo to Firebase Storage
  const uploadPhotoToFirebase = async (file: File, assessmentNumber: string, itemId: string): Promise<string> => {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `workplace-safety/${assessmentNumber}/${itemId}/${timestamp}_${sanitizedFileName}`;
    
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress tracking if needed
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload progress: ${progress.toFixed(0)}%`);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  };

  // Add photo to item and immediately upload to Firebase
  const addPhoto = async (sectionId: string, itemId: string, file: File) => {
    const photoId = `photo-${Date.now()}`;
    
    // Create preview and add photo in uploading state
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto: PhotoAttachment = {
        id: photoId,
        file,
        preview: reader.result as string,
        name: file.name,
        uploading: true,
        uploaded: false,
      };
      setAssessment((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                items: section.items.map((item) =>
                  item.id === itemId
                    ? { ...item, photos: [...(item.photos || []), newPhoto] }
                    : item
                ),
              }
            : section
        ),
      }));
    };
    reader.readAsDataURL(file);

    // Upload to Firebase
    try {
      const fileUrl = await uploadPhotoToFirebase(file, assessment.assessmentNumber, itemId);
      
      // Update photo with Firebase URL
      setAssessment((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                items: section.items.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        photos: item.photos?.map((p) =>
                          p.id === photoId
                            ? { ...p, fileUrl, uploading: false, uploaded: true }
                            : p
                        ),
                      }
                    : item
                ),
              }
            : section
        ),
      }));

      // Save to database if assessment has an ID, otherwise queue for later
      if (assessment.id) {
        console.log('📸 Saving photo to database immediately (assessment has ID)');
        await api.post(`/workplace-safety/${assessment.id}/photos`, {
          fileName: file.name,
          fileUrl,
          fileSize: file.size,
          mimeType: file.type,
          itemId,
          sectionId,
        });
        console.log('✅ Photo saved to database');
      } else {
        // Queue photo for saving when assessment gets an ID
        console.log('📸 Queuing photo for later save (no assessment ID yet)');
        pendingPhotosSaveRef.current.push({
          photoId,
          sectionId,
          itemId,
          fileName: file.name,
          fileUrl,
          fileSize: file.size,
          mimeType: file.type,
        });
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      // Mark photo as failed
      setAssessment((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                items: section.items.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        photos: item.photos?.filter((p) => p.id !== photoId),
                      }
                    : item
                ),
              }
            : section
        ),
      }));
      setShowToast({ type: 'error', message: 'Failed to upload photo. Please try again.' });
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  // Sync pending photos to database when assessment ID becomes available
  const syncPendingPhotos = useCallback(async (assessmentId: string) => {
    if (pendingPhotosSaveRef.current.length === 0) return;
    
    console.log(`📸 Syncing ${pendingPhotosSaveRef.current.length} pending photos to database`);
    
    const photosToSave = [...pendingPhotosSaveRef.current];
    pendingPhotosSaveRef.current = [];
    
    for (const photo of photosToSave) {
      try {
        await api.post(`/workplace-safety/${assessmentId}/photos`, {
          fileName: photo.fileName,
          fileUrl: photo.fileUrl,
          fileSize: photo.fileSize,
          mimeType: photo.mimeType,
          itemId: photo.itemId,
          sectionId: photo.sectionId,
        });
        console.log(`✅ Synced photo ${photo.fileName} to database`);
      } catch (error) {
        console.error(`❌ Failed to sync photo ${photo.fileName}:`, error);
        // Re-queue failed photos
        pendingPhotosSaveRef.current.push(photo);
      }
    }
  }, []);

  // Remove photo from item
  const removePhoto = async (sectionId: string, itemId: string, photoId: string) => {
    // Get the photo to check if it has a database ID
    const photo = assessment.sections
      .find(s => s.id === sectionId)?.items
      .find(i => i.id === itemId)?.photos
      ?.find(p => p.id === photoId);
    
    // Remove from local state
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? { ...item, photos: item.photos?.filter((p) => p.id !== photoId) || [] }
                  : item
              ),
            }
          : section
      ),
    }));
    
    // Also remove from pending queue if exists
    pendingPhotosSaveRef.current = pendingPhotosSaveRef.current.filter(p => p.photoId !== photoId);
    
    // If photo has database ID and assessment has ID, delete from database
    if (assessment.id && photo && !photoId.startsWith('photo-')) {
      try {
        await api.delete(`/workplace-safety/${assessment.id}/photos/${photoId}`);
        console.log('✅ Photo deleted from database');
      } catch (error) {
        console.error('❌ Failed to delete photo from database:', error);
      }
    }
  };

  // Update dynamic entry
  const updateDynamicEntry = (
    sectionId: string,
    itemId: string,
    entryId: string,
    field: 'employeeName' | 'equipmentName',
    value: string
  ) => {
    setAssessment((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) => {
                if (item.id === itemId && item.dynamicEntries) {
                  return {
                    ...item,
                    dynamicEntries: item.dynamicEntries.map((entry) =>
                      entry.id === entryId ? { ...entry, [field]: value } : entry
                    ),
                  };
                }
                return item;
              }),
            }
          : section
      ),
    }));
  };

  // Save assessment
  const handleSave = async () => {
    setSaving(true);
    try {
      // Prepare sections data for API (remove icon and file objects)
      const sectionsData = assessment.sections.map((section) => ({
        id: section.id,
        title: section.title,
        items: section.items.map((item) => ({
          id: item.id,
          description: item.description,
          status: item.status,
          deficiency: item.deficiency,
          correctiveAction: item.correctiveAction,
          dynamicEntries: item.dynamicEntries,
          workOrderPlaced: item.workOrderPlaced,
          reportedViaSafetyApp: item.reportedViaSafetyApp,
          safetyAppReportDate: item.safetyAppReportDate,
          workOrderDateCreated: item.workOrderDateCreated,
          workOrderAssignedTo: item.workOrderAssignedTo,
          workOrderAttachment: item.workOrderAttachment ? {
            id: item.workOrderAttachment.id,
            name: item.workOrderAttachment.name,
            fileUrl: item.workOrderAttachment.fileUrl,
          } : undefined,
          // Don't include photos - they're uploaded separately
        })),
      }));

      // Prepare signatures
      const signatureData: Record<string, string | undefined> = {};
      if (assessment.teamLeaderSignature?.signatureDataUrl) {
        signatureData.teamLeaderSignature = assessment.teamLeaderSignature.signatureDataUrl;
      }
      if (assessment.employeeSignature?.signatureDataUrl) {
        signatureData.employeeSignature = assessment.employeeSignature.signatureDataUrl;
      }
      if (assessment.operationManagerSignature?.signatureDataUrl) {
        signatureData.operationManagerSignature = assessment.operationManagerSignature.signatureDataUrl;
      }
      if (assessment.plantManagerSignature?.signatureDataUrl) {
        signatureData.plantManagerSignature = assessment.plantManagerSignature.signatureDataUrl;
      }
      if (assessment.safetyManagerSignature?.signatureDataUrl) {
        signatureData.safetyManagerSignature = assessment.safetyManagerSignature.signatureDataUrl;
      }

      const payload = {
        assessmentNumber: assessment.assessmentNumber,
        version: assessment.version,
        date: assessment.date,
        departmentId: assessment.department, // This is the UUID from the select
        teamLeaderName: assessment.teamLeaderName,
        employeeName: assessment.employeeName,
        ...signatureData,
        sections: sectionsData,
      };

      console.log('💾 Saving assessment with payload:', JSON.stringify(payload, null, 2));

      let response;
      if (assessment.id) {
        // Update existing assessment
        response = await api.put(`/workplace-safety/${assessment.id}`, payload);
      } else {
        // Create new assessment - backend will auto-update if draft already exists
        response = await api.post('/workplace-safety', payload);
        // Update local state with the new ID and update URL
        if (response.data?.data?.assessment?.id) {
          const newId = response.data.data.assessment.id;
          setAssessment((prev) => ({
            ...prev,
            id: newId,
          }));
          // Update URL so refresh loads the draft
          window.history.replaceState(null, '', `/workplace-safety?edit=${newId}`);
          // Sync any pending photos that were uploaded before the assessment had an ID
          await syncPendingPhotos(newId);
        }
      }
      
      // Show appropriate message based on whether it was an update or create
      const isUpdate = response.data?.isUpdate || assessment.id;
      setShowToast({ 
        type: 'success', 
        message: isUpdate ? 'Draft assessment updated!' : 'Assessment saved as draft!' 
      });
    } catch (error: any) {
      console.error('Error saving assessment:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save assessment. Please try again.';
      setShowToast({ type: 'error', message: errorMessage });
    } finally {
      setSaving(false);
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  // Submit assessment
  const handleSubmit = async () => {
    if (stats.pending > 0) {
      setShowToast({ type: 'error', message: 'Please complete all items before submitting.' });
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    // First save the assessment if not already saved
    if (!assessment.id) {
      await handleSave();
      // Wait a bit for the ID to be set
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!assessment.id) {
      setShowToast({ type: 'error', message: 'Please save the assessment first.' });
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/workplace-safety/${assessment.id}/submit`);
      
      setAssessment((prev) => ({ ...prev, status: 'SUBMITTED' }));
      setShowToast({ type: 'success', message: 'Assessment submitted successfully!' });
    } catch (error) {
      console.error('Error submitting assessment:', error);
      setShowToast({ type: 'error', message: 'Failed to submit assessment. Please try again.' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  // Load assessment history
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('/workplace-safety');
      const assessments = response.data?.data?.assessments || [];
      setSavedAssessments(assessments);
    } catch (error) {
      console.error('Error loading history:', error);
      setSavedAssessments([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Print report
  const handlePrintReport = () => {
    if (reportPrintRef.current && viewReportData) {
      // Calculate stats
      const stats = viewReportData.sections?.reduce((acc: any, section: any) => {
        section.items.forEach((item: any) => {
          if (item.status === 'A') acc.acceptable++;
          else if (item.status === 'U') acc.unacceptable++;
          else if (item.status === 'NA') acc.na++;
        });
        return acc;
      }, { acceptable: 0, unacceptable: 0, na: 0 }) || { acceptable: 0, unacceptable: 0, na: 0 };

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>WSA - ${viewReportData?.assessmentNumber}</title>
            <style>
              @page { margin: 0.5in 0.4in 0.3in 0.4in; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body { height: auto; }
              body { font-family: Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.4; }
              
              .header { border-bottom: 3px solid #059669; padding-bottom: 12px; margin-bottom: 12px; }
              .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
              .title { font-size: 18px; font-weight: bold; color: #059669; }
              .subtitle { font-size: 10px; color: #666; margin-top: 2px; }
              .report-id { text-align: right; }
              .report-num { font-size: 12px; font-weight: bold; background: #059669; color: white; padding: 4px 10px; border-radius: 4px; display: inline-block; }
              .report-date { font-size: 10px; color: #666; margin-top: 4px; }
              
              .stats-row { display: flex; gap: 8px; margin-bottom: 12px; }
              .stat-box { flex: 1; text-align: center; padding: 8px; border-radius: 6px; }
              .stat-box.green { background: #d1fae5; }
              .stat-box.red { background: #fee2e2; }
              .stat-box.gray { background: #f3f4f6; }
              .stat-num { font-size: 20px; font-weight: bold; }
              .stat-box.green .stat-num { color: #059669; }
              .stat-box.red .stat-num { color: #dc2626; }
              .stat-box.gray .stat-num { color: #6b7280; }
              .stat-lbl { font-size: 8px; text-transform: uppercase; color: #666; margin-top: 2px; }
              
              .info-row { display: flex; gap: 8px; margin-bottom: 12px; padding: 8px; background: #f9fafb; border-radius: 6px; }
              .info-box { flex: 1; }
              .info-lbl { font-size: 8px; text-transform: uppercase; color: #888; }
              .info-val { font-size: 11px; font-weight: 600; }
              
              .section { margin-bottom: 10px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
              .sec-title { font-size: 10px; font-weight: bold; text-transform: uppercase; background: #1f2937; color: white; padding: 6px 10px; }
              .sec-content { padding: 0; }
              
              .item { padding: 6px 10px; border-bottom: 1px solid #eee; display: flex; align-items: flex-start; gap: 8px; }
              .item:last-child { border-bottom: none; }
              .item-num { font-size: 9px; color: #999; min-width: 16px; padding-top: 2px; }
              .item-body { flex: 1; }
              .item-desc { font-size: 10px; margin-bottom: 4px; }
              .badge { display: inline-block; font-size: 8px; font-weight: bold; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; }
              .badge-a { background: #d1fae5; color: #059669; }
              .badge-u { background: #fee2e2; color: #dc2626; }
              .badge-na { background: #e5e7eb; color: #6b7280; }
              
              .issue { margin-top: 6px; padding: 6px 8px; border-radius: 4px; font-size: 9px; }
              .issue-def { background: #fef3c7; border-left: 2px solid #f59e0b; }
              .issue-cor { background: #dbeafe; border-left: 2px solid #3b82f6; }
              .issue-lbl { font-weight: bold; font-size: 8px; text-transform: uppercase; margin-bottom: 2px; }
              .issue-def .issue-lbl { color: #b45309; }
              .issue-cor .issue-lbl { color: #1d4ed8; }
              
              .photos { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
              .photo { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 2px solid #ddd; }
              
              .sigs { margin-top: 12px; padding-top: 10px; border-top: 2px solid #ddd; }
              .sigs-title { font-size: 11px; font-weight: bold; margin-bottom: 8px; }
              .sigs-grid { display: flex; gap: 8px; }
              .sig-box { flex: 1; text-align: center; padding: 10px 6px; border: 1px dashed #ccc; border-radius: 6px; background: #fafafa; }
              .sig-lbl { font-size: 8px; text-transform: uppercase; color: #666; margin-bottom: 6px; }
              .sig-line { height: 30px; display: flex; align-items: center; justify-content: center; }
              .sig-name { font-size: 9px; font-weight: 600; margin-top: 4px; }
              .not-signed { font-size: 9px; color: #aaa; font-style: italic; }
              
              .footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #eee; text-align: center; font-size: 8px; color: #999; display: flex; justify-content: space-between; align-items: center; }
              .footer-left { text-align: left; }
              .footer-center { text-align: center; flex: 1; }
              .footer-right { text-align: right; }
              
              @media print {
                html, body { height: auto !important; overflow: visible !important; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .footer { margin-bottom: 0; padding-bottom: 0; position: fixed; bottom: 0; left: 0; right: 0; background: white; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="header-top">
                <div>
                  <div class="title">Workplace Safety Assessment</div>
                  <div class="subtitle">Monthly Departmental Safety Assessment</div>
                </div>
                <div class="report-id">
                  <div class="report-num">${viewReportData.assessmentNumber}</div>
                  <div class="report-date">${format(new Date(viewReportData.createdAt), 'MMM d, yyyy')}</div>
                </div>
              </div>
            </div>
            
            <div class="stats-row">
              <div class="stat-box green"><div class="stat-num">${stats.acceptable}</div><div class="stat-lbl">Acceptable</div></div>
              <div class="stat-box red"><div class="stat-num">${stats.unacceptable}</div><div class="stat-lbl">Unacceptable</div></div>
              <div class="stat-box gray"><div class="stat-num">${stats.na}</div><div class="stat-lbl">N/A</div></div>
            </div>
            
            <div class="info-row">
              <div class="info-box"><div class="info-lbl">Status</div><div class="info-val">${viewReportData.status}</div></div>
              <div class="info-box"><div class="info-lbl">Team Leader</div><div class="info-val">${viewReportData.teamLeaderName || '-'}</div></div>
              <div class="info-box"><div class="info-lbl">Department</div><div class="info-val">${viewReportData.Department?.name || '-'}</div></div>
              <div class="info-box"><div class="info-lbl">Employee</div><div class="info-val">${viewReportData.employeeName || '-'}</div></div>
            </div>
            
            ${viewReportData.sections?.map((section: any) => {
              const items = section.items.filter((item: any) => item.status);
              if (items.length === 0) return '';
              return `
                <div class="section">
                  <div class="sec-title">${section.title}</div>
                  <div class="sec-content">
                    ${items.map((item: any, idx: number) => `
                      <div class="item">
                        <div class="item-num">${idx + 1}.</div>
                        <div class="item-body">
                          <div class="item-desc">${item.description}</div>
                          <span class="badge badge-${item.status.toLowerCase()}">${item.status === 'A' ? 'Acceptable' : item.status === 'U' ? 'Unacceptable' : 'N/A'}</span>
                          ${item.status === 'U' && item.deficiency ? `<div class="issue issue-def"><div class="issue-lbl">Deficiency</div>${item.deficiency}</div>` : ''}
                          ${item.status === 'U' && item.correctiveAction ? `<div class="issue issue-cor"><div class="issue-lbl">Corrective Action</div>${item.correctiveAction}</div>` : ''}
                          ${item.photos?.length > 0 ? `<div class="photos">${item.photos.map((p: any) => `<img src="${p.fileUrl}" class="photo"/>`).join('')}</div>` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
            
            <div class="sigs">
              <div class="sigs-title">Signatures</div>
              <div class="sigs-grid">
                <div class="sig-box">
                  <div class="sig-lbl">Team Leader</div>
                  <div class="sig-line">${viewReportData.teamLeaderSignature ? `<img src="${viewReportData.teamLeaderSignature}" style="max-height:28px"/>` : '<span class="not-signed">Not signed</span>'}</div>
                  ${viewReportData.teamLeaderName ? `<div class="sig-name">${viewReportData.teamLeaderName}</div>` : ''}
                </div>
                <div class="sig-box">
                  <div class="sig-lbl">Employee</div>
                  <div class="sig-line">${viewReportData.employeeSignature ? `<img src="${viewReportData.employeeSignature}" style="max-height:28px"/>` : '<span class="not-signed">Not signed</span>'}</div>
                  ${viewReportData.employeeName ? `<div class="sig-name">${viewReportData.employeeName}</div>` : ''}
                </div>
                <div class="sig-box">
                  <div class="sig-lbl">Operation Mgr</div>
                  <div class="sig-line">${viewReportData.operationManagerSignature ? `<img src="${viewReportData.operationManagerSignature}" style="max-height:28px"/>` : '<span class="not-signed">Not signed</span>'}</div>
                </div>
                <div class="sig-box">
                  <div class="sig-lbl">Safety Mgr</div>
                  <div class="sig-line">${viewReportData.safetyManagerSignature ? `<img src="${viewReportData.safetyManagerSignature}" style="max-height:28px"/>` : '<span class="not-signed">Not signed</span>'}</div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-left">${viewReportData.Facility?.name || viewReportData.Organization?.name || '-'}</div>
              <div class="footer-center">Generated ${format(new Date(), 'MMM d, yyyy h:mm a')} • DashMet RCA Engine</div>
              <div class="footer-right">${viewReportData.assessmentNumber}</div>
            </div>
          </body>
        </html>
      `;

      // Create a hidden iframe for printing (no visible about:blank page)
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(printContent);
        frameDoc.close();

        // Wait for images to load then print
        const images = frameDoc.getElementsByTagName('img');
        const imagePromises = Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        });

        Promise.all(imagePromises).then(() => {
          setTimeout(() => {
            printFrame.contentWindow?.print();
            // Remove iframe after printing
            setTimeout(() => {
              document.body.removeChild(printFrame);
            }, 1000);
          }, 300);
        });
      }
    }
  };
  // Download report as PDF (using print to PDF)
  const handleDownloadReport = () => {
    handlePrintReport();
  };

  // Load draft assessment by assessment number
  const loadDraftByAssessmentNumber = useCallback(async (assessmentNumber: string) => {
    if (!assessmentNumber || assessmentNumber.length < 5) {
      return; // Don't search for very short assessment numbers
    }

    // Prevent duplicate requests for the same assessment number
    if (assessmentNumberRef.current === assessmentNumber) {
      return;
    }
    assessmentNumberRef.current = assessmentNumber;

    setLoadingDraft(true);
    setDraftLoadError(null);

    try {
      const response = await api.get(`/workplace-safety/by-number/${encodeURIComponent(assessmentNumber)}`);
      const { assessment: loadedAssessment, completionStats: stats } = response.data?.data || {};

      if (loadedAssessment) {
        // Map the loaded assessment back to the local state format
        const mappedSections = getInitialSections().map((section) => {
          const loadedSection = loadedAssessment.Sections?.find((s: any) => s.sectionId === section.id);
          if (loadedSection) {
            return {
              ...section,
              items: section.items.map((item) => {
                const loadedItem = loadedSection.Items?.find((i: any) => i.itemId === item.id);
                if (loadedItem) {
                  return {
                    ...item,
                    status: loadedItem.status as 'A' | 'U' | 'NA' | null,
                    deficiency: loadedItem.deficiency || undefined,
                    correctiveAction: loadedItem.correctiveAction || undefined,
                    dynamicEntries: loadedItem.dynamicEntries || item.dynamicEntries,
                  };
                }
                return item;
              }),
            };
          }
          return section;
        });

        setAssessment({
          id: loadedAssessment.id,
          assessmentNumber: loadedAssessment.assessmentNumber,
          department: loadedAssessment.department || '',
          version: loadedAssessment.version || '3/19/25',
          date: loadedAssessment.date ? format(new Date(loadedAssessment.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          teamLeaderName: loadedAssessment.teamLeaderName || userFullName,
          teamLeaderSignature: loadedAssessment.teamLeaderSignature 
            ? { name: loadedAssessment.teamLeaderName || '', signatureDataUrl: loadedAssessment.teamLeaderSignature }
            : undefined,
          employeeName: loadedAssessment.employeeName || '',
          employeeSignature: loadedAssessment.employeeSignature
            ? { name: loadedAssessment.employeeName || '', signatureDataUrl: loadedAssessment.employeeSignature }
            : undefined,
          operationManagerSignature: loadedAssessment.operationManagerSignature
            ? { name: loadedAssessment.operationManagerName || '', signatureDataUrl: loadedAssessment.operationManagerSignature }
            : undefined,
          plantManagerSignature: loadedAssessment.plantManagerSignature
            ? { name: loadedAssessment.plantManagerName || '', signatureDataUrl: loadedAssessment.plantManagerSignature }
            : undefined,
          safetyManagerSignature: loadedAssessment.safetyManagerSignature
            ? { name: loadedAssessment.safetyManagerName || '', signatureDataUrl: loadedAssessment.safetyManagerSignature }
            : undefined,
          status: loadedAssessment.status || 'DRAFT',
          sections: mappedSections,
          createdAt: loadedAssessment.createdAt,
          updatedAt: loadedAssessment.updatedAt,
        });

        setCompletionStats(stats);

        // Show feedback to user
        if (stats && stats.pendingItems > 0) {
          setShowToast({ 
            type: 'success', 
            message: `Draft loaded: ${stats.completionPercentage}% complete (${stats.pendingItems} items remaining)` 
          });
        } else {
          setShowToast({ type: 'success', message: 'Draft assessment loaded successfully!' });
        }
        setTimeout(() => setShowToast(null), 4000);
      }
    } catch (error: any) {
      console.error('Error loading draft:', error);
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      if (status === 400 && errorData?.status) {
        // Assessment exists but is submitted
        setDraftLoadError(`This assessment has been ${errorData.status.toLowerCase()} and cannot be edited.`);
        setShowToast({ type: 'error', message: errorData.details || 'Assessment already submitted' });
        setTimeout(() => setShowToast(null), 5000);
      } else if (status === 404) {
        // No draft found - this is OK, user can create new
        setDraftLoadError(null);
        // Reset to allow creating a new assessment
        assessmentNumberRef.current = '';
      } else {
        // Other error
        setDraftLoadError('Failed to check for existing draft');
      }
    } finally {
      setLoadingDraft(false);
    }
  }, [userFullName]);

  // Handle assessment number change with debounce
  const handleAssessmentNumberChange = useCallback((newAssessmentNumber: string) => {
    setAssessment(prev => ({ ...prev, assessmentNumber: newAssessmentNumber }));
    setDraftLoadError(null);
    
    // Debounce the API call
    const timeoutId = setTimeout(() => {
      loadDraftByAssessmentNumber(newAssessmentNumber);
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [loadDraftByAssessmentNumber]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Persist auto-save preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('workplace-safety-autosave-enabled', String(isAutoSaveEnabled));
    }
  }, [isAutoSaveEnabled]);

  // Track if this is the initial mount (skip auto-save on initial load)
  const isInitialMountRef = useRef(true);
  const autoSaveTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const currentAssessmentIdRef = useRef<string | undefined>(assessment.id);

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!isAutoSaveEnabled || assessment.status !== 'DRAFT') return;
    
    // Only auto-save if assessment has some data filled in
    if (!assessment.department && stats.acceptable === 0 && stats.unacceptable === 0 && stats.na === 0) {
      console.log('⏭️ Skipping auto-save - no data to save');
      return;
    }
    
    console.log('🔄 Auto-saving draft...');
    setIsAutoSaving(true);
    
    try {
      // Prepare sections data for API (remove icon and file objects)
      const sectionsData = assessment.sections.map((section) => ({
        id: section.id,
        title: section.title,
        items: section.items.map((item) => ({
          id: item.id,
          description: item.description,
          status: item.status,
          deficiency: item.deficiency,
          correctiveAction: item.correctiveAction,
          dynamicEntries: item.dynamicEntries,
          workOrderPlaced: item.workOrderPlaced,
          reportedViaSafetyApp: item.reportedViaSafetyApp,
          safetyAppReportDate: item.safetyAppReportDate,
          workOrderDateCreated: item.workOrderDateCreated,
          workOrderAssignedTo: item.workOrderAssignedTo,
          workOrderAttachment: item.workOrderAttachment ? {
            id: item.workOrderAttachment.id,
            name: item.workOrderAttachment.name,
            fileUrl: item.workOrderAttachment.fileUrl,
          } : undefined,
        })),
      }));

      // Prepare signatures
      const signatureData: Record<string, string | undefined> = {};
      if (assessment.teamLeaderSignature?.signatureDataUrl) {
        signatureData.teamLeaderSignature = assessment.teamLeaderSignature.signatureDataUrl;
      }
      if (assessment.employeeSignature?.signatureDataUrl) {
        signatureData.employeeSignature = assessment.employeeSignature.signatureDataUrl;
      }

      const payload = {
        assessmentNumber: assessment.assessmentNumber,
        version: assessment.version,
        date: assessment.date,
        departmentId: assessment.department,
        teamLeaderName: assessment.teamLeaderName,
        employeeName: assessment.employeeName,
        ...signatureData,
        sections: sectionsData,
      };

      let response;
      if (assessment.id) {
        console.log('🔄 Updating existing assessment:', assessment.id);
        response = await api.put(`/workplace-safety/${assessment.id}`, payload);
      } else {
        console.log('🔄 Creating new assessment...');
        response = await api.post('/workplace-safety', payload);
        // Update local state with the new ID and update URL
        if (response.data?.data?.assessment?.id) {
          const newId = response.data.data.assessment.id;
          currentAssessmentIdRef.current = newId;
          setAssessment((prev) => ({
            ...prev,
            id: newId,
          }));
          // Update URL so refresh loads the draft
          window.history.replaceState(null, '', `/workplace-safety?edit=${newId}`);
          // Sync any pending photos that were uploaded before the assessment had an ID
          await syncPendingPhotos(newId);
        }
      }
      setLastAutoSaved(new Date());
      console.log('✅ Auto-save complete');
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [isAutoSaveEnabled, assessment, stats.acceptable, stats.unacceptable, stats.na, syncPendingPhotos]);

  // Debounced auto-save: triggers 3 seconds after the last change
  useEffect(() => {
    // Skip auto-save on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    
    // Don't auto-save if disabled or not a draft
    if (!isAutoSaveEnabled || assessment.status !== 'DRAFT') return;
    
    // Clear any existing timeout
    if (autoSaveTimeoutIdRef.current) {
      clearTimeout(autoSaveTimeoutIdRef.current);
    }
    
    // Set new timeout to auto-save after 3 seconds of no changes
    autoSaveTimeoutIdRef.current = setTimeout(() => {
      console.log('⏱️ Auto-save triggered after 3s debounce');
      performAutoSave();
    }, 3000);
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutIdRef.current) {
        clearTimeout(autoSaveTimeoutIdRef.current);
      }
    };
  }, [assessment, isAutoSaveEnabled, performAutoSave]);

  if (!isSupervisorPlus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50"
        >
          <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This section is only available to Supervisors and above.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
          >
            Return to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-50 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-xl ${
              showToast.type === 'success'
                ? 'bg-green-500/90 text-white'
                : 'bg-red-500/90 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              {showToast.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{showToast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-white/20 dark:border-gray-700/50 shadow-lg shadow-black/5">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25"
              >
                <Shield className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 via-emerald-800 to-teal-900 dark:from-white dark:via-emerald-200 dark:to-teal-200 bg-clip-text text-transparent">
                  Workplace Safety Assessment
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Monthly Departmental Safety Assessment
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Progress indicator */}
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 backdrop-blur-md bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/20 dark:border-gray-700/50">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Completion</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{completionPercentage}%</span>
                </div>
                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPercentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Stats summary */}
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-1 text-xs font-medium rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  {stats.acceptable} A
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  {stats.unacceptable} U
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {stats.na} NA
                </span>
              </div>

              {/* Incomplete Assessment Notification */}
              {stats.pending > 0 && (
                <div className="relative" ref={incompleteDropdownRef}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowIncompleteDropdown(!showIncompleteDropdown)}
                    className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                    title={`${stats.pending} items not assessed`}
                  >
                    <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-amber-500 rounded-full shadow-sm">
                      {stats.pending}
                    </span>
                  </motion.button>

                  <AnimatePresence>
                    {showIncompleteDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-12 z-50 w-80 p-4 backdrop-blur-xl bg-white/95 dark:bg-gray-800/95 rounded-xl border border-amber-200 dark:border-amber-700/50 shadow-xl shadow-amber-500/10"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                            {stats.pending} items remaining
                          </h4>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-hide">
                          {assessment.sections
                            .filter(section => section.items.some(item => item.status === null))
                            .map(section => {
                              const pendingItems = section.items.filter(item => item.status === null);
                              return (
                                <button
                                  key={section.id}
                                  onClick={() => {
                                    setExpandedSections(prev => new Set([...prev, section.id]));
                                    const element = document.getElementById(`section-${section.id}`);
                                    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    setShowIncompleteDropdown(false);
                                  }}
                                  className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors group"
                                >
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-700 dark:group-hover:text-amber-300 truncate">
                                    {section.title}
                                  </span>
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full whitespace-nowrap ml-2">
                                    {pendingItems.length} left
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* Reset/New Assessment Button - only show when editing an existing draft */}
                {assessment.id && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (window.confirm('Start a new assessment? Any unsaved changes to the current draft will remain saved in the database.')) {
                        setAssessment({
                          assessmentNumber: `WSA-${format(new Date(), 'yyyyMM')}-001`,
                          department: '',
                          version: '3/19/25',
                          date: format(new Date(), 'yyyy-MM-dd'),
                          teamLeaderName: userFullName,
                          employeeName: '',
                          status: 'DRAFT',
                          sections: getInitialSections(),
                        });
                        setDraftLoadError(null);
                        setCompletionStats(null);
                        assessmentNumberRef.current = '';
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Start a new assessment"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">New</span>
                  </motion.button>
                )}

                {/* Auto-save toggle */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      isAutoSaveEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    role="switch"
                    aria-checked={isAutoSaveEnabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isAutoSaveEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    isAutoSaveEnabled 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {isAutoSaveEnabled ? (
                      isAutoSaving ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="hidden sm:inline">Saving...</span>
                        </span>
                      ) : lastAutoSaved ? (
                        <span className="hidden sm:inline">Auto ON</span>
                      ) : (
                        <span className="hidden sm:inline">Auto Save</span>
                      )
                    ) : (
                      <span className="hidden sm:inline">Auto OFF</span>
                    )}
                  </span>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span className="hidden sm:inline">Save Draft</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSubmit}
                  disabled={submitting || stats.pending > 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span className="hidden sm:inline">Submit</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="relative mb-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { key: 'form' as const, label: 'New Assessment', icon: FileText },
              { key: 'history' as const, label: 'History', icon: History },
              ...(viewReportData ? [{ key: 'view' as const, label: `Report: ${viewReportData.assessmentNumber}`, icon: Eye }] : []),
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors duration-200 focus:outline-none"
                  style={{ marginBottom: '-1px' }}
                >
                  <Icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  <span className={`transition-colors duration-200 whitespace-nowrap ${isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="safety-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
        {activeTab === 'form' && (
          <motion.div
            key="form-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Assessment Header Card */}
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl shadow-black/5 border border-white/20 dark:border-gray-700/50 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Assessment Information
                </h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Assessment Number */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Assessment No.
                    {loadingDraft && (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={assessment.assessmentNumber}
                      onChange={(e) => handleAssessmentNumberChange(e.target.value)}
                      placeholder="Enter assessment number to load draft or create new"
                      className={`w-full px-4 py-2.5 rounded-xl border ${
                        draftLoadError 
                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' 
                          : assessment.id 
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20' 
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                      } text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all`}
                    />
                    {assessment.id && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Draft Loaded
                      </span>
                    )}
                  </div>
                  {draftLoadError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {draftLoadError}
                    </p>
                  )}
                  {!draftLoadError && !assessment.id && assessment.assessmentNumber.length >= 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      No existing draft found. A new assessment will be created when you save.
                    </p>
                  )}
                </div>

                {/* Version */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Version</label>
                  <input
                    type="text"
                    value={assessment.version}
                    onChange={(e) => setAssessment({ ...assessment, version: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={assessment.date}
                    onChange={(e) => setAssessment({ ...assessment, date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Department Audited
                  </label>
                  <select
                    value={assessment.department}
                    onChange={(e) => setAssessment({ ...assessment, department: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">Select department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Team Leader */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Team Leader
                  </label>
                  <input
                    type="text"
                    value={assessment.teamLeaderName || userFullName}
                    readOnly
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm cursor-not-allowed"
                  />
                </div>

                {/* Employee */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Employee
                  </label>
                  <input
                    type="text"
                    value={assessment.employeeName}
                    onChange={(e) => setAssessment({ ...assessment, employeeName: e.target.value })}
                    placeholder="Enter employee name"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* Status Badge */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                      assessment.status === 'DRAFT'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        : assessment.status === 'SUBMITTED'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        assessment.status === 'DRAFT'
                          ? 'bg-yellow-500 animate-pulse'
                          : assessment.status === 'SUBMITTED'
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}
                    />
                    {assessment.status}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Legend */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-4 p-4 backdrop-blur-xl bg-white/60 dark:bg-gray-800/60 rounded-xl border border-white/20 dark:border-gray-700/50"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Legend:</span>
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${option.color}`} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {option.value} = {option.label}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* Assessment Sections */}
            {assessment.sections.map((section, sectionIndex) => (
              <motion.div
                id={`section-${section.id}`}
                key={section.id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: sectionIndex * 0.1 }}
                className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl shadow-black/5 border border-white/20 dark:border-gray-700/50 overflow-hidden"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full p-6 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-750 dark:hover:to-gray-700 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <section.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {section.items.filter((i) => i.status).length} of {section.items.length} items assessed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Section progress */}
                    <div className="hidden sm:flex items-center gap-2">
                      {section.items.some((i) => i.status === 'U') && (
                        <span className="px-2 py-1 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Issues Found
                        </span>
                      )}
                      {section.items.every((i) => i.status === 'A') && (
                        <span className="px-2 py-1 text-xs font-medium rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          All Acceptable
                        </span>
                      )}
                    </div>

                    {expandedSections.has(section.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Section Content */}
                <AnimatePresence>
                  {expandedSections.has(section.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 space-y-4">
                        {section.items.map((item, itemIndex) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: itemIndex * 0.05 }}
                            className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900/50"
                          >
                            {/* Item Header */}
                            <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                              <div className="flex-1">
                                <p className="text-sm text-gray-800 dark:text-gray-200">{item.description}</p>
                              </div>

                              {/* Status Selection */}
                              <div className="flex items-center gap-2">
                                {statusOptions.map((option) => {
                                  const Icon = option.icon;
                                  const isSelected = item.status === option.value;
                                  return (
                                    <motion.button
                                      key={option.value}
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        updateItemStatus(
                                          section.id,
                                          item.id,
                                          option.value as 'A' | 'U' | 'NA'
                                        )
                                      }
                                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                        isSelected
                                          ? `${option.color} text-white shadow-lg`
                                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      <Icon className="w-4 h-4" />
                                      {option.value}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Deficiency & Corrective Action Fields (shown only when Unacceptable) */}
                            <AnimatePresence>
                              {item.status === 'U' && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-gray-200 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10"
                                >
                                  <div className="p-4 space-y-4">
                                    {/* Deficiency and Corrective Action */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      <AIEnhancedTextarea
                                        label="Deficiency Found"
                                        name={`deficiency-${section.id}-${item.id}`}
                                        value={item.deficiency || ''}
                                        onChange={(e) => updateDeficiency(section.id, item.id, e.target.value)}
                                        placeholder="Describe any deficiency found..."
                                        rows={3}
                                        context={`Workplace Safety Assessment - ${section.title} - ${item.description}`}
                                      />

                                      <AIEnhancedTextarea
                                        label="Corrective Action"
                                        name={`correctiveAction-${section.id}-${item.id}`}
                                        value={item.correctiveAction || ''}
                                        onChange={(e) => updateCorrectiveAction(section.id, item.id, e.target.value)}
                                        placeholder="Describe the corrective action taken..."
                                        rows={3}
                                        context={`Workplace Safety Assessment - ${section.title} - ${item.description}`}
                                      />
                                    </div>

                                    {/* Photo Attachments */}
                                    <div className="space-y-3">
                                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <Camera className="w-4 h-4 text-blue-500" />
                                        Photo Attachments (Optional)
                                      </label>
                                      
                                      {/* Photo Upload Input */}
                                      <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors cursor-pointer">
                                          <Plus className="w-4 h-4" />
                                          Add Photos
                                          <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => {
                                              const files = Array.from(e.target.files || []);
                                              files.forEach((file) => addPhoto(section.id, item.id, file));
                                            }}
                                            className="hidden"
                                          />
                                        </label>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          Click to upload photos as evidence
                                        </span>
                                      </div>

                                      {/* Photo Previews */}
                                      {item.photos && item.photos.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                          {item.photos.map((photo) => (
                                            <motion.div
                                              key={photo.id}
                                              initial={{ opacity: 0, scale: 0.9 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              className="relative group"
                                            >
                                              <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative">
                                                <img
                                                  src={photo.fileUrl || photo.preview}
                                                  alt={photo.name}
                                                  className={`w-full h-full object-cover ${photo.uploading ? 'opacity-50' : ''}`}
                                                />
                                                {/* Uploading overlay */}
                                                {photo.uploading && (
                                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                  </div>
                                                )}
                                                {/* Uploaded indicator */}
                                                {photo.uploaded && !photo.uploading && (
                                                  <div className="absolute top-1 left-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                                    <CheckCircle className="w-3 h-3 text-white" />
                                                  </div>
                                                )}
                                              </div>
                                              <button
                                                onClick={() => removePhoto(section.id, item.id, photo.id)}
                                                disabled={photo.uploading}
                                                className={`absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg ${photo.uploading ? 'cursor-not-allowed opacity-50' : ''}`}
                                              >
                                                <XCircle className="w-4 h-4" />
                                              </button>
                                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {photo.uploading ? 'Uploading...' : photo.name}
                                              </p>
                                            </motion.div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Work Order Section - Only for items that require work orders */}
                                    {WORK_ORDER_REQUIRED_ITEMS.includes(item.id) && (
                                      <div className="border-t border-red-200 dark:border-red-800/50 pt-4 space-y-4">
                                        {/* Work Order Required Indicator */}
                                        <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                                          <Wrench className="w-5 h-5 text-red-600 dark:text-red-400" />
                                          <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                                            Work order required
                                          </span>
                                        </div>

                                        {/* Work Order Placed Checkbox */}
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={item.workOrderPlaced || false}
                                            onChange={(e) => updateWorkOrderPlaced(section.id, item.id, e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                          />
                                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                                            Work order placed?
                                          </span>
                                        </label>

                                        {/* Work Order Options - Shown when Work Order Placed is checked */}
                                        <AnimatePresence>
                                          {item.workOrderPlaced && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="space-y-4 pl-8"
                                            >
                                              {/* Safety App Checkbox */}
                                              <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                  type="checkbox"
                                                  checked={item.reportedViaSafetyApp || false}
                                                  onChange={(e) => updateReportedViaSafetyApp(section.id, item.id, e.target.checked)}
                                                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div className="flex items-center gap-2">
                                                  <Smartphone className="w-4 h-4 text-blue-500" />
                                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                                                    Deficiency reported using the Safety App
                                                  </span>
                                                </div>
                                              </label>

                                              {/* If reported via Safety App - Show Date Reported */}
                                              <AnimatePresence>
                                                {item.reportedViaSafetyApp && (
                                                  <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="pl-8"
                                                  >
                                                    <div className="space-y-2">
                                                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                        Date reported <span className="text-red-500">*</span>
                                                      </label>
                                                      <input
                                                        type="date"
                                                        value={item.safetyAppReportDate || ''}
                                                        onChange={(e) => updateSafetyAppReportDate(section.id, item.id, e.target.value)}
                                                        className="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        required
                                                      />
                                                    </div>
                                                  </motion.div>
                                                )}
                                              </AnimatePresence>

                                              {/* If NOT reported via Safety App - Show Work Order Fields */}
                                              <AnimatePresence>
                                                {!item.reportedViaSafetyApp && (
                                                  <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                                                  >
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                      {/* Date Created */}
                                                      <div className="space-y-2">
                                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                          <Calendar className="w-4 h-4 text-gray-500" />
                                                          Date created <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                          type="date"
                                                          value={item.workOrderDateCreated || ''}
                                                          onChange={(e) => updateWorkOrderDateCreated(section.id, item.id, e.target.value)}
                                                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                          required
                                                        />
                                                      </div>

                                                      {/* Assigned To */}
                                                      <div className="space-y-2">
                                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                          <User className="w-4 h-4 text-gray-500" />
                                                          Assigned to
                                                        </label>
                                                        <input
                                                          type="text"
                                                          value={item.workOrderAssignedTo || ''}
                                                          onChange={(e) => updateWorkOrderAssignedTo(section.id, item.id, e.target.value)}
                                                          placeholder="Enter assignee name..."
                                                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                      </div>
                                                    </div>

                                                    {/* Work Order Attachment */}
                                                    <div className="space-y-2">
                                                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                        <Paperclip className="w-4 h-4 text-gray-500" />
                                                        Work order attachment <span className="text-red-500">*</span>
                                                      </label>
                                                      
                                                      {item.workOrderAttachment ? (
                                                        <div className={`p-3 rounded-lg border ${item.workOrderAttachment.isCreated ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
                                                          <div className="flex items-center gap-3">
                                                            {item.workOrderAttachment.isCreated ? (
                                                              <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                            ) : (
                                                              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                                            )}
                                                            <input
                                                              type="text"
                                                              value={item.workOrderAttachment.name}
                                                              onChange={(e) => renameWorkOrderAttachment(section.id, item.id, e.target.value)}
                                                              className={`flex-1 text-sm bg-transparent border-b border-transparent focus:outline-none truncate cursor-text ${item.workOrderAttachment.isCreated ? 'text-blue-700 dark:text-blue-300 hover:border-blue-300 dark:hover:border-blue-600 focus:border-blue-500 dark:focus:border-blue-400' : 'text-emerald-700 dark:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-600 focus:border-emerald-500 dark:focus:border-emerald-400'}`}
                                                              title="Click to rename"
                                                            />
                                                            {item.workOrderAttachment.fileUrl && (
                                                              <a
                                                                href={item.workOrderAttachment.fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                                                              >
                                                                View
                                                              </a>
                                                            )}
                                                            <button
                                                              onClick={() => removeWorkOrderAttachment(section.id, item.id)}
                                                              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 flex-shrink-0"
                                                            >
                                                              <XCircle className="w-5 h-5" />
                                                            </button>
                                                          </div>
                                                          
                                                          {/* Show work order details if created via form */}
                                                          {item.workOrderAttachment.isCreated && item.workOrderAttachment.formData && (
                                                            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 space-y-2">
                                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div>
                                                                  <span className="text-blue-600 dark:text-blue-400 font-medium">WO #:</span>
                                                                  <span className="ml-1 text-blue-800 dark:text-blue-200">{item.workOrderAttachment.formData.workOrderNumber}</span>
                                                                </div>
                                                                <div>
                                                                  <span className="text-blue-600 dark:text-blue-400 font-medium">Priority:</span>
                                                                  <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                                                                    item.workOrderAttachment.formData.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                                                                    item.workOrderAttachment.formData.priority === 'High' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
                                                                    item.workOrderAttachment.formData.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                                                    'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                                                  }`}>{item.workOrderAttachment.formData.priority}</span>
                                                                </div>
                                                                {item.workOrderAttachment.formData.assignedTo && (
                                                                  <div>
                                                                    <span className="text-blue-600 dark:text-blue-400 font-medium">Assigned:</span>
                                                                    <span className="ml-1 text-blue-800 dark:text-blue-200">{item.workOrderAttachment.formData.assignedTo}</span>
                                                                  </div>
                                                                )}
                                                                {item.workOrderAttachment.formData.dueDate && (
                                                                  <div>
                                                                    <span className="text-blue-600 dark:text-blue-400 font-medium">Due:</span>
                                                                    <span className="ml-1 text-blue-800 dark:text-blue-200">{format(new Date(item.workOrderAttachment.formData.dueDate), 'MMM d, yyyy')}</span>
                                                                  </div>
                                                                )}
                                                              </div>
                                                              {item.workOrderAttachment.formData.description && (
                                                                <div className="text-xs">
                                                                  <span className="text-blue-600 dark:text-blue-400 font-medium">Description:</span>
                                                                  <p className="mt-0.5 text-blue-800 dark:text-blue-200">{item.workOrderAttachment.formData.description}</p>
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      ) : (
                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                          {/* Upload existing work order */}
                                                          <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors bg-white dark:bg-gray-800">
                                                            <Upload className="w-5 h-5 text-gray-400" />
                                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                              Upload existing
                                                            </span>
                                                            <input
                                                              type="file"
                                                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                              onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleWorkOrderAttachment(section.id, item.id, file);
                                                              }}
                                                              className="hidden"
                                                            />
                                                          </label>
                                                          
                                                          {/* Create/Download work order based on settings */}
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const context = { sectionId: section.id, itemId: item.id, itemDescription: item.description };
                                                              
                                                              if (workOrderSettings.preferredOption === 'form') {
                                                                // Show in-app form modal
                                                                setWorkOrderFormContext(context);
                                                                setWorkOrderFormData(prev => ({
                                                                  ...prev,
                                                                  requestor: userFullName,
                                                                  dateOfRequest: format(new Date(), 'yyyy-MM-dd'),
                                                                }));
                                                                setWorkOrderFormPosition({ x: 0, y: 0 });
                                                                setWorkOrderFormScale(1);
                                                                setWorkOrderFormModalOpen(true);
                                                              } else if (workOrderSettings.preferredOption === 'template' && workOrderTemplate) {
                                                                // Show download modal
                                                                setDownloadModalContext(context);
                                                                setDownloadModalOpen(true);
                                                              } else {
                                                                // Show no template available modal
                                                                setDownloadModalContext(context);
                                                                setNoTemplateModalOpen(true);
                                                              }
                                                            }}
                                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors bg-white dark:bg-gray-800 ${
                                                              workOrderSettings.preferredOption === 'form'
                                                                ? 'border-emerald-300 dark:border-emerald-600 hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                                : 'border-blue-300 dark:border-blue-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                            }`}
                                                          >
                                                            {workOrderSettings.preferredOption === 'form' ? (
                                                              <>
                                                                <FilePlus className="w-5 h-5 text-emerald-500" />
                                                                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                                                  Create work order
                                                                </span>
                                                              </>
                                                            ) : (
                                                              <>
                                                                <Download className="w-5 h-5 text-blue-500" />
                                                                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                                                  Download template
                                                                </span>
                                                              </>
                                                            )}
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </motion.div>
                                                )}
                                              </AnimatePresence>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Dynamic Entry Fields (shown only when Acceptable for special lockout items) */}
                            <AnimatePresence>
                              {item.status === 'A' && (item.id === 'lockout-5' || item.id === 'lockout-6' || item.id === 'mg-7' || item.id === 'eap-1') && item.dynamicEntries && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-gray-200 dark:border-gray-700 bg-emerald-50/30 dark:bg-emerald-900/10"
                                >
                                  <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        {item.id === 'lockout-5' 
                                          ? 'Employee & Equipment Verification (Required)' 
                                          : item.id === 'eap-1'
                                          ? 'Employee Verification (Required - Minimum 2)'
                                          : 'Equipment Verification (Required)'}
                                      </label>
                                      <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => addDynamicEntry(section.id, item.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Add {item.id === 'lockout-5' || item.id === 'eap-1' ? 'Employee' : 'Equipment'}
                                      </motion.button>
                                    </div>

                                    {item.dynamicEntries.map((entry, entryIndex) => (
                                      <motion.div
                                        key={entry.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-emerald-200 dark:border-emerald-800/50 space-y-3"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                            Entry #{entryIndex + 1}
                                          </span>
                                          {item.dynamicEntries && item.dynamicEntries.length > 1 && (
                                            <motion.button
                                              whileHover={{ scale: 1.05 }}
                                              whileTap={{ scale: 0.95 }}
                                              onClick={() => removeDynamicEntry(section.id, item.id, entry.id)}
                                              className="text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                            >
                                              <XCircle className="w-5 h-5" />
                                            </motion.button>
                                          )}
                                        </div>

                                        <div className={`grid gap-4 ${item.id === 'lockout-5' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                          {(item.id === 'lockout-5' || item.id === 'eap-1') && (
                                            <div className="space-y-1.5">
                                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                Employee Name <span className="text-red-500">*</span>
                                              </label>
                                              <input
                                                type="text"
                                                value={entry.employeeName || ''}
                                                onChange={(e) =>
                                                  updateDynamicEntry(section.id, item.id, entry.id, 'employeeName', e.target.value)
                                                }
                                                placeholder="Enter employee name"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                                              />
                                            </div>
                                          )}
                                          {(item.id === 'lockout-5' || item.id === 'lockout-6' || item.id === 'mg-7') && (
                                            <div className="space-y-1.5">
                                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                Equipment Name <span className="text-red-500">*</span>
                                              </label>
                                              <input
                                                type="text"
                                                value={entry.equipmentName || ''}
                                                onChange={(e) =>
                                                  updateDynamicEntry(section.id, item.id, entry.id, 'equipmentName', e.target.value)
                                                }
                                                placeholder="Enter equipment name"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {/* Signatures Section */}
            <motion.div
              variants={cardVariants}
              className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl shadow-black/5 border border-white/20 dark:border-gray-700/50 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Signatures
                </h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <SignaturePad
                  label="Operation Manager"
                  signatureData={assessment.operationManagerSignature}
                  onChange={(data) => setAssessment({ ...assessment, operationManagerSignature: data })}
                />
                <SignaturePad
                  label="Plant Manager"
                  signatureData={assessment.plantManagerSignature}
                  onChange={(data) => setAssessment({ ...assessment, plantManagerSignature: data })}
                />
                <SignaturePad
                  label="Safety Manager"
                  signatureData={assessment.safetyManagerSignature}
                  onChange={(data) => setAssessment({ ...assessment, safetyManagerSignature: data })}
                />
              </div>
            </motion.div>

            {/* Bottom Actions */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl shadow-black/5 border border-white/20 dark:border-gray-700/50"
            >
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>{stats.acceptable} Acceptable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>{stats.unacceptable} Unacceptable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span>{stats.na} N/A</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting || stats.pending > 0}
                  className="flex items-center gap-2 px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Submit Assessment
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          /* History Tab */
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl shadow-black/5 border border-white/20 dark:border-gray-700/50 p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Assessment History</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  View and manage all your workplace safety assessments
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => loadHistory()}
                  disabled={loadingHistory}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setActiveTab('form')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Assessment
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading assessments...</span>
              </div>
            ) : savedAssessments.length === 0 ? (
              /* Empty State */
              <div className="text-center py-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4"
                >
                  <History className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Assessments Yet</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  You haven&apos;t created any workplace safety assessments yet. Get started by creating your first one.
                </p>
                <button
                  onClick={() => setActiveTab('form')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create New Assessment
                </button>
              </div>
            ) : (
              <>
              {/* Assessment Table */}
              <div className="overflow-x-auto scrollbar-hide rounded-xl border border-gray-300 dark:border-gray-600">
                {/* Selection mode toolbar */}
                <AnimatePresence>
                  {selectionMode && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-300 dark:border-gray-600">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {selectedRows.size} selected
                        </span>
                        <button
                          onClick={exitSelectionMode}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors px-3 py-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/80 border-b-2 border-gray-900/20 dark:border-gray-300/20">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Assessment #</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Department</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Team Leader</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedAssessments.map((assessment: any, index) => {
                      const isSelected = selectedRows.has(assessment.id);
                      return (
                        <motion.tr
                          key={assessment.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={(e) => handleRowClick(assessment, index, e)}
                          onContextMenu={(e) => handleRowContextMenu(e, assessment, index)}
                          className={`border-b border-gray-900/10 dark:border-gray-300/10 transition-colors duration-150 select-none ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/25 hover:bg-blue-100 dark:hover:bg-blue-900/35'
                              : 'bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                          } ${selectionMode ? 'cursor-pointer' : 'cursor-pointer'}`}
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              {selectionMode && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-blue-500 border-blue-500'
                                      : 'border-gray-300 dark:border-gray-500'
                                  }`}
                                >
                                  {isSelected && (
                                    <CheckCircle className="w-3 h-3 text-white" />
                                  )}
                                </motion.div>
                              )}
                              {assessment.assessmentNumber}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {assessment.Department?.name || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {format(new Date(assessment.createdAt), 'MMM d, yyyy')}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {format(new Date(assessment.createdAt), 'h:mm a')}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {assessment.teamLeaderName || '—'}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              assessment.status === 'SUBMITTED'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : assessment.status === 'COMPLETED'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}>
                              {assessment.status}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Context Menu */}
              <AnimatePresence>
                {contextMenu && (
                  <Portal>
                    <motion.div
                      ref={contextMenuRef}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: 0.12 }}
                      className="fixed z-[9999] w-48 py-1.5 backdrop-blur-xl bg-white/95 dark:bg-gray-800/95 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl shadow-black/20"
                      style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                      <button
                        onClick={() => {
                          loadReportForViewing(contextMenu.assessment.assessmentNumber);
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                        View Report
                      </button>
                      <button
                        onClick={() => {
                          if (!selectionMode) {
                            setSelectionMode(true);
                            setSelectedRows(new Set([contextMenu.assessment.id]));
                            lastSelectedIndexRef.current = contextMenu.index;
                          }
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <MousePointer2 className="w-4 h-4 text-gray-400" />
                        Select
                      </button>
                      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={() => {
                          handleEditAssessment(contextMenu.assessment);
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Pen className="w-4 h-4 text-gray-400" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm({ assessment: contextMenu.assessment });
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </motion.div>
                  </Portal>
                )}
              </AnimatePresence>
              </>
            )}
          </motion.div>
          </motion.div>
        )}

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirm && (
            <Portal>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="w-full max-w-md mx-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl shadow-black/20 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Assessment</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                      You are about to permanently delete assessment:
                    </p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-2 tracking-wide">
                      {deleteConfirm.assessment.assessmentNumber}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                      Type the assessment number below to confirm deletion:
                    </p>
                  </div>

                  {/* Input */}
                  <div className="px-6 pb-4">
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder={deleteConfirm.assessment.assessmentNumber}
                      className={`w-full px-4 py-3 text-sm rounded-xl border-2 transition-colors outline-none ${
                        deleteInput === deleteConfirm.assessment.assessmentNumber
                          ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-300 focus:ring-2 focus:ring-red-500/30'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:border-gray-400 dark:focus:border-gray-500'
                      }`}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {deleteInput.length > 0 && deleteInput !== deleteConfirm.assessment.assessmentNumber && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Assessment number does not match
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-6 pb-6 flex items-center gap-3">
                    <button
                      onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAssessment}
                      disabled={deleteInput !== deleteConfirm.assessment.assessmentNumber || deleting}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
                        deleteInput === deleteConfirm.assessment.assessmentNumber && !deleting
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete Permanently
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            </Portal>
          )}
        </AnimatePresence>

        {/* View Report Full Page */}
        {activeTab === 'view' && (
          <motion.div
            key="view-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl shadow-black/5 border border-white/20 dark:border-gray-700/50"
          >
            {loadingReport ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                <span className="ml-3 text-gray-600 dark:text-gray-400 text-lg">Loading report...</span>
              </div>
            ) : viewReportData ? (
              <>
                {/* Report Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Workplace Safety Assessment Report</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{viewReportData.assessmentNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintReport}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                    <button
                      onClick={handleDownloadReport}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Printable Content */}
                  <div ref={reportPrintRef}>
                    {/* Print Header */}
                    <div className="print-header text-center mb-6 pb-4 border-b-2 border-emerald-500">
                      <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Workplace Safety Assessment</h1>
                      <p className="text-gray-600 dark:text-gray-400">{viewReportData.assessmentNumber}</p>
                    </div>

                    {/* Assessment Info Grid */}
                    <div className="info-grid grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="info-item bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                        <div className="info-label text-xs text-gray-500 dark:text-gray-400">Status</div>
                        <div className={`info-value font-semibold ${
                          viewReportData.status === 'SUBMITTED' ? 'text-green-600' :
                          viewReportData.status === 'COMPLETED' ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {viewReportData.status}
                        </div>
                      </div>
                      <div className="info-item bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                        <div className="info-label text-xs text-gray-500 dark:text-gray-400">Date</div>
                        <div className="info-value font-semibold text-gray-900 dark:text-white">
                          {format(new Date(viewReportData.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="info-item bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                        <div className="info-label text-xs text-gray-500 dark:text-gray-400">Team Leader</div>
                        <div className="info-value font-semibold text-gray-900 dark:text-white">
                          {viewReportData.teamLeaderName || '-'}
                        </div>
                      </div>
                      <div className="info-item bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                        <div className="info-label text-xs text-gray-500 dark:text-gray-400">Department</div>
                        <div className="info-value font-semibold text-gray-900 dark:text-white">
                          {viewReportData.Department?.name || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Sections */}
                    <div className="space-y-6">
                      {viewReportData.sections?.map((section: any) => {
                        const hasResponses = section.items.some((item: any) => item.status);
                        if (!hasResponses) return null;

                        return (
                          <div key={section.id} className="section bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                            <div className="section-title bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 px-4 py-3 font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 uppercase tracking-wide">
                              {section.title}
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                              {section.items.filter((item: any) => item.status).map((item: any, idx: number) => (
                                <div key={item.id} className="item p-4 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                                  <div className="item-header flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                      <span className="text-xs font-medium text-gray-400 mt-0.5 min-w-[20px]">{idx + 1}.</span>
                                      <p className="item-desc text-sm text-gray-700 dark:text-gray-300">{item.description}</p>
                                    </div>
                                    <span className={`status-badge px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                                      item.status === 'A' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                                      item.status === 'U' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                      {item.status === 'A' ? 'Acceptable' : item.status === 'U' ? 'Unacceptable' : 'N/A'}
                                    </span>
                                  </div>

                                  {/* Deficiency */}
                                  {item.status === 'U' && item.deficiency && (
                                    <div className="deficiency-box mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 ml-7">
                                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Deficiency Found:</div>
                                      <p className="text-sm text-amber-800 dark:text-amber-300">{item.deficiency}</p>
                                    </div>
                                  )}

                                  {/* Corrective Action */}
                                  {item.status === 'U' && item.correctiveAction && (
                                    <div className="corrective-box mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 ml-7">
                                      <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Corrective Action:</div>
                                      <p className="text-sm text-blue-800 dark:text-blue-300">{item.correctiveAction}</p>
                                    </div>
                                  )}

                                  {/* Photos */}
                                  {item.photos && item.photos.length > 0 && (
                                    <div className="photos-grid mt-3 flex gap-2 flex-wrap ml-7">
                                      {item.photos.map((photo: any) => (
                                        <a 
                                          key={photo.id} 
                                          href={photo.fileUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="block"
                                        >
                                          <img
                                            src={photo.fileUrl}
                                            alt={photo.name}
                                            className="photo-thumb w-24 h-24 object-cover rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:opacity-80 hover:scale-105 transition-all shadow-sm"
                                          />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Signatures Section */}
                    <div className="signatures mt-8 pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Signatures</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="signature-box text-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <div className="signature-label text-xs text-gray-500 dark:text-gray-400 mb-2">Team Leader</div>
                          {viewReportData.teamLeaderSignature ? (
                            <div className="space-y-1">
                              <img 
                                src={viewReportData.teamLeaderSignature} 
                                alt="Team Leader Signature" 
                                className="h-12 mx-auto"
                              />
                              <div className="signature-name font-semibold text-sm text-gray-900 dark:text-white">
                                {viewReportData.teamLeaderName}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Not signed</div>
                          )}
                        </div>
                        <div className="signature-box text-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <div className="signature-label text-xs text-gray-500 dark:text-gray-400 mb-2">Employee</div>
                          {viewReportData.employeeSignature ? (
                            <div className="space-y-1">
                              <img 
                                src={viewReportData.employeeSignature} 
                                alt="Employee Signature" 
                                className="h-12 mx-auto"
                              />
                              <div className="signature-name font-semibold text-sm text-gray-900 dark:text-white">
                                {viewReportData.employeeName}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Not signed</div>
                          )}
                        </div>
                        <div className="signature-box text-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <div className="signature-label text-xs text-gray-500 dark:text-gray-400 mb-2">Operation Manager</div>
                          {viewReportData.operationManagerSignature ? (
                            <div className="space-y-1">
                              <img 
                                src={viewReportData.operationManagerSignature} 
                                alt="Operation Manager Signature" 
                                className="h-12 mx-auto"
                              />
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Not signed</div>
                          )}
                        </div>
                        <div className="signature-box text-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <div className="signature-label text-xs text-gray-500 dark:text-gray-400 mb-2">Safety Manager</div>
                          {viewReportData.safetyManagerSignature ? (
                            <div className="space-y-1">
                              <img 
                                src={viewReportData.safetyManagerSignature} 
                                alt="Safety Manager Signature" 
                                className="h-12 mx-auto"
                              />
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Not signed</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400">
                      Generated on {format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')} • DashMet RCA Engine
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No report data available</p>
                <button
                  onClick={() => setActiveTab('history')}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to History
                </button>
              </div>
            )}
          </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* No Template Available Modal */}
      <AnimatePresence>
        {noTemplateModalOpen && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setNoTemplateModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6" />
                    <div>
                      <h3 className="text-lg font-semibold">Template Not Available</h3>
                      <p className="text-sm text-amber-100 opacity-90">Work order template required</p>
                    </div>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="px-6 py-6 space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-gray-700 dark:text-gray-300">
                      The work order report template is not yet available at this time.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Please contact your administrator to upload a work order template for your organization.
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                      <span className="mt-0.5">💡</span>
                      <span>In the meantime, you can still upload an existing work order document using the "Upload existing" option.</span>
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex justify-end">
                  <button
                    onClick={() => setNoTemplateModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Work Order Template Download Modal */}
      <AnimatePresence>
        {downloadModalOpen && workOrderTemplate && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setDownloadModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <div className="flex items-center gap-3">
                    <Download className="w-6 h-6" />
                    <div>
                      <h3 className="text-lg font-semibold">Download Work Order Template</h3>
                      <p className="text-sm text-blue-100 opacity-90">Fill out and attach the completed form</p>
                    </div>
                  </div>
                </div>

                {/* Deficiency Context */}
                <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Deficiency:</span> {downloadModalContext.itemDescription}
                  </p>
                </div>

                {/* Modal Body */}
                <div className="px-6 py-5 space-y-4">
                  {/* Template Info */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {workOrderTemplate.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {workOrderTemplate.fileName}
                        </p>
                      </div>
                    </div>
                    {workOrderTemplate.description && (
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                        {workOrderTemplate.description}
                      </p>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Instructions:</h4>
                    <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
                      <li>Click the download button below to get the work order template</li>
                      <li>Fill out all required fields in the downloaded form</li>
                      <li>Save the completed form on your device</li>
                      <li>Return here and use "Upload existing" to attach the completed form</li>
                    </ol>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3">
                  <button
                    onClick={() => setDownloadModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Close
                  </button>
                  <a
                    href={workOrderTemplate.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={workOrderTemplate.fileName}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                    onClick={() => {
                      // Auto-close modal after slight delay to allow download to start
                      setTimeout(() => setDownloadModalOpen(false), 500);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </a>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Work Order Form Modal - Draggable & Scalable */}
      <AnimatePresence>
        {workOrderFormModalOpen && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center p-4"
              onClick={() => setWorkOrderFormModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: workOrderFormScale,
                  x: workOrderFormPosition.x,
                  y: workOrderFormPosition.y,
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden select-none"
                style={{ cursor: workOrderFormDragging ? 'grabbing' : 'default' }}
              >
                {/* Draggable Header */}
                <div 
                  className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setWorkOrderFormDragging(true);
                    workOrderFormDragRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      initialX: workOrderFormPosition.x,
                      initialY: workOrderFormPosition.y,
                    };
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold">{workOrderSettings.formTitle}</h3>
                        <p className="text-xs sm:text-sm text-emerald-100 opacity-90 hidden sm:block">Fill out this form for deficiency repair</p>
                      </div>
                    </div>
                    {/* Scale Controls */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setWorkOrderFormScale(Math.max(0.7, workOrderFormScale - 0.1))}
                        className="p-1 sm:p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title="Zoom out"
                      >
                        <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <span className="text-xs sm:text-sm font-medium w-10 sm:w-12 text-center">{Math.round(workOrderFormScale * 100)}%</span>
                      <button
                        type="button"
                        onClick={() => setWorkOrderFormScale(Math.min(1.3, workOrderFormScale + 0.1))}
                        className="p-1 sm:p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title="Zoom in"
                      >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Deficiency Context */}
                <div className="px-4 sm:px-6 py-2 sm:py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                  <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Deficiency:</span> {workOrderFormContext.itemDescription}
                  </p>
                </div>

                {/* Modal Body */}
                <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
                  {/* Row 1: Requestor & Department */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Requestor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={workOrderFormData.requestor}
                        onChange={(e) => setWorkOrderFormData(prev => ({ ...prev, requestor: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Department <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={workOrderFormData.department}
                        onChange={(e) => setWorkOrderFormData(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="e.g., Production"
                      />
                    </div>
                  </div>

                  {/* Row 2: Date of Request */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Date of Request
                    </label>
                    <input
                      type="date"
                      value={workOrderFormData.dateOfRequest}
                      onChange={(e) => setWorkOrderFormData(prev => ({ ...prev, dateOfRequest: e.target.value }))}
                      className="w-full sm:w-48 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {/* Row 3: Type */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Type <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(Circle one)</span>
                    </label>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {(['Repair', 'Modify', 'PMD'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setWorkOrderFormData(prev => ({ ...prev, type }))}
                          className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full border-2 transition-all ${
                            workOrderFormData.type === type
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 4: Class */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Class <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(Circle one)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['Fabrication', 'Safety', 'Ergonomics', 'Equipment', 'USDA', 'QA', 'Other'] as const).map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setWorkOrderFormData(prev => ({ ...prev, class: cls }))}
                          className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all ${
                            workOrderFormData.class === cls
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                          }`}
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 5: Priority */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setWorkOrderFormData(prev => ({ ...prev, priority: '1' }))}
                        className={`p-2 sm:p-3 rounded-xl border-2 transition-all text-left ${
                          workOrderFormData.priority === '1'
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                            workOrderFormData.priority === '1' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>1</span>
                          <span className={`text-xs sm:text-sm font-medium ${workOrderFormData.priority === '1' ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            Emergency
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 sm:ml-8">Immediately</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkOrderFormData(prev => ({ ...prev, priority: '2' }))}
                        className={`p-2 sm:p-3 rounded-xl border-2 transition-all text-left ${
                          workOrderFormData.priority === '2'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                            workOrderFormData.priority === '2' ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>2</span>
                          <span className={`text-xs sm:text-sm font-medium ${workOrderFormData.priority === '2' ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            Rush
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 sm:ml-8">This or Next Weekend</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkOrderFormData(prev => ({ ...prev, priority: '3' }))}
                        className={`p-2 sm:p-3 rounded-xl border-2 transition-all text-left ${
                          workOrderFormData.priority === '3'
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                            workOrderFormData.priority === '3' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>3</span>
                          <span className={`text-xs sm:text-sm font-medium ${workOrderFormData.priority === '3' ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            Plan & Schedule
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 sm:ml-8">2-5 Weeks</p>
                      </button>
                    </div>
                  </div>

                  {/* Row 6: Equipment Name and Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Equipment Name and Number (DM#) or Area <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={workOrderFormData.equipmentNameNumber}
                      onChange={(e) => setWorkOrderFormData(prev => ({ ...prev, equipmentNameNumber: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="e.g., Conveyor Belt #3 (DM-2045) or Packaging Area"
                    />
                  </div>

                  {/* Row 7: Nature of Problem */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nature of Problem <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={workOrderFormData.natureOfProblem}
                      onChange={(e) => setWorkOrderFormData(prev => ({ ...prev, natureOfProblem: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                      placeholder="Describe the problem or repair needed..."
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkOrderFormModalOpen(false);
                      setWorkOrderFormData({
                        requestor: '',
                        department: '',
                        dateOfRequest: format(new Date(), 'yyyy-MM-dd'),
                        type: '',
                        class: '',
                        priority: '',
                        equipmentNameNumber: '',
                        natureOfProblem: '',
                      });
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      // Validate required fields
                      if (!workOrderFormData.requestor || !workOrderFormData.department || !workOrderFormData.type || 
                          !workOrderFormData.class || !workOrderFormData.priority || !workOrderFormData.equipmentNameNumber || 
                          !workOrderFormData.natureOfProblem) {
                        setShowToast({ type: 'error', message: 'Please fill out all required fields' });
                        return;
                      }

                      // Create work order in backend
                      try {
                        console.log('[Work Order] Starting work order creation...');
                        console.log('[Work Order] Form data:', workOrderFormData);
                        console.log('[Work Order] Form context:', workOrderFormContext);
                        
                        if (!auth.currentUser) {
                          throw new Error('User not authenticated');
                        }
                        
                        const token = await getIdToken(auth.currentUser);
                        console.log('[Work Order] Got Firebase token');
                        
                        // First, ensure the assessment is saved if it doesn't have an ID
                        let currentAssessmentId = assessment.id;
                        let currentAssessmentNumber = assessment.assessmentNumber;
                        
                        console.log('[Work Order] Current assessment ID:', currentAssessmentId);
                        console.log('[Work Order] Current assessment number:', currentAssessmentNumber);
                        
                        if (!currentAssessmentId) {
                          console.log('[Work Order] No assessment ID, saving assessment first...');
                          // Save the assessment first
                          const saveResponse = await fetch(`${API_BASE}/workplace-safety`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              assessmentNumber: assessment.assessmentNumber,
                              version: assessment.version,
                              date: assessment.date,
                              department: assessment.department,
                              teamLeaderName: assessment.teamLeaderName,
                              employeeName: assessment.employeeName,
                              sections: assessment.sections,
                            }),
                          });
                          
                          const saveData = await saveResponse.json();
                          console.log('[Work Order] Save response:', saveData);
                          
                          if (!saveResponse.ok) {
                            throw new Error(saveData.error || 'Failed to save assessment before creating work order');
                          }
                          
                          currentAssessmentId = saveData.data?.assessment?.id || saveData.data?.id;
                          currentAssessmentNumber = saveData.data?.assessment?.assessmentNumber || currentAssessmentNumber;
                          
                          console.log('[Work Order] New assessment ID:', currentAssessmentId);
                          
                          // Update the assessment state with the new ID
                          setAssessment(prev => ({
                            ...prev,
                            id: currentAssessmentId,
                            assessmentNumber: currentAssessmentNumber,
                          }));
                        }
                        
                        // Now create the work order
                        console.log('[Work Order] Creating work order with assessmentId:', currentAssessmentId);
                        const response = await fetch(`${API_BASE}/work-orders`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            assessmentId: currentAssessmentId,
                            assessmentNumber: currentAssessmentNumber,
                            sectionId: workOrderFormContext.sectionId,
                            itemId: workOrderFormContext.itemId,
                            itemDescription: workOrderFormContext.itemDescription,
                            requestDate: workOrderFormData.dateOfRequest,
                            expenseClass: workOrderFormData.class,
                            originator: workOrderFormData.requestor,
                            woType: workOrderFormData.type,
                            priority: workOrderFormData.priority,
                            description: workOrderFormData.natureOfProblem,
                            equipmentNo: workOrderFormData.equipmentNameNumber,
                            equipmentDescription: workOrderFormData.equipmentNameNumber,
                            fullDescriptionOfIssue: workOrderFormData.natureOfProblem,
                            department: workOrderFormData.department,
                          }),
                        });

                        const data = await response.json();
                        console.log('[Work Order] Create response:', data);

                        if (!response.ok) {
                          console.error('[Work Order] Create failed:', data);
                          throw new Error(data.error || 'Failed to create work order');
                        }

                        console.log('[Work Order] Successfully created:', data.data?.woNumber);

                        // Create work order attachment object for local state
                        const priorityLabels: Record<string, string> = { '1': 'Emergency', '2': 'Rush', '3': 'Plan & Schedule' };
                        const workOrderName = data.data?.woNumber || `WO-${format(new Date(), 'yyyyMMdd-HHmm')}`;
                        
                        const workOrderAttachment = {
                          id: data.data?.id || `wo-${Date.now()}`,
                          name: workOrderName,
                          isCreated: true,
                          woNumber: data.data?.woNumber,
                          formData: {
                            ...workOrderFormData,
                            priorityLabel: priorityLabels[workOrderFormData.priority] || '',
                            createdAt: new Date().toISOString(),
                            createdBy: userFullName,
                            deficiency: workOrderFormContext.itemDescription,
                          }
                        };
                        
                        // Update the assessment item
                        setAssessment((prev) => ({
                          ...prev,
                          sections: prev.sections.map((section) =>
                            section.id === workOrderFormContext.sectionId
                              ? {
                                  ...section,
                                  items: section.items.map((item) =>
                                    item.id === workOrderFormContext.itemId
                                      ? {
                                          ...item,
                                          workOrderPlaced: true,
                                          workOrderDateCreated: workOrderFormData.dateOfRequest,
                                          workOrderAttachment: workOrderAttachment as any,
                                        }
                                      : item
                                  ),
                                }
                              : section
                          ),
                        }));
                        
                        // Reset and close
                        setWorkOrderFormData({
                          requestor: '',
                          department: '',
                          dateOfRequest: format(new Date(), 'yyyy-MM-dd'),
                          type: '',
                          class: '',
                          priority: '',
                          equipmentNameNumber: '',
                          natureOfProblem: '',
                        });
                        setWorkOrderFormModalOpen(false);
                        setShowToast({ type: 'success', message: `Work order ${data.data?.woNumber || ''} created successfully` });
                      } catch (error: any) {
                        console.error('Failed to create work order:', error);
                        const errorMessage = error?.message || 'Failed to create work order';
                        setShowToast({ type: 'error', message: errorMessage });
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FilePlus className="w-4 h-4" />
                    Create Work Order
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkplaceSafetyPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <WorkplaceSafetyContent />
    </ProtectedRoute>
  );
}
