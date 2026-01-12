'use client';

import React, { useEffect } from 'react';
import { X, Users } from 'lucide-react';
import TeamParticipantSelector from './TeamParticipantSelector';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: { name: string };
  isOnline?: boolean;
}

interface Participant {
  id: string;
  userId: string;
  role: 'OWNER' | 'LEAD' | 'MEMBER' | 'OBSERVER';
  canEdit: boolean;
  canChat: boolean;
  isActive?: boolean;
  user: User;
}

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId?: string;
  organizationId: string;
  currentUserId: string;
  selectedParticipants: Participant[];
  onParticipantsChange: (participants: Participant[]) => void;
  isTeamIncident?: boolean;
}

export default function TeamMembersModal({
  isOpen,
  onClose,
  incidentId,
  organizationId,
  currentUserId,
  selectedParticipants,
  onParticipantsChange,
  isTeamIncident = false,
}: TeamMembersModalProps) {
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl transform rounded-2xl bg-white dark:bg-slate-900 shadow-2xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Team Members
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add collaborators to participate in the Incident & RCA
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {!incidentId && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Save as draft first
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Team members added now will be saved when you submit the incident. Save as draft to enable real-time collaboration features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <TeamParticipantSelector
              incidentId={incidentId}
              organizationId={organizationId}
              currentUserId={currentUserId}
              selectedParticipants={selectedParticipants}
              onParticipantsChange={onParticipantsChange}
              isTeamIncident={isTeamIncident}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''} added
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
