'use client';

import React from 'react';
import { X, Users, Clock, User, Check, XCircle, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/dateUtils';

interface InvitedBy {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface IncidentOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Incident {
  id: string;
  incidentNumber: string;
  customTitle: string | null;
  status: string;
  visibility: string;
  createdAt: string;
  createdBy: IncidentOwner;
  _count: {
    participants: number;
  };
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profilePicture?: string | null;
}

interface Invitation {
  id: string;
  incidentId: string;
  userId: string;
  role: string;
  invitationStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  invitedAt: string;
  incident: Incident;
  addedBy: InvitedBy | null;
  teamMembers: TeamMember[];
}

interface InvitationModalProps {
  isOpen: boolean;
  invitation: Invitation | null;
  onAccept: (incidentId: string) => void;
  onDecline: (incidentId: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'SUBMITTED':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    case 'RESOLVED':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'CLOSED':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
};

export default function InvitationModal({
  isOpen,
  invitation,
  onAccept,
  onDecline,
  onCancel,
  isLoading,
}: InvitationModalProps) {
  if (!isOpen || !invitation) return null;

  const { incident, addedBy, teamMembers } = invitation;
  const inviterName = addedBy ? `${addedBy.firstName} ${addedBy.lastName}` : 'Unknown';
  const ownerName = incident.createdBy 
    ? `${incident.createdBy.firstName} ${incident.createdBy.lastName}` 
    : 'Unknown';
  const displayTitle = incident.customTitle || incident.incidentNumber;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-t-xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-full bg-blue-100 dark:bg-blue-900">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Team Invitation
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Invitation message */}
          <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">{inviterName}</span> has invited you to join the team for:
            </p>
          </div>

          {/* Incident details */}
          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                  {displayTitle}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {incident.incidentNumber}
                </p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(incident.status)}`}>
                {incident.status.replace('_', ' ')}
              </span>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Owner: {ownerName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{formatDateTime(invitation.invitedAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{incident._count.participants} team member(s)</span>
              </div>
            </div>
          </div>

          {/* Current team members */}
          {teamMembers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Team Members
              </h4>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
                  >
                    {member.profilePicture ? (
                      <img
                        src={member.profilePicture}
                        alt={`${member.firstName} ${member.lastName}`}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                    )}
                    <span className="text-gray-700 dark:text-gray-300">
                      {member.firstName} {member.lastName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Role info */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <AlertCircle className="w-4 h-4" />
            <span>You will join as: <span className="font-medium capitalize">{invitation.role.toLowerCase()}</span></span>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="order-3 sm:order-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Decide Later
          </button>
          <button
            onClick={() => onDecline(invitation.incidentId)}
            disabled={isLoading}
            className="order-2 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            Decline
          </button>
          <button
            onClick={() => onAccept(invitation.incidentId)}
            disabled={isLoading}
            className="order-1 sm:order-3 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Accept Invitation
          </button>
        </div>
      </div>
    </div>
  );
}

// Export types for use in other components
export type { Invitation, InvitationModalProps };
