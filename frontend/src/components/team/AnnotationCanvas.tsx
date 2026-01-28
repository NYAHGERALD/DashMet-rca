'use client';

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface Annotation {
  id: string;
  type: 'circle' | 'arrow' | 'rectangle' | 'freehand' | 'text' | 'highlight';
  evidenceId: string; // Which evidence this annotation belongs to
  data: {
    // All coordinates are stored as percentages (0-1) relative to image
    // For circle: {cx, cy, rx, ry} - percentages
    // For arrow: {x1, y1, x2, y2} - percentages
    // For rectangle: {x, y, width, height} - percentages
    // For freehand: {points: [{x, y}, ...]} - percentages
    // For text: {x, y, text} - percentages for x,y
    [key: string]: any;
  };
  color: string;
  strokeWidth: number;
  userId?: string;
  userName?: string;
}

// Zoom/Pan state for broadcasting
export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

interface Point {
  x: number;
  y: number;
}

interface AnnotationCanvasProps {
  annotations: Annotation[];
  currentEvidenceId: string;
  currentTool: 'circle' | 'arrow' | 'rectangle' | 'freehand' | 'text' | 'highlight' | null;
  currentColor: string;
  strokeWidth: number;
  onAddAnnotation: (annotation: Annotation) => void;
  disabled?: boolean;
  imageRef: React.RefObject<HTMLImageElement | HTMLVideoElement>;
  // Zoom/Pan props for real-time sync
  viewState?: ViewState;
  onViewStateChange?: (viewState: ViewState) => void;
  isPanning?: boolean;
  onPanningChange?: (isPanning: boolean) => void;
}

