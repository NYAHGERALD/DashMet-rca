'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  position?: 'top' | 'bottom';
  triggerClassName?: string;
}

const COMMON_EMOJIS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '👎', label: 'Thumbs down' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Joy' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '👀', label: 'Eyes' },
  { emoji: '🙏', label: 'Pray' },
  { emoji: '💯', label: '100' },
  { emoji: '✅', label: 'Check' },
];

export default function EmojiPicker({
  onSelect,
  onClose,
  position = 'top',
  triggerClassName = '',
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onClose?.();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
    onClose?.();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${triggerClassName}`}
        title="Add reaction"
      >
        <Smile className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } right-0 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 p-2`}
        >
          <div className="grid grid-cols-6 gap-1">
            {COMMON_EMOJIS.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick reaction bar component
interface QuickReactionBarProps {
  onSelect: (emoji: string) => void;
  showAll?: boolean;
}

export function QuickReactionBar({ onSelect, showAll = false }: QuickReactionBarProps) {
  const quickEmojis = showAll ? COMMON_EMOJIS : COMMON_EMOJIS.slice(0, 6);

  return (
    <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 p-1.5">
      {quickEmojis.map(({ emoji, label }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="w-7 h-7 flex items-center justify-center text-base rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-all hover:scale-110"
          title={label}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// Reactions display component
interface Reaction {
  emoji: string;
  count: number;
  users: { id: string; firstName: string; lastName: string }[];
  hasReacted?: boolean;
}

interface ReactionsDisplayProps {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
  currentUserId: string;
  compact?: boolean;
}

export function ReactionsDisplay({
  reactions,
  onToggle,
  currentUserId,
  compact = false,
}: ReactionsDisplayProps) {
  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji and check if current user has reacted
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const users = reaction.users || [];
    const hasReacted = users.some(u => u?.id === currentUserId);
    return [
      ...acc,
      {
        ...reaction,
        users,
        hasReacted,
      },
    ];
  }, [] as (Reaction & { hasReacted: boolean })[]);

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? 'mt-1' : 'mt-2'}`}>
      {groupedReactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onToggle(reaction.emoji)}
          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs transition-all hover:scale-105 ${
            reaction.hasReacted
              ? 'bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-600'
              : 'bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600'
          }`}
          title={(reaction.users || []).filter(u => u).map(u => `${u.firstName} ${u.lastName}`).join(', ')}
        >
          <span>{reaction.emoji}</span>
          <span className={reaction.hasReacted ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-300'}>
            {reaction.count}
          </span>
        </button>
      ))}
    </div>
  );
}
