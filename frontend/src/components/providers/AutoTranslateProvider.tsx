// Auto-Translation Layer
// Automatically translates all visible text on the page using DOM observation

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from './TranslationProvider';

// Elements to skip translation
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 
  'CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'TEXTAREA', 'INPUT'
]);

// Attributes that indicate the element should not be translated
const SKIP_ATTRIBUTES = ['data-no-translate', 'translate'];

// Minimum text length to translate (skip very short strings)
const MIN_TEXT_LENGTH = 2;

// Cache for original text values
const originalTextCache = new WeakMap<Node, string>();

// Track which nodes have been translated
const translatedNodes = new WeakSet<Node>();

// Debounce translation requests
let translationQueue: Set<Node> = new Set();
let translationTimeout: NodeJS.Timeout | null = null;
const TRANSLATION_DEBOUNCE = 150;

interface AutoTranslateProviderProps {
  children: React.ReactNode;
}

export function AutoTranslateProvider({ children }: AutoTranslateProviderProps) {
  const { translate, language, isEnabled } = useTranslation();
  const observerRef = useRef<MutationObserver | null>(null);
  const isTranslatingRef = useRef(false);

  // Check if a node should be translated
  const shouldTranslateNode = useCallback((node: Node): boolean => {
    if (node.nodeType !== Node.TEXT_NODE) return false;
    
    const text = node.textContent?.trim();
    if (!text || text.length < MIN_TEXT_LENGTH) return false;
    
    // Skip if it's just numbers, symbols, or whitespace
    if (/^[\d\s\-_.,;:!?@#$%^&*()+=<>[\]{}|\\/"'`~]+$/.test(text)) return false;
    
    // Check parent elements
    let parent = node.parentElement;
    while (parent) {
      // Skip certain tags
      if (SKIP_TAGS.has(parent.tagName)) return false;
      
      // Skip elements with no-translate attributes
      for (const attr of SKIP_ATTRIBUTES) {
        if (parent.hasAttribute(attr) && parent.getAttribute(attr) === 'no') {
          return false;
        }
      }
      
      // Skip contenteditable elements
      if (parent.isContentEditable) return false;
      
      parent = parent.parentElement;
    }
    
    return true;
  }, []);

  // Get all text nodes in an element
  const getTextNodes = useCallback((element: Element): Node[] => {
    const textNodes: Node[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return shouldTranslateNode(node) 
            ? NodeFilter.FILTER_ACCEPT 
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let node: Node | null;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    return textNodes;
  }, [shouldTranslateNode]);

  // Translate a batch of text nodes
  const translateNodes = useCallback(async (nodes: Node[]) => {
    if (isTranslatingRef.current || language === 'en' || !isEnabled) return;
    
    isTranslatingRef.current = true;
    
    try {
      // Collect unique texts to translate
      const textsToTranslate: Map<string, Node[]> = new Map();
      
      for (const node of nodes) {
        const text = node.textContent?.trim();
        if (!text) continue;
        
        // Store original text if not already cached
        if (!originalTextCache.has(node)) {
          originalTextCache.set(node, text);
        }
        
        const original = originalTextCache.get(node)!;
        
        if (!textsToTranslate.has(original)) {
          textsToTranslate.set(original, []);
        }
        textsToTranslate.get(original)!.push(node);
      }
      
      // Translate each unique text
      for (const [originalText, nodeList] of textsToTranslate) {
        const translated = translate(originalText);
        
        // Apply translation to all nodes with this text
        for (const node of nodeList) {
          if (translated !== originalText && node.textContent !== translated) {
            node.textContent = translated;
            translatedNodes.add(node);
          }
        }
      }
    } finally {
      isTranslatingRef.current = false;
    }
  }, [translate, language, isEnabled]);

  // Queue nodes for translation
  const queueTranslation = useCallback((nodes: Node[]) => {
    for (const node of nodes) {
      translationQueue.add(node);
    }
    
    if (translationTimeout) {
      clearTimeout(translationTimeout);
    }
    
    translationTimeout = setTimeout(() => {
      const nodesToTranslate = Array.from(translationQueue);
      translationQueue.clear();
      translateNodes(nodesToTranslate);
    }, TRANSLATION_DEBOUNCE);
  }, [translateNodes]);

  // Revert translations back to original text
  const revertTranslations = useCallback(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );
    
    let node: Node | null;
    while (node = walker.nextNode()) {
      if (originalTextCache.has(node)) {
        const original = originalTextCache.get(node)!;
        if (node.textContent !== original) {
          node.textContent = original;
        }
      }
    }
  }, []);

  // Handle DOM mutations
  const handleMutations = useCallback((mutations: MutationRecord[]) => {
    if (language === 'en' || !isEnabled) return;
    
    const nodesToTranslate: Node[] = [];
    
    for (const mutation of mutations) {
      // Handle added nodes
      if (mutation.type === 'childList') {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.TEXT_NODE) {
            if (shouldTranslateNode(addedNode)) {
              nodesToTranslate.push(addedNode);
            }
          } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
            const textNodes = getTextNodes(addedNode as Element);
            nodesToTranslate.push(...textNodes);
          }
        }
      }
      
      // Handle text content changes
      if (mutation.type === 'characterData') {
        if (shouldTranslateNode(mutation.target)) {
          // Reset the cache for this node since text changed
          originalTextCache.delete(mutation.target);
          nodesToTranslate.push(mutation.target);
        }
      }
    }
    
    if (nodesToTranslate.length > 0) {
      queueTranslation(nodesToTranslate);
    }
  }, [language, isEnabled, shouldTranslateNode, getTextNodes, queueTranslation]);

  // Initialize and cleanup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Initial translation of existing content
    if (language !== 'en' && isEnabled) {
      const textNodes = getTextNodes(document.body);
      if (textNodes.length > 0) {
        queueTranslation(textNodes);
      }
    } else if (language === 'en' || !isEnabled) {
      // Revert to original text
      revertTranslations();
    }
    
    // Set up mutation observer
    observerRef.current = new MutationObserver(handleMutations);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (translationTimeout) {
        clearTimeout(translationTimeout);
      }
    };
  }, [language, isEnabled, getTextNodes, queueTranslation, handleMutations, revertTranslations]);

  // Re-translate when language changes
  useEffect(() => {
    if (language !== 'en' && isEnabled) {
      // Clear translated nodes cache to force re-translation
      const textNodes = getTextNodes(document.body);
      if (textNodes.length > 0) {
        queueTranslation(textNodes);
      }
    }
  }, [language, isEnabled, getTextNodes, queueTranslation]);

  return <>{children}</>;
}

export default AutoTranslateProvider;