// Generate unique ID
const generateId = () => `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Default view state
const DEFAULT_VIEW_STATE: ViewState = { zoom: 1, panX: 0, panY: 0 };

const AnnotationCanvas = forwardRef<HTMLCanvasElement, AnnotationCanvasProps>(({
  annotations,
  currentEvidenceId,
  currentTool,
  currentColor,
  strokeWidth,
  onAddAnnotation,
  disabled = false,
  imageRef,
  viewState = DEFAULT_VIEW_STATE,
  onViewStateChange,
  isPanning = false,
  onPanningChange
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [textValue, setTextValue] = useState('');
  const [imageBounds, setImageBounds] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Local pan state for dragging
  const [localIsPanning, setLocalIsPanning] = useState(false);
  const panStartRef = useRef<Point | null>(null);
  const lastPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useImperativeHandle(ref, () => canvasRef.current!);

  // Filter annotations for current evidence only
  const currentAnnotations = annotations.filter(a => a.evidenceId === currentEvidenceId);

  // Calculate actual image/video bounds within the container
  // This uses the actual rendered position of the media element
  const updateImageBounds = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;
    
    const media = imageRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    // Get container rect - this is our canvas size reference (in zoomed space)
    const containerRect = container.getBoundingClientRect();
    
    // Get the actual rendered media rect (in zoomed space)
    const mediaRect = media.getBoundingClientRect();
    
    // Calculate offset of media within container (in zoomed space)
    const offsetX = mediaRect.left - containerRect.left;
    const offsetY = mediaRect.top - containerRect.top;
    
    // Scale down by zoom to get unzoomed/canvas-space coordinates
    // The CSS transform scales the visual, but canvas draws at original size
    const zoom = viewState.zoom;
    const unzoomedBounds = new DOMRect(
      offsetX / zoom,
      offsetY / zoom,
      mediaRect.width / zoom,
      mediaRect.height / zoom
    );
    setImageBounds(unzoomedBounds);
    
    // Update canvas size with device pixel ratio for crisp rendering
    // Canvas size should be based on unzoomed container size
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const unzoomedWidth = containerRect.width / zoom;
      const unzoomedHeight = containerRect.height / zoom;
      
      // Set display size (CSS) - this will be scaled by parent's CSS transform
      canvas.style.width = `${unzoomedWidth}px`;
      canvas.style.height = `${unzoomedHeight}px`;
      
      // Set actual canvas pixel size (accounting for DPR)
      canvas.width = Math.floor(unzoomedWidth * dpr);
      canvas.height = Math.floor(unzoomedHeight * dpr);
      
      // Scale canvas context to account for DPR
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  }, [imageRef, viewState.zoom]);

  // Update bounds on mount, resize, and zoom changes
  useEffect(() => {
    // Initial update with slight delay to ensure media is rendered
    const initialTimeout = setTimeout(updateImageBounds, 100);
    
    const handleResize = () => {
      // Debounce resize to avoid excessive updates
      requestAnimationFrame(updateImageBounds);
    };
    
    // Listen for zoom changes via visualViewport
    const handleZoom = () => {
      requestAnimationFrame(updateImageBounds);
    };
    
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleZoom);
    window.visualViewport?.addEventListener('scroll', handleZoom);
    
    // Also update when media loads
    const media = imageRef.current;
    if (media) {
      // For images
      media.addEventListener('load', updateImageBounds);
      // For videos
      media.addEventListener('loadedmetadata', updateImageBounds);
      media.addEventListener('loadeddata', updateImageBounds);
    }
    
    // Use ResizeObserver for container size changes (including zoom)
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    }
    
    // Also observe the media element itself for size changes
    let mediaObserver: ResizeObserver | null = null;
    if (media) {
      mediaObserver = new ResizeObserver(handleResize);
      mediaObserver.observe(media);
    }
    
    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleZoom);
      window.visualViewport?.removeEventListener('scroll', handleZoom);
      if (media) {
        media.removeEventListener('load', updateImageBounds);
        media.removeEventListener('loadedmetadata', updateImageBounds);
        media.removeEventListener('loadeddata', updateImageBounds);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mediaObserver) {
        mediaObserver.disconnect();
      }
    };
  }, [updateImageBounds, imageRef]);

  // Convert screen coordinates to normalized image coordinates (0-1)
  // Convert screen coordinates to normalized image coordinates (0-1 range)
  // Since the parent container handles zoom/pan visually with CSS transform,
  // mouse coordinates from getBoundingClientRect are already in zoomed space.
  // The canvas and image scale together, so coordinates map directly.
  const screenToNormalized = useCallback((screenX: number, screenY: number): Point | null => {
    if (!imageBounds) return null;
    
    // The imageBounds are from the unzoomed image within the canvas
    // Screen coordinates from events are relative to the zoomed canvas element
    // Since canvas and image are both zoomed by CSS, the ratio stays the same
    
    // Clamp to image bounds
    const clampedX = Math.max(imageBounds.x, Math.min(imageBounds.x + imageBounds.width, screenX));
    const clampedY = Math.max(imageBounds.y, Math.min(imageBounds.y + imageBounds.height, screenY));
    
    return {
      x: (clampedX - imageBounds.x) / imageBounds.width,
      y: (clampedY - imageBounds.y) / imageBounds.height
    };
  }, [imageBounds]);

  // Convert normalized image coordinates (0-1) to screen coordinates
  // Canvas draws at 1:1 with the image, parent handles visual zoom
  const normalizedToScreen = useCallback((normX: number, normY: number): Point => {
    if (!imageBounds) return { x: 0, y: 0 };
    
    const baseX = imageBounds.x + normX * imageBounds.width;
    const baseY = imageBounds.y + normY * imageBounds.height;
    
    return { x: baseX, y: baseY };
  }, [imageBounds]);

  // Redraw all annotations
  const redrawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBounds) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get CSS display size for clearing (not the scaled canvas size)
    const displayWidth = canvas.clientWidth || canvas.width;
    const displayHeight = canvas.clientHeight || canvas.height;
    
    // Clear canvas using display coordinates (context is already scaled by DPR)
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw all saved annotations for current evidence
    currentAnnotations.forEach(ann => drawAnnotation(ctx, ann));

    // Draw current drawing in progress
    if (isDrawing && startPoint && currentPoint && currentTool) {
      const tempAnnotation: Annotation = {
        id: 'temp',
        type: currentTool as any,
        evidenceId: currentEvidenceId,
        data: getAnnotationData(currentTool, startPoint, currentPoint, freehandPoints),
        color: currentColor,
        strokeWidth
      };
      drawAnnotation(ctx, tempAnnotation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnnotations, isDrawing, startPoint, currentPoint, currentTool, currentColor, strokeWidth, freehandPoints, imageBounds, currentEvidenceId, normalizedToScreen]);

  // Redraw when annotations change or image bounds change
  useEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

  // Get annotation data based on tool type (all in normalized coordinates)
  const getAnnotationData = (
    tool: string,
    start: Point,
    end: Point,
    points: Point[]
  ): any => {
    switch (tool) {
      case 'circle':
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        return { cx, cy, rx, ry };
      
      case 'arrow':
        return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
      
      case 'rectangle':
        return {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y)
        };
      
      case 'freehand':
      case 'highlight':
        return { points: points.length > 0 ? points : [start, end] };
      
      default:
        return {};
    }
  };

  // Draw a single annotation (convert from normalized to screen coords)
  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation) => {
    if (!imageBounds) return;
    
    ctx.save();
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    
    // Scale stroke width relative to image size for consistency across different screen sizes
    // Base reference: 2px stroke at 500px image width
    const strokeScale = Math.max(imageBounds.width, imageBounds.height) / 500;
    ctx.lineWidth = Math.max(1, ann.strokeWidth * strokeScale);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (ann.type) {
      case 'circle': {
        const center = normalizedToScreen(ann.data.cx, ann.data.cy);
        // Radii at 1:1 scale (parent handles visual zoom)
        const rx = ann.data.rx * imageBounds.width;
        const ry = ann.data.ry * imageBounds.height;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, Math.max(rx, 1), Math.max(ry, 1), 0, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }

      case 'arrow': {
        const p1 = normalizedToScreen(ann.data.x1, ann.data.y1);
        const p2 = normalizedToScreen(ann.data.x2, ann.data.y2);
        // Scale arrowhead size relative to image
        const headLength = Math.max(10, 15 * strokeScale);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle - Math.PI / 6),
          p2.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle + Math.PI / 6),
          p2.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'rectangle': {
        const topLeft = normalizedToScreen(ann.data.x, ann.data.y);
        // Dimensions at 1:1 scale (parent handles visual zoom)
        const width = ann.data.width * imageBounds.width;
        const height = ann.data.height * imageBounds.height;
        ctx.strokeRect(topLeft.x, topLeft.y, width, height);
        break;
      }

      case 'freehand': {
        if (ann.data.points && ann.data.points.length > 0) {
          ctx.beginPath();
          const firstPoint = normalizedToScreen(ann.data.points[0].x, ann.data.points[0].y);
          ctx.moveTo(firstPoint.x, firstPoint.y);
          for (let i = 1; i < ann.data.points.length; i++) {
            const point = normalizedToScreen(ann.data.points[i].x, ann.data.points[i].y);
            ctx.lineTo(point.x, point.y);
          }
          ctx.stroke();
        }
        break;
      }

      case 'highlight': {
        if (ann.data.points && ann.data.points.length > 0) {
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 20;
          ctx.beginPath();
          const firstPoint = normalizedToScreen(ann.data.points[0].x, ann.data.points[0].y);
          ctx.moveTo(firstPoint.x, firstPoint.y);
          for (let i = 1; i < ann.data.points.length; i++) {
            const point = normalizedToScreen(ann.data.points[i].x, ann.data.points[i].y);
            ctx.lineTo(point.x, point.y);
          }
          ctx.stroke();
        }
        break;
      }

      case 'text': {
        const pos = normalizedToScreen(ann.data.x, ann.data.y);
        // Scale font size relative to image size
        const fontSize = Math.max(12, ann.strokeWidth * 8 * strokeScale);
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(ann.data.text || '', pos.x, pos.y);
        break;
      }
    }

    // Draw user indicator for collaborative annotations
    if (ann.userName && ann.id !== 'temp') {
      // Scale label font size relative to image
      const labelFontSize = Math.max(9, 11 * strokeScale);
      ctx.font = `bold ${labelFontSize}px Arial`;
      ctx.globalAlpha = 0.9;
      const textWidth = ctx.measureText(ann.userName).width;
      
      const labelOffset = Math.max(6, 8 * strokeScale);
      const padding = Math.max(3, 4 * strokeScale);
      const pillHeight = Math.max(14, 16 * strokeScale);
      
      let labelX = 0, labelY = 0;
      switch (ann.type) {
        case 'circle': {
          const center = normalizedToScreen(ann.data.cx, ann.data.cy);
          const ry = ann.data.ry * imageBounds.height;
          labelX = center.x - textWidth / 2;
          labelY = center.y - ry - labelOffset;
          break;
        }
        case 'arrow': {
          const p2 = normalizedToScreen(ann.data.x2, ann.data.y2);
          labelX = p2.x + 5;
          labelY = p2.y - labelOffset;
          break;
        }
        case 'rectangle': {
          const topLeft = normalizedToScreen(ann.data.x, ann.data.y);
          labelX = topLeft.x;
          labelY = topLeft.y - labelOffset;
          break;
        }
        case 'freehand':
        case 'highlight': {
          if (ann.data.points?.[0]) {
            const firstPoint = normalizedToScreen(ann.data.points[0].x, ann.data.points[0].y);
            labelX = firstPoint.x;
            labelY = firstPoint.y - labelOffset;
          }
          break;
        }
        case 'text': {
          const pos = normalizedToScreen(ann.data.x, ann.data.y);
          // Position label above the text with extra offset to avoid blocking
          // Account for the text font size plus label height
          const textFontSize = Math.max(12, ann.strokeWidth * 8 * strokeScale);
          labelX = pos.x;
          labelY = pos.y - textFontSize - labelOffset;
          break;
        }
      }
      
      // Draw background pill for better readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(labelX - padding, labelY - pillHeight + 4, textWidth + padding * 2, pillHeight, 4);
      ctx.fill();
      
      // Draw username text
      ctx.fillStyle = '#fff';
      ctx.fillText(ann.userName, labelX, labelY);
    }

    ctx.restore();
  };

  // Get mouse/touch position relative to canvas and convert to normalized coordinates
  // Account for CSS zoom transform - screen coordinates need to be scaled down
  const getEventPos = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Get position relative to the zoomed canvas rect
    const zoomedX = clientX - rect.left;
    const zoomedY = clientY - rect.top;
    
    // Scale down by zoom to get actual canvas coordinates
    // Since the CSS transform scales the container, the rect is larger than the actual canvas
    const zoom = viewState.zoom;
    const screenX = zoomedX / zoom;
    const screenY = zoomedY / zoom;
    
    return screenToNormalized(screenX, screenY);
  };

  // Get screen position for text input
  const getScreenPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Handle mouse/touch down
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    // Handle pan mode
    if (isPanning && viewState.zoom > 1) {
      const screenPos = getScreenPos(e);
      setLocalIsPanning(true);
      panStartRef.current = screenPos;
      lastPanRef.current = { x: viewState.panX, y: viewState.panY };
      return;
    }
    
    if (disabled || !currentTool) return;
    
    const pos = getEventPos(e);
    if (!pos) return; // Click was outside image bounds
    
    if (currentTool === 'text') {
      const screenPos = getScreenPos(e);
      setTextInput({ x: screenPos.x, y: screenPos.y, visible: true });
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    
    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentPoint(pos);
    
    if (currentTool === 'freehand' || currentTool === 'highlight') {
      setFreehandPoints([pos]);
    }
  };

  // Handle mouse/touch move
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    // Handle panning
    if (localIsPanning && panStartRef.current) {
      const screenPos = getScreenPos(e);
      const deltaX = screenPos.x - panStartRef.current.x;
      const deltaY = screenPos.y - panStartRef.current.y;
      
      // Calculate pan limits based on zoom level
      // Allow panning up to half the visible overflow on each side
      const containerWidth = containerRef.current?.clientWidth || 400;
      const containerHeight = containerRef.current?.clientHeight || 300;
      const maxPanX = (containerWidth * (viewState.zoom - 1)) / 2;
      const maxPanY = (containerHeight * (viewState.zoom - 1)) / 2;
      
      const newPanX = Math.max(-maxPanX, Math.min(maxPanX, lastPanRef.current.x + deltaX));
      const newPanY = Math.max(-maxPanY, Math.min(maxPanY, lastPanRef.current.y + deltaY));
      
      onViewStateChange?.({ ...viewState, panX: newPanX, panY: newPanY });
      return;
    }
    
    if (!isDrawing || disabled || !currentTool) return;
    
    e.preventDefault();
    
    const pos = getEventPos(e);
    if (!pos) return;
    
    setCurrentPoint(pos);
    
    if (currentTool === 'freehand' || currentTool === 'highlight') {
      setFreehandPoints(prev => [...prev, pos]);
    }
  };

  // Handle mouse/touch up
  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    // End panning
    if (localIsPanning) {
      setLocalIsPanning(false);
      panStartRef.current = null;
      return;
    }
    
    if (!isDrawing || disabled || !currentTool || !startPoint) return;
    
    e.preventDefault();
    
    // For touch end, use the last known current point
    const endPoint = currentPoint || startPoint;
    
    // Ensure we have valid coordinates
    if (!endPoint) return;
    
    // Create annotation with normalized coordinates
    const annotation: Annotation = {
      id: generateId(),
      type: currentTool as any,
      evidenceId: currentEvidenceId,
      data: getAnnotationData(currentTool, startPoint, endPoint, freehandPoints),
      color: currentColor,
      strokeWidth
    };
    
    onAddAnnotation(annotation);
    
    // Reset state
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    setFreehandPoints([]);
  };

  // Handle text annotation
  const handleTextSubmit = () => {
    if (!textValue.trim() || !imageBounds) {
      setTextInput({ ...textInput, visible: false });
      setTextValue('');
      return;
    }

    // Convert screen position to normalized
    // textInput.x/y are in zoomed screen space, need to scale down by zoom
    const zoom = viewState.zoom;
    const unzoomedX = textInput.x / zoom;
    const unzoomedY = textInput.y / zoom;
    const normalizedPos = screenToNormalized(unzoomedX, unzoomedY);
    if (!normalizedPos) {
      setTextInput({ ...textInput, visible: false });
      setTextValue('');
      return;
    }

    const annotation: Annotation = {
      id: generateId(),
      type: 'text',
      evidenceId: currentEvidenceId,
      data: { x: normalizedPos.x, y: normalizedPos.y, text: textValue },
      color: currentColor,
      strokeWidth
    };

    onAddAnnotation(annotation);
    setTextValue('');
    setTextInput({ ...textInput, visible: false });
  };

  // Cursor style based on tool and pan mode
  const getCursor = () => {
    if (disabled) return 'default';
    if (isPanning && viewState.zoom > 1) {
      return localIsPanning ? 'grabbing' : 'grab';
    }
    if (!currentTool) return 'default';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-auto touch-none"
      style={{ cursor: getCursor() }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      />
      
      {/* Text input for text annotation */}
      {textInput.visible && (
        <input
          ref={inputRef}
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit();
            if (e.key === 'Escape') {
              setTextInput({ ...textInput, visible: false });
              setTextValue('');
            }
          }}
          onBlur={handleTextSubmit}
          className="absolute bg-black/50 text-white border-b border-white outline-none px-1 rounded"
          style={{
            // textInput.x/y are in zoomed screen space, but this container is in unzoomed space
            // (CSS transform handles the visual scaling), so we divide by zoom
            left: Math.min(textInput.x / viewState.zoom, (containerRef.current?.clientWidth || 200) - 150),
            top: Math.max((textInput.y / viewState.zoom) - 25, 5),
            color: currentColor,
            fontSize: `${strokeWidth * 8}px`,
            minWidth: '100px',
            maxWidth: '200px'
          }}
          placeholder="Type text..."
        />
      )}
      
      {/* Instruction overlay when tool selected but not drawing */}
      {currentTool && !isDrawing && !textInput.visible && !isPanning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none select-none">
          {currentTool === 'text' 
            ? 'Tap to add text' 
            : currentTool === 'freehand' 
            ? 'Draw on image' 
            : 'Drag to create shape'
          }
        </div>
      )}
    </div>
  );
});

AnnotationCanvas.displayName = 'AnnotationCanvas';

export default AnnotationCanvas;
