'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
  isOnline?: boolean;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onSubmit?: () => void;
  participants: Participant[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxRows?: number;
  minRows?: number;
}

export interface MentionInputHandle {
  focus: () => void;
  getValue: () => string;
}

const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      onSubmit,
      participants,
      placeholder = 'Type a message... Use @ to mention',
      className = '',
      disabled = false,
      maxRows = 6,
      minRows = 1,
    },
    ref
  ) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    
    // Line height for calculating textarea height (matches text-sm = 14px, with padding)
    const lineHeight = 20;
    const paddingY = 16; // py-2 = 8px top + 8px bottom
    const minHeight = lineHeight * minRows + paddingY;
    const maxHeight = lineHeight * maxRows + paddingY;

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      getValue: () => value,
    }));

    // Auto-resize textarea based on content
    const adjustTextareaHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      // Reset height to calculate scrollHeight correctly
      textarea.style.height = `${minHeight}px`;
      
      // Calculate new height based on content
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      
      textarea.style.height = `${newHeight}px`;
      
      // Show/hide scrollbar based on content overflow
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }, [minHeight, maxHeight]);

    // Adjust height when value changes
    useEffect(() => {
      adjustTextareaHeight();
    }, [value, adjustTextareaHeight]);

    // Filter participants based on mention query
    const filteredParticipants = participants.filter((p) => {
      if (!p.firstName) return false; // Skip participants without names
      if (!mentionQuery) return true;
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      const query = mentionQuery.toLowerCase();
      return fullName.includes(query) || p.email?.toLowerCase().includes(query);
    });

    // Check for @ symbol and manage mention state
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursorPos = e.target.selectionStart || 0;
        
        onChange(newValue);
        setCursorPosition(newCursorPos);

        // Look for @ symbol before cursor
        const textBeforeCursor = newValue.substring(0, newCursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');
        
        if (atIndex !== -1) {
          // Check if @ is at start or preceded by whitespace
          const charBefore = textBeforeCursor[atIndex - 1];
          if (atIndex === 0 || charBefore === ' ' || charBefore === '\n') {
            const query = textBeforeCursor.substring(atIndex + 1);
            // Make sure there's no space or newline after @ (which would end the mention)
            if (!query.includes(' ') && !query.includes('\n')) {
              setMentionQuery(query);
              setMentionStartIndex(atIndex);
              setShowSuggestions(true);
              setSelectedIndex(0);
              return;
            }
          }
        }
        
        setShowSuggestions(false);
        setMentionQuery('');
        setMentionStartIndex(-1);
      },
      [onChange]
    );

    // Handle keyboard navigation in suggestions
    const handleKeyDownInternal = useCallback(
      (e: React.KeyboardEvent) => {
        if (showSuggestions && filteredParticipants.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, filteredParticipants.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
            return;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            selectParticipant(filteredParticipants[selectedIndex]);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setShowSuggestions(false);
            return;
          }
        }

        // Call parent onKeyDown if not handled
        onKeyDown?.(e);
      },
      [showSuggestions, filteredParticipants, selectedIndex, onKeyDown]
    );

    // Insert mention into text
    const selectParticipant = useCallback(
      (participant: Participant) => {
        if (mentionStartIndex === -1) return;

        const beforeMention = value.substring(0, mentionStartIndex);
        const afterMention = value.substring(cursorPosition);
        
        // Format: @[userId]DisplayName - we store userId in brackets for backend parsing
        // and show display name for readability
        const mentionText = `@[${participant.id}]${participant.firstName} `;
        const newValue = beforeMention + mentionText + afterMention;
        
        onChange(newValue);
        setShowSuggestions(false);
        setMentionQuery('');
        setMentionStartIndex(-1);

        // Move cursor after mention
        setTimeout(() => {
          const newCursorPos = beforeMention.length + mentionText.length;
          textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current?.focus();
        }, 0);
      },
      [value, mentionStartIndex, cursorPosition, onChange]
    );

    // Close suggestions when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          suggestionsRef.current &&
          !suggestionsRef.current.contains(event.target as Node) &&
          textareaRef.current &&
          !textareaRef.current.contains(event.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll selected item into view
    useEffect(() => {
      if (showSuggestions && suggestionsRef.current) {
        const selectedEl = suggestionsRef.current.children[selectedIndex] as HTMLElement;
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'nearest' });
        }
      }
    }, [selectedIndex, showSuggestions]);

    return (
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDownInternal}
          placeholder={placeholder}
          disabled={disabled}
          rows={minRows}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: `${maxHeight}px`,
            resize: 'none',
            fontSize: '16px', // Prevents iOS zoom on focus
          }}
          className={`w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-2xl text-base sm:text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 ease-in-out leading-5 ${className}`}
        />

        {/* Mention Suggestions Dropdown */}
        {showSuggestions && filteredParticipants.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50"
          >
            <div className="p-1">
              <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                Participants
              </div>
              {filteredParticipants.map((participant, index) => (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => selectParticipant(participant)}
                  className={`w-full flex items-center px-3 py-2 rounded-md transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                      {participant.firstName?.[0] || 'U'}
                      {participant.lastName?.[0]}
                    </div>
                    {participant.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full" />
                    )}
                  </div>

                  {/* Name and role */}
                  <div className="ml-3 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {participant.firstName || 'Unknown'} {participant.lastName || ''}
                    </div>
                    {participant.role && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {participant.role.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showSuggestions && filteredParticipants.length === 0 && mentionQuery && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl p-3 z-50">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              No participants found matching &quot;{mentionQuery}&quot;
            </p>
          </div>
        )}
      </div>
    );
  }
);

MentionInput.displayName = 'MentionInput';

export default MentionInput;

// Helper function to render message content with highlighted mentions
export function renderMessageWithMentions(
  content: string,
  mentions: string[],
  participants: Participant[],
  currentUserId: string
): React.ReactNode {
  if (!mentions || mentions.length === 0) {
    return content;
  }

  // Pattern to match @[userId]DisplayName
  const mentionPattern = /@\[([a-f0-9-]+)\](\w+)/gi;
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const userId = match[1];
    const displayName = match[2];
    const participant = participants.find((p) => p.id === userId);
    const isCurrentUser = userId === currentUserId;

    // Add highlighted mention
    parts.push(
      <span
        key={`mention-${match.index}`}
        className={`inline-flex items-center px-1 py-0.5 rounded ${
          isCurrentUser
            ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 font-medium'
            : 'bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-gray-200'
        }`}
        title={participant ? `${participant.firstName} ${participant.lastName}` : displayName}
      >
        @{participant?.firstName || displayName}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <>{parts}</>;
}
