'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

/* ────────────────────────────────────────────────────────────────────────────
 * MindMapEditor — jsMind wrapper for React / Next.js
 *
 * Renders an interactive mind map with:
 *   • Tab = add child, Enter = add sibling, Delete = remove, F2 = edit
 *   • Drag-to-rearrange nodes (via draggable-node plugin)
 *   • Mouse wheel zoom
 *   • get_data() / show() for save/load
 * ──────────────────────────────────────────────────────────────────────────── */

export interface MindMapData {
  meta: { name: string; author: string; version: string };
  format: string;
  data: any[];
}

export interface MindMapEditorHandle {
  getData: () => MindMapData | null;
  getInstance: () => any | null;
}

interface MindMapEditorProps {
  initialData?: MindMapData | null;
  onChange?: () => void;
  editable?: boolean;
  theme?: string;
}

const DEFAULT_MIND: MindMapData = {
  meta: { name: 'Mind Map', author: 'DashMet', version: '0.2' },
  format: 'node_array',
  data: [
    { id: 'root', isroot: true, topic: 'Central Idea' },
    { id: 'topic1', parentid: 'root', topic: 'Topic 1', direction: 'right' },
    { id: 'topic2', parentid: 'root', topic: 'Topic 2', direction: 'right' },
    { id: 'topic3', parentid: 'root', topic: 'Topic 3', direction: 'left' },
    { id: 'topic4', parentid: 'root', topic: 'Topic 4', direction: 'left' },
    { id: 'sub1_1', parentid: 'topic1', topic: 'Sub-topic 1.1' },
    { id: 'sub1_2', parentid: 'topic1', topic: 'Sub-topic 1.2' },
    { id: 'sub2_1', parentid: 'topic2', topic: 'Sub-topic 2.1' },
    { id: 'sub3_1', parentid: 'topic3', topic: 'Sub-topic 3.1' },
  ],
};

const MindMapEditor = forwardRef<MindMapEditorHandle, MindMapEditorProps>(
  ({ initialData, onChange, editable = true, theme = 'primary' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const jmRef = useRef<any>(null);
    const jsMindModule = useRef<any>(null);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      getData: () => {
        if (!jmRef.current) return null;
        return jmRef.current.get_data('node_array');
      },
      getInstance: () => jmRef.current,
    }));

    // Change handler (debounced notification)
    const notifyChange = useCallback(() => {
      onChange?.();
    }, [onChange]);

    useEffect(() => {
      if (!containerRef.current) return;

      let jm: any = null;

      (async () => {
        // Dynamic import (ESM, client-only)
        const jsMindDefault = await import('jsmind');
        const jsMind = jsMindDefault.default;
        jsMindModule.current = jsMind;

        // Load drag plugin
        try {
          await import('jsmind/draggable-node');
        } catch (e) {
          console.warn('jsMind draggable-node plugin not loaded:', e);
        }

        const options = {
          container: containerRef.current!,
          editable,
          theme,
          mode: 'both',
          support_html: false,
          view: {
            engine: 'canvas',
            draggable: true,
            hide_scrollbars_when_draggable: true,
            zoom: {
              min: 0.3,
              max: 3,
              step: 0.1,
            },
            line_width: 2,
            line_color: '#94a3b8',
            node_overflow: 'wrap',
          },
          layout: {
            hspace: 60,
            vspace: 25,
            pspace: 13,
          },
          shortcut: {
            enable: true,
            handles: {},
            mapping: {
              addchild: [9],      // Tab
              addbrother: [13],   // Enter
              editnode: [113],    // F2
              delnode: [46],      // Delete
              toggle: [32],       // Space to expand/collapse
              left: [37],
              up: [38],
              right: [39],
              down: [40],
            },
          },
        };

        jm = new jsMind(options);
        jmRef.current = jm;

        const mind = initialData || DEFAULT_MIND;
        jm.show(mind);

        // Style the root node
        try {
          jm.set_node_color('root', '#3b82f6', '#ffffff');
          jm.set_node_font_style('root', 16, 'bold');
        } catch (e) {
          // Nodes may not support styling in all versions
        }

        // Listen for edits
        jm.add_event_listener((type: number) => {
          // type 2 = edit, 3 = select 
          if (type === 2) {
            notifyChange();
          }
        });
      })();

      return () => {
        // Cleanup
        jmRef.current = null;
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div
        ref={containerRef}
        id="jsmind_container"
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
    );
  }
);

MindMapEditor.displayName = 'MindMapEditor';
export default MindMapEditor;
