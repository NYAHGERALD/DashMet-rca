'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/lib/websocket';
import api from '@/lib/api';
import { Search, X, UserPlus, Check, Users, Crown, Eye, Edit3, AlertTriangle, Archive } from 'lucide-react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: { name: string };
  isOnline?: boolean;
  profilePicture?: string | null;
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

interface TeamParticipantSelectorProps {
  incidentId?: string;
  organizationId: string;
  currentUserId: string;
  selectedParticipants: Participant[];
  onParticipantsChange: (participants: Participant[]) => void;
  isTeamIncident?: boolean;
  disabled?: boolean;
  onVisibilityChange?: (newVisibility: 'PRIVATE' | 'TEAM' | 'PUBLIC') => void;
  visibility?: 'PRIVATE' | 'TEAM' | 'PUBLIC';
}

// Confirmation dialog for removing a team member
interface RemovalConfirmDialogProps {
  isOpen: boolean;
  participantName: string;
  isLastMember: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

// Confirmation dialog for adding a member to non-TEAM incident
interface AddMemberConfirmDialogProps {
  isOpen: boolean;
  userName: string;
  currentVisibility: 'PRIVATE' | 'PUBLIC';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function AddMemberConfirmDialog({
  isOpen,
  userName,
  currentVisibility,
  onConfirm,
  onCancel,
  isLoading,
}: AddMemberConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-800">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
              Convert to Team Incident
            </h3>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Adding <strong>{userName}</strong> will convert this incident to a <strong>Team Incident</strong>.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
            <p className="text-blue-800 dark:text-blue-200 font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              What will change:
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Visibility will change from <strong>{currentVisibility}</strong> to <strong>TEAM</strong></li>
              <li>• The new member will have access to incident details</li>
              <li>• The new member will be able to participate in the chat</li>
              <li>• The new member can collaborate on the RCA</li>
            </ul>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Do you want to proceed?
          </p>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Adding...' : 'Convert & Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemovalConfirmDialog({
  isOpen,
  participantName,
  isLastMember,
  onConfirm,
  onCancel,
  isLoading,
}: RemovalConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className={`px-6 py-4 ${isLastMember ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isLastMember ? 'bg-amber-100 dark:bg-amber-800' : 'bg-red-100 dark:bg-red-800'}`}>
              {isLastMember ? (
                <Archive className={`w-6 h-6 ${isLastMember ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`} />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
            <h3 className={`text-lg font-semibold ${isLastMember ? 'text-amber-800 dark:text-amber-200' : 'text-red-800 dark:text-red-200'}`}>
              {isLastMember ? 'Remove Last Team Member' : 'Remove Team Member'}
            </h3>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Removing <strong>{participantName}</strong> will immediately revoke their access to:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
            <li>The incident details</li>
            <li>The RCA analysis</li>
            <li>The chat and all related activities</li>
          </ul>
          
          {isLastMember && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
              <p className="text-amber-800 dark:text-amber-200 font-medium mb-2 flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Additional Changes
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• The incident will become <strong>Private</strong></li>
                <li>• The current chat history will be <strong>archived</strong></li>
                <li>• If converted back to Team mode later, chat will start empty</li>
                <li>• Archived messages remain accessible via the Archive tab</li>
              </ul>
            </div>
          )}
          
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            This action cannot be undone.
          </p>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
              isLastMember 
                ? 'bg-amber-600 hover:bg-amber-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isLoading ? 'Removing...' : 'Remove Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

const roleIcons = {
  OWNER: Crown,
  LEAD: Edit3,
  MEMBER: Users,
  OBSERVER: Eye,
};

const roleLabels = {
  OWNER: 'Owner',
  LEAD: 'Lead',
  MEMBER: 'Member',
  OBSERVER: 'Observer',
};

const roleColors = {
  OWNER: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LEAD: 'bg-purple-100 text-purple-800 border-purple-200',
  MEMBER: 'bg-blue-100 text-blue-800 border-blue-200',
  OBSERVER: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function TeamParticipantSelector({
  incidentId,
  organizationId,
  currentUserId,
  selectedParticipants,
  onParticipantsChange,
  isTeamIncident = false,
  disabled = false,
  onVisibilityChange,
  visibility,
}: TeamParticipantSelectorProps) {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'LEAD' | 'MEMBER' | 'OBSERVER'>('MEMBER');
  
  // Removal confirmation state
  const [removalDialog, setRemovalDialog] = useState<{
    isOpen: boolean;
    participantId: string;
    userId: string;
    participantName: string;
    isLastMember: boolean;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Add member confirmation state (for non-TEAM incidents)
  const [addMemberDialog, setAddMemberDialog] = useState<{
    isOpen: boolean;
    user: User;
    userName: string;
  } | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  
  const { onlineUsers, onUserOnline, onUserOffline } = useWebSocket();

  // Determine if current user is the owner of this incident
  const isCurrentUserOwner = selectedParticipants.some(
    p => p.userId === currentUserId && p.role === 'OWNER'
  );

  // Fetch available users
  const fetchAvailableUsers = useCallback(async () => {
    console.log('[TeamSelector] fetchAvailableUsers called, organizationId:', organizationId);
    if (!organizationId) {
      console.log('[TeamSelector] No organizationId, returning early');
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(searchQuery && { search: searchQuery }),
        ...(incidentId && { incidentId: incidentId }),
      });
      
      const response = await api.get(`/participants/users/available?${params}`);
      
      const users = response.data.data || response.data || [];
      console.log('[TeamSelector] API returned users:', users);
      console.log('[TeamSelector] currentUserId:', currentUserId);
      console.log('[TeamSelector] selectedParticipants:', selectedParticipants);
      // Filter out already selected users and current user
      const selectedIds = new Set(selectedParticipants.map(p => p.userId));
      const filtered = users.filter((u: User & { isParticipant?: boolean }) => !selectedIds.has(u.id) && u.id !== currentUserId && !u.isParticipant);
      console.log('[TeamSelector] filtered users:', filtered);
      setAvailableUsers(filtered);
    } catch (error: any) {
      console.error('[TeamSelector] API error:', error.response?.status, error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, [organizationId, searchQuery, incidentId, selectedParticipants, currentUserId]);

  useEffect(() => {
    if (isDropdownOpen) {
      fetchAvailableUsers();
    }
  }, [isDropdownOpen, searchQuery, fetchAvailableUsers]);

  // Update online status via WebSocket
  useEffect(() => {
    const unsubOnline = onUserOnline(() => {});
    const unsubOffline = onUserOffline(() => {});
    return () => {
      unsubOnline();
      unsubOffline();
    };
  }, [onUserOnline, onUserOffline]);

  const isUserOnline = (userId: string) => onlineUsers.has(userId);

  // Check if we need to show confirmation before adding member
  const handleAddParticipantClick = (user: User) => {
    // If visibility is PRIVATE or PUBLIC, show confirmation dialog
    if (visibility && visibility !== 'TEAM' && incidentId) {
      setAddMemberDialog({
        isOpen: true,
        user,
        userName: `${user.firstName} ${user.lastName}`,
      });
    } else {
      // Directly add the participant
      addParticipant(user);
    }
  };

  // Confirm adding member and convert to TEAM
  const confirmAddMember = async () => {
    if (!addMemberDialog) return;
    
    setIsAddingMember(true);
    try {
      // First, change visibility to TEAM
      if (incidentId && visibility && visibility !== 'TEAM') {
        await api.patch(`/incidents/${incidentId}/visibility`, {
          visibility: 'TEAM',
        });
        
        // Notify parent about visibility change
        if (onVisibilityChange) {
          onVisibilityChange('TEAM');
        }
      }
      
      // Then add the participant
      await addParticipant(addMemberDialog.user);
      setAddMemberDialog(null);
    } catch (error) {
      console.error('Failed to convert to team and add member:', error);
    } finally {
      setIsAddingMember(false);
    }
  };

  const cancelAddMember = () => {
    setAddMemberDialog(null);
  };

  const addParticipant = async (user: User) => {
    // Create a new participant object
    const newParticipant: Participant = {
      id: `temp-${user.id}`,
      userId: user.id,
      role: selectedRole,
      canEdit: selectedRole !== 'OBSERVER',
      canChat: true,
      isActive: true,
      user: {
        ...user,
        isOnline: isUserOnline(user.id),
      },
    };

    // If incident already exists, make API call
    if (incidentId) {
      try {
        const response = await api.post(`/participants/${incidentId}`, {
          userIds: [user.id],  // Backend expects an array of userIds
          role: selectedRole,
        });
        
        // API returns { data: { IncidentParticipant: [...] } } - get the first participant
        // Backend returns User_IncidentParticipant_userIdToUser, need to map to 'user'
        const apiParticipants = response.data?.data?.IncidentParticipant || response.data?.data?.participants || [];
        if (apiParticipants.length > 0) {
          // Map backend response to frontend Participant interface
          const mappedParticipant = {
            ...apiParticipants[0],
            user: apiParticipants[0].User_IncidentParticipant_userIdToUser || apiParticipants[0].user,
          };
          onParticipantsChange([...selectedParticipants, mappedParticipant]);
        } else {
          // Fallback: use local participant object if API didn't return proper data
          onParticipantsChange([...selectedParticipants, newParticipant]);
        }
      } catch (error) {
        console.error('Failed to add participant:', error);
      }
    } else {
      // For new incidents, just update local state
      onParticipantsChange([...selectedParticipants, newParticipant]);
    }

    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  // Initiate participant removal - show confirmation dialog
  const initiateRemoveParticipant = (participant: Participant) => {
    // Count non-owner participants (excluding the one being removed)
    const nonOwnerParticipants = selectedParticipants.filter(
      p => p.role !== 'OWNER' && p.id !== participant.id
    );
    const isLastMember = nonOwnerParticipants.length === 0;

    setRemovalDialog({
      isOpen: true,
      participantId: participant.id,
      userId: participant.userId,
      participantName: `${participant.user?.firstName || 'Unknown'} ${participant.user?.lastName || ''}`,
      isLastMember,
    });
  };

  // Actually remove the participant after confirmation
  const confirmRemoveParticipant = async () => {
    if (!removalDialog) return;

    const { participantId, userId, isLastMember } = removalDialog;

    setIsRemoving(true);
    try {
      if (incidentId) {
        const response = await api.delete(`/participants/${incidentId}/${userId}`, {
          data: { confirmLastMember: isLastMember },
        });

        // Check if this was the last member and visibility changed
        if (response.data?.data?.visibilityChanged && onVisibilityChange) {
          onVisibilityChange(response.data.data.newVisibility);
        }
      }
      
      onParticipantsChange(selectedParticipants.filter(p => p.id !== participantId));
      setRemovalDialog(null);
    } catch (error: any) {
      // Check if this is a "last member" confirmation required error
      if (error.response?.data?.error === 'LAST_MEMBER_REMOVAL') {
        // Update the dialog to show it's the last member
        setRemovalDialog(prev => prev ? { ...prev, isLastMember: true } : null);
      } else {
        console.error('Failed to remove participant:', error);
        setRemovalDialog(null);
      }
    } finally {
      setIsRemoving(false);
    }
  };

  const cancelRemoveParticipant = () => {
    setRemovalDialog(null);
  };

  const updateParticipantRole = async (participantId: string, userId: string, newRole: 'LEAD' | 'MEMBER' | 'OBSERVER') => {
    if (incidentId) {
      try {
        await api.patch(`/participants/${incidentId}/${userId}`, {
          role: newRole,
          canEdit: newRole !== 'OBSERVER',
        });
      } catch (error) {
        console.error('Failed to update participant role:', error);
      }
    }
    
    onParticipantsChange(
      selectedParticipants.map(p =>
        p.id === participantId
          ? { ...p, role: newRole, canEdit: newRole !== 'OBSERVER' }
          : p
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Team Participants
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Selected Participants */}
      <div className="space-y-2">
        {selectedParticipants.filter(p => p.user).map((participant) => {
          const RoleIcon = roleIcons[participant.role];
          const online = isUserOnline(participant.userId);
          
          return (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm"
            >
              <div className="flex items-center space-x-3">
                {/* Avatar with online indicator */}
                <div className="relative">
                  {participant.user?.profilePicture ? (
                    <img
                      src={participant.user.profilePicture}
                      alt={`${participant.user?.firstName || 'Unknown'} ${participant.user?.lastName || ''}`}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                      {participant.user?.firstName?.[0]?.toUpperCase() || 'U'}
                      {participant.user?.lastName?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                      online ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    title={online ? 'Online' : 'Offline'}
                  />
                </div>
                
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {participant.user?.firstName || 'Unknown'} {participant.user?.lastName || ''}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {participant.user?.email || ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Role badge */}
                {participant.role === 'OWNER' ? (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${roleColors[participant.role]}`}>
                    <RoleIcon className="w-3 h-3 inline mr-1" />
                    {roleLabels[participant.role]}
                  </span>
                ) : isCurrentUserOwner ? (
                  <select
                    value={participant.role}
                    onChange={(e) =>
                      updateParticipantRole(
                        participant.id,
                        participant.userId,
                        e.target.value as 'LEAD' | 'MEMBER' | 'OBSERVER'
                      )
                    }
                    disabled={disabled}
                    className={`px-2 py-1 text-xs font-medium rounded-full border ${roleColors[participant.role]} cursor-pointer`}
                  >
                    <option value="LEAD">Lead</option>
                    <option value="MEMBER">Member</option>
                    <option value="OBSERVER">Observer</option>
                  </select>
                ) : (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${roleColors[participant.role]}`}>
                    <RoleIcon className="w-3 h-3 inline mr-1" />
                    {roleLabels[participant.role]}
                  </span>
                )}

                {/* Remove button (only for owner, not for owner role participants) */}
                {participant.role !== 'OWNER' && !disabled && isCurrentUserOwner && (
                  <button
                    onClick={() => initiateRemoveParticipant(participant)}
                    className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                    title="Remove participant"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Removal Confirmation Dialog */}
      {removalDialog && (
        <RemovalConfirmDialog
          isOpen={removalDialog.isOpen}
          participantName={removalDialog.participantName}
          isLastMember={removalDialog.isLastMember}
          onConfirm={confirmRemoveParticipant}
          onCancel={cancelRemoveParticipant}
          isLoading={isRemoving}
        />
      )}

      {/* Add Participant */}
      {!disabled && (
        <div className="relative">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'LEAD' | 'MEMBER' | 'OBSERVER')}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="LEAD">Lead</option>
              <option value="MEMBER">Member</option>
              <option value="OBSERVER">Observer</option>
            </select>
          </div>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  Loading users...
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No users found' : 'All users have been added'}
                </div>
              ) : (
                <ul>
                  {availableUsers.map((user) => {
                    const online = isUserOnline(user.id);
                    
                    return (
                      <li key={user.id}>
                        <button
                          onClick={() => handleAddParticipantClick(user)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              {user.profilePicture ? (
                                <img
                                  src={user.profilePicture}
                                  alt={`${user.firstName} ${user.lastName}`}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-sm font-medium">
                                  {user.firstName?.[0]?.toUpperCase()}
                                  {user.lastName?.[0]?.toUpperCase()}
                                </div>
                              )}
                              <span
                                className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white dark:border-slate-800 ${
                                  online ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                              />
                            </div>
                            
                            <div className="text-left">
                              <div className="font-medium text-gray-900 dark:text-white text-sm">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.role} {user.department?.name && `• ${user.department.name}`}
                              </div>
                            </div>
                          </div>
                          
                          <UserPlus className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              
              <div className="border-t border-gray-200 dark:border-slate-700 p-2">
                <button
                  onClick={() => setIsDropdownOpen(false)}
                  className="w-full px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {selectedParticipants.length === 0 && (
        <div className="text-center py-6 bg-gray-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700">
          <Users className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No participants added yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Search for users above to add them to this incident
          </p>
        </div>
      )}

      {/* Removal confirmation dialog */}
      <RemovalConfirmDialog
        isOpen={removalDialog?.isOpen || false}
        participantName={removalDialog?.participantName || ''}
        isLastMember={removalDialog?.isLastMember || false}
        onConfirm={confirmRemoveParticipant}
        onCancel={cancelRemoveParticipant}
        isLoading={isRemoving}
      />

      {/* Add member confirmation dialog (for non-TEAM incidents) */}
      {addMemberDialog && visibility && visibility !== 'TEAM' && (
        <AddMemberConfirmDialog
          isOpen={addMemberDialog.isOpen}
          userName={addMemberDialog.userName}
          currentVisibility={visibility as 'PRIVATE' | 'PUBLIC'}
          onConfirm={confirmAddMember}
          onCancel={cancelAddMember}
          isLoading={isAddingMember}
        />
      )}
    </div>
  );
}
