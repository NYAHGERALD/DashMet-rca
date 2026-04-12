'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { auth } from './firebase';

interface ChatMessage {
  id: string;
  incidentId: string;
  userId: string;
  content: string;
  messageType: 'TEXT' | 'SYSTEM' | 'FILE' | 'IMAGE';
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isOnline: boolean;
  };
  replyTo?: {
    id: string;
    content: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };

  // Allow additional fields from newer chat features without constantly widening this type.
  [key: string]: any;
}

interface TypingUser {
  userId: string;
  firstName: string;
  lastName: string;
  isTyping: boolean;
}

interface OnlineUser {
  userId: string;
  firstName?: string;
  lastName?: string;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, TypingUser>;
  currentIncidentId: string | null;
  // Methods
  connect: (userId: string, organizationId: string) => void;
  disconnect: () => void;
  joinIncident: (incidentId: string) => void;
  leaveIncident: (incidentId: string) => void;
  sendMessage: (incidentId: string, content: string, replyToId?: string) => void;
  setTyping: (incidentId: string, isTyping: boolean) => void;
  markMessagesRead: (incidentId: string, messageIds?: string[]) => void;
  // Event handlers
  onMessage: (callback: (message: ChatMessage) => void) => () => void;
  onMessageUpdated: (callback: (message: ChatMessage) => void) => () => void;
  onMessageDeleted: (callback: (data: { id: string; incidentId: string; isDeleted: boolean }) => void) => () => void;
  onChatNotification: (callback: (message: ChatMessage) => void) => () => void;
  onTyping: (callback: (data: TypingUser) => void) => () => void;
  onParticipantJoined: (callback: (data: { incidentId: string; userId: string; firstName: string; lastName: string }) => void) => () => void;
  onParticipantLeft: (callback: (data: { incidentId: string; userId: string }) => void) => () => void;
  onParticipantsUpdated: (callback: (data: { incidentId: string; action: string; participants?: any[]; userId?: string }) => void) => () => void;
  onParticipantRoleUpdated: (callback: (data: { incidentId: string; participantId: string; userId: string; role: string; canEdit: boolean; canChat: boolean; updatedBy: string }) => void) => () => void;
  onUserOnline: (callback: (data: OnlineUser) => void) => () => void;
  onUserOffline: (callback: (data: { userId: string }) => void) => () => void;
  // Invitation event handlers
  onInvitationReceived: (callback: (data: { incidentId: string; incidentNumber: string; customTitle?: string; invitedBy: { id: string; firstName: string; lastName: string; email: string }; role: string; invitedAt: string }) => void) => () => void;
  onInvitationDeclined: (callback: (data: { incidentId: string; incidentNumber: string; declinedBy: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  onVisibilityChanged: (callback: (data: { incidentId: string; incidentNumber?: string; visibility: string; reason?: string; declinedBy?: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  // Reaction event handler
  onReaction: (callback: (data: { messageId: string; incidentId: string; action: 'added' | 'removed'; emoji: string; userId: string; user: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  // Pin/Unpin event handlers
  onMessagePinned: (callback: (data: { messageId: string; message: ChatMessage; pinnedBy: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  onMessageUnpinned: (callback: (data: { messageId: string; message: ChatMessage; unpinnedBy: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  // FMIR collaborator event handler (supports both QA auto-add and manual add)
  onFmirCollaboratorAdded: (callback: (data: any) => void) => () => void;
  // FMIR collaborator removed event handler (for real-time removal notification)
  onFmirCollaboratorRemoved: (callback: (data: { reportId: string; reportNumber: string; removedUserId: string; removedByName: string }) => void) => () => void;
  // FMIR collaborators updated event handler (for real-time list updates when collaborators change)
  onFmirCollaboratorsUpdated: (callback: (data: { reportId: string; reportNumber: string; action: 'added' | 'removed'; collaboratorIds: string[]; collaborators: any[]; updatedByName: string; updatedById: string; removedUserId?: string }) => void) => () => void;
  // FMIR visibility changed event handler
  onFmirVisibilityChanged: (callback: (data: { reportId: string; reportNumber: string; isVisible: boolean; ownerId: string }) => void) => () => void;
  // FMIR visibility off event handler (for immediate modal on collaborators)
  onFmirVisibilityOff: (callback: (data: { reportId: string; reportNumber: string; ownerId: string; ownerName: string }) => void) => () => void;
  // FMIR updated event handler (for real-time collaboration sync)
  onFmirUpdated: (callback: (data: { reportId: string; reportNumber: string; updatedById: string; updatedByName: string; updateType: 'save' | 'submit'; newStatus?: string }) => void) => () => void;
  // FMIR closed status changed event handler (for real-time lock/unlock by QA)
  onFmirClosedStatusChanged: (callback: (data: { reportId: string; reportNumber: string; isClosed: boolean; closedById: string | null; closedAt: string | null }) => void) => () => void;
  // FMIR status changed event handler (for real-time status updates by QA - e.g., SUBMITTED -> UNDER_INVESTIGATION)
  onFmirStatusChanged: (callback: (data: { reportId: string; reportNumber: string; previousStatus: string; newStatus: string; statusDisplay: string; changedBy: string; changedById: string; notes: string | null; timestamp: string }) => void) => () => void;
  // FMIR deleted event handler (for real-time deletion notification)
  onFmirDeleted: (callback: (data: { reportId: string; reportNumber: string; deletedById: string; deletedByName: string }) => void) => () => void;
  // FMIR evidence updated event handler (for real-time evidence sync)
  onFmirEvidenceUpdated: (callback: (data: { reportId: string; reportNumber: string; action: 'upload' | 'delete'; evidence?: any[]; evidenceId?: string; updatedById: string; updatedByName: string }) => void) => () => void;
  // FMIR audit progress event handler (for real-time AI audit validation progress)
  onFmirAuditProgress: (callback: (data: { reportId: string; reportNumber: string; stepId: string; stepLabel: string; stepDescription: string; status: 'pending' | 'active' | 'completed'; stepIndex: number; totalSteps: number; message?: string }) => void) => () => void;
  // FMIR comment added event handler (for real-time comment sync)
  onFmirCommentAdded: (callback: (data: { reportId: string; reportNumber: string; comment: any; addedByName: string }) => void) => () => void;
  // FMIR comment deleted event handler (for real-time comment sync)
  onFmirCommentDeleted: (callback: (data: { reportId: string; reportNumber: string; commentId: string; sectionNumber: number; deletedByName: string }) => void) => () => void;
  // Privilege changed event handler (for real-time privilege updates)
  onPrivilegeChanged: (callback: (data: { organizationId: string; changedBy: string; changedAt: string; affectedRoles?: string[]; affectedUsers?: string[]; changes?: any }) => void) => () => void;
  // Support request notification (for Admin/QC Manager real-time alerts)
  onSupportNewRequest: (callback: (data: { id: string; subject: string; description: string; category: string; recipientRole: string | null; status: string; createdAt: string; submittedByUser: any; submittedByUserEmail: string; hasAttachments: boolean }) => void) => () => void;
  // Support request status changed notification (for users who submitted requests)
  onSupportStatusChanged: (callback: (data: { id: string; subject: string; status: string; previousStatus: string; message: string; resolvedBy: { id: string; firstName: string; lastName: string } | null; updatedAt: string }) => void) => () => void;
  // RCA created event handler (for real-time RCA started notification)
  onRCACreated: (callback: (data: { incidentId: string; rcaId: string; method: string; status: string; createdBy: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  // RCA methodology analysis started (for real-time team sync)
  onRCAMethodologyAnalysisStarted: (callback: (data: { incidentId: string; analyzedBy: { id: string; firstName: string; lastName: string }; startedAt: string }) => void) => () => void;
  // RCA methodology analysis complete (for real-time team sync)
  onRCAMethodologyAnalysisComplete: (callback: (data: { incidentId: string; recommendation: any }) => void) => () => void;
  // RCA modal state changes (for real-time modal sync)
  onRCAModalState: (callback: (data: { incidentId: string; userId: string; userName: string; action: 'opened' | 'closed' | 'method-selected' | 'visibility-changed' | 'analyzing'; selectedMethod?: string; visibility?: string }) => void) => () => void;
  // RCA data updated (for real-time fishbone/5-whys sync)
  onRCADataUpdated: (callback: (data: { rcaId: string; type: 'fishbone' | 'five-whys'; updatedBy: { id: string; firstName: string; lastName: string }; timestamp: string; data: any }) => void) => () => void;
  // RCA method changed (for real-time method sync)
  onRCAMethodChanged: (callback: (data: { rcaId: string; method: string; updatedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA validated (for real-time validation sync)
  onRCAValidated: (callback: (data: { rcaId: string; rootCauseStatement: string; isValidated: boolean; validatedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA reopened (for real-time reopen sync)
  onRCAReopened: (callback: (data: { rcaId: string; reason: string; isValidated: boolean; reopenedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA AI generation started (for real-time AI progress sync)
  onRCAAIGenerationStarted: (callback: (data: { rcaId: string; type: 'fishbone' | 'five-whys'; startedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA AI generation complete (for real-time AI result sync)
  onRCAAIGenerationComplete: (callback: (data: { rcaId: string; type: 'fishbone' | 'five-whys'; generatedBy: { id: string; firstName: string; lastName: string }; autoSaved: boolean; timestamp: string }) => void) => () => void;
  // RCA AI suggestions started (for real-time collaborative review)
  onRCAAISuggestionsStarted: (callback: (data: { rcaId: string; type: string; startedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA AI suggestions received (for real-time collaborative review)
  onRCAAISuggestionsReceived: (callback: (data: { rcaId: string; type: string; analysis: any; generatedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA AI validation started (for real-time problem validation sync)
  onRCAAIValidationStarted: (callback: (data: { rcaId: string; type: string; problem: string; startedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA AI validation complete (for real-time problem validation sync)
  onRCAAIValidationComplete: (callback: (data: { rcaId: string; type: string; validation: any; validatedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA clarification answer update (for real-time collaborative input)
  onRCAClarificationAnswer: (callback: (data: { incidentId: string; rcaId: string; questionIndex: number; answer: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA problem statement update (for real-time collaborative editing)
  onRCAProblemUpdate: (callback: (data: { incidentId: string; rcaId: string; problem: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA categories update (for real-time fishbone diagram sync)
  onRCACategoriesUpdated: (callback: (data: { incidentId: string; rcaId: string; categories: any[]; problem: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA corrective actions update (for real-time action plans sync)
  onRCACorrectiveActionsUpdated: (callback: (data: { incidentId: string; rcaId: string; actionPlans: any; preventiveControls: any[]; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA cause input typing (for real-time typing indicator in "Add a cause" input)
  onRCACauseInputTyping: (callback: (data: { incidentId: string; rcaId: string; categoryId: string; text: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys modal opened (for real-time modal sync across team)
  onRCAFiveWhysModalOpened: (callback: (data: { incidentId: string; rcaId: string; causeId: string; causeText: string; categoryName: string; openedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA 5 Whys modal closed (for real-time modal sync across team)
  onRCAFiveWhysModalClosed: (callback: (data: { incidentId: string; rcaId: string; closedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // RCA 5 Whys mode changed (for real-time mode sync across team)
  onRCAFiveWhysModeChanged: (callback: (data: { incidentId: string; rcaId: string; mode: 'choose' | 'manual' | 'ai'; changedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;
  // Emit RCA modal state change
  emitRCAModalState: (incidentId: string, action: 'opened' | 'closed' | 'method-selected' | 'visibility-changed' | 'analyzing', data?: { selectedMethod?: string; visibility?: string }) => void;
  // Emit RCA clarification answer update
  emitRCAClarificationAnswer: (incidentId: string, rcaId: string, questionIndex: number, answer: string) => void;
  // Emit RCA problem statement update
  emitRCAProblemUpdate: (incidentId: string, rcaId: string, problem: string) => void;
  // Emit RCA categories update
  emitRCACategoriesUpdated: (incidentId: string, rcaId: string, categories: any[], problem: string) => void;
  // Emit RCA corrective actions update
  emitRCACorrectiveActionsUpdated: (incidentId: string, rcaId: string, actionPlans: any, preventiveControls: any[]) => void;
  // Emit RCA cause input typing
  emitRCACauseInputTyping: (incidentId: string, rcaId: string, categoryId: string, text: string) => void;
  // Emit RCA 5 Whys modal opened
  emitRCAFiveWhysModalOpened: (incidentId: string, rcaId: string, causeId: string, causeText: string, categoryName: string, mode: 'choose' | 'continue-or-restart' | 'manual' | 'ai', hasAnswers: boolean, answerCount: number, steps: Array<{ stepNumber: number; question: string; answer: string }>, rootCause?: string) => void;
  // Emit RCA 5 Whys modal closed
  emitRCAFiveWhysModalClosed: (incidentId: string, rcaId: string) => void;
  // Emit RCA 5 Whys mode changed (with optional reset data for Start Fresh scenarios)
  emitRCAFiveWhysModeChanged: (incidentId: string, rcaId: string, mode: 'choose' | 'manual' | 'ai', resetData?: { causeId: string; causeText: string; steps: Array<{ stepNumber: number; question: string; answer: string }>; hasAnswers: boolean; answerCount: number }) => void;
  // RCA 5 Whys field typing (for real-time typing indicator)
  onRCAFiveWhysFieldTyping: (callback: (data: { incidentId: string; rcaId: string; fieldType: 'why' | 'rootCause'; stepNumber?: number; isTyping: boolean; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys field content update (for real-time text sync, includes nextQuestion for dynamic question updates)
  onRCAFiveWhysFieldUpdate: (callback: (data: { incidentId: string; rcaId: string; fieldType: 'why' | 'rootCause'; stepNumber?: number; text: string; nextQuestion?: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys analysis status changed (for real-time color indicator sync)
  onRCAFiveWhysStatusChanged: (callback: (data: { incidentId: string; rcaId: string; causeId: string; hasAnswers: boolean; answerCount: number; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys AI analyzing state (for real-time loading spinner sync)
  onRCAFiveWhysAIAnalyzing: (callback: (data: { incidentId: string; rcaId: string; causeId: string; isAnalyzing: boolean; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys AI result (for real-time AI analysis result sync)
  onRCAFiveWhysAIResult: (callback: (data: { incidentId: string; rcaId: string; causeId: string; result: any; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys AI Edit mode state (for real-time edit mode sync)
  onRCAFiveWhysAIEditMode: (callback: (data: { incidentId: string; rcaId: string; causeId: string; isEditing: boolean; editedSteps: Array<{ stepNumber: number; question: string; answer: string }>; editedRootCause: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys AI Edit field typing (for real-time typing indicator)
  onRCAFiveWhysAIEditTyping: (callback: (data: { incidentId: string; rcaId: string; fieldType: 'why' | 'rootCause'; stepNumber?: number; isTyping: boolean; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys AI Edit field update (for real-time content sync)
  onRCAFiveWhysAIEditUpdate: (callback: (data: { incidentId: string; rcaId: string; fieldType: 'why' | 'rootCause'; stepNumber?: number; text: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // Emit RCA 5 Whys field typing
  emitRCAFiveWhysFieldTyping: (incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', isTyping: boolean, stepNumber?: number) => void;
  // Emit RCA 5 Whys field content update (includes optional nextQuestion for dynamic question updates)
  emitRCAFiveWhysFieldUpdate: (incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', text: string, stepNumber?: number, nextQuestion?: string) => void;
  // Emit RCA 5 Whys analysis status changed (for real-time color indicator sync)
  emitRCAFiveWhysStatusChanged: (incidentId: string, rcaId: string, causeId: string, hasAnswers: boolean, answerCount: number) => void;
  // Emit RCA 5 Whys AI analyzing state (for real-time loading spinner sync)
  emitRCAFiveWhysAIAnalyzing: (incidentId: string, rcaId: string, causeId: string, isAnalyzing: boolean) => void;
  // Emit RCA 5 Whys AI result (for real-time AI analysis result sync)
  emitRCAFiveWhysAIResult: (incidentId: string, rcaId: string, causeId: string, result: any) => void;
  // Emit RCA 5 Whys AI Edit mode state (for real-time edit mode sync)
  emitRCAFiveWhysAIEditMode: (incidentId: string, rcaId: string, causeId: string, isEditing: boolean, editedSteps: Array<{ stepNumber: number; question: string; answer: string }>, editedRootCause: string) => void;
  // Emit RCA 5 Whys AI Edit field typing (for real-time typing indicator)
  emitRCAFiveWhysAIEditTyping: (incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', isTyping: boolean, stepNumber?: number) => void;
  // Emit RCA 5 Whys AI Edit field update (for real-time content sync)
  emitRCAFiveWhysAIEditUpdate: (incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', text: string, stepNumber?: number) => void;
  // RCA 5 Whys Manual validation state (for real-time validation sync)
  onRCAFiveWhysManualValidating: (callback: (data: { incidentId: string; rcaId: string; causeId: string; isValidating: boolean; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys Manual validation result (for real-time validation result sync)
  onRCAFiveWhysManualValidationResult: (callback: (data: { incidentId: string; rcaId: string; causeId: string; result: any; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys Manual correction applied (for real-time fix application sync)
  onRCAFiveWhysManualCorrectionApplied: (callback: (data: { incidentId: string; rcaId: string; causeId: string; stepNumber: number; correctedText: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // Emit RCA 5 Whys Manual validation state
  emitRCAFiveWhysManualValidating: (incidentId: string, rcaId: string, causeId: string, isValidating: boolean) => void;
  // Emit RCA 5 Whys Manual validation result
  emitRCAFiveWhysManualValidationResult: (incidentId: string, rcaId: string, causeId: string, result: any) => void;
  // Emit RCA 5 Whys Manual correction applied
  emitRCAFiveWhysManualCorrectionApplied: (incidentId: string, rcaId: string, causeId: string, stepNumber: number, correctedText: string) => void;
  // RCA 5 Whys AI Edit validation state (for real-time AI edit validation sync)
  onRCAFiveWhysAIEditValidating: (callback: (data: { incidentId: string; rcaId: string; causeId: string; isValidating: boolean; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // RCA 5 Whys AI Edit validation result (for real-time AI edit validation result sync)
  onRCAFiveWhysAIEditValidationResult: (callback: (data: { incidentId: string; rcaId: string; causeId: string; result: any; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // Emit RCA 5 Whys AI Edit validation state
  emitRCAFiveWhysAIEditValidating: (incidentId: string, rcaId: string, causeId: string, isValidating: boolean) => void;
  // Emit RCA 5 Whys AI Edit validation result
  emitRCAFiveWhysAIEditValidationResult: (incidentId: string, rcaId: string, causeId: string, result: any) => void;
  // RCA 5 Whys AI Edit fix applied (for real-time Apply Fix sync)
  onRCAFiveWhysAIEditFixApplied: (callback: (data: { incidentId: string; rcaId: string; causeId: string; stepNumber: number; correctedText: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // Emit RCA 5 Whys AI Edit fix applied
  emitRCAFiveWhysAIEditFixApplied: (incidentId: string, rcaId: string, causeId: string, stepNumber: number, correctedText: string) => void;
  // RCA 5 Whys cause recommendation (keep/eliminate for real-time sync)
  onRCAFiveWhysCauseRecommendation: (callback: (data: { incidentId: string; rcaId: string; causeId: string; categoryName: string; recommendation: 'keep' | 'eliminate'; fiveWhysAnalysis?: any; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // Emit RCA 5 Whys cause recommendation
  emitRCAFiveWhysCauseRecommendation: (incidentId: string, rcaId: string, causeId: string, categoryName: string, recommendation: 'keep' | 'eliminate', fiveWhysAnalysis?: any) => void;

  // ========================================
  // INCIDENT EVIDENCE EVENTS
  // ========================================
  // Incident evidence added (for real-time evidence sync when chat attachment is uploaded)
  onIncidentEvidenceAdded: (callback: (data: { incidentId: string; evidence: { id: string; type: string; fileName: string; filePath: string; mimeType: string; uploadedById: string }; uploadedBy: { id: string; firstName: string; lastName: string }; timestamp: string }) => void) => () => void;

  // ========================================
  // LSW COMPLETION EVENTS
  // ========================================
  onLswCompletionChanged: (callback: (data: { weekNumber: number; year: number }) => void) => () => void;

  // ========================================
  // LSW PROJECT EVENTS
  // ========================================
  onLswProjectChanged: (callback: (data: any) => void) => () => void;

  // ========================================
  // LSW FOLLOW-UP EVENTS
  // ========================================
  onLswFollowUpChanged: (callback: (data: any) => void) => () => void;

  // ========================================
  // LSW TRIGGER EVENTS
  // ========================================
  onLswTriggerChanged: (callback: (data: any) => void) => () => void;

  // ========================================
  // VIDEO CALL EVENTS
  // ========================================
  // Video call started notification
  onVideoCallStarted: (callback: (data: { incidentId: string; roomUrl: string; roomName: string; startedBy: string; startedByName: string; timestamp: string }) => void) => () => void;
  // Video call ended notification
  onVideoCallEnded: (callback: (data: { incidentId: string; roomName: string; endedBy: string; timestamp: string }) => void) => () => void;
  // User joined call notification
  onVideoCallUserJoined: (callback: (data: { incidentId: string; roomName: string; userId: string; userName: string; timestamp: string }) => void) => () => void;
  // User left call notification
  onVideoCallUserLeft: (callback: (data: { incidentId: string; roomName: string; userId: string; timestamp: string }) => void) => () => void;
  // Emit video call started
  emitVideoCallStarted: (incidentId: string, roomUrl: string, roomName: string) => void;
  // Emit video call ended
  emitVideoCallEnded: (incidentId: string, roomName: string) => void;
  // Emit user joined call
  emitVideoCallUserJoined: (incidentId: string, roomName: string) => void;
  // Emit user left call
  emitVideoCallUserLeft: (incidentId: string, roomName: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
  const connectionAttempted = useRef(false);
  
  const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const messageUpdatedCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const messageDeletedCallbacks = useRef<Set<(data: { id: string; incidentId: string; isDeleted: boolean }) => void>>(new Set());
  const chatNotificationCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const typingCallbacks = useRef<Set<(data: TypingUser) => void>>(new Set());
  const participantJoinedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const participantLeftCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const participantsUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const participantRoleUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const userOnlineCallbacks = useRef<Set<(data: OnlineUser) => void>>(new Set());
  const userOfflineCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const invitationReceivedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const invitationDeclinedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const visibilityChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const reactionCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const messagePinnedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const messageUnpinnedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const messagesReadCallbacks = useRef<Set<(data: { userId: string; incidentId: string }) => void>>(new Set());
  const fmirCollaboratorAddedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCollaboratorRemovedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCollaboratorsUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirVisibilityChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirVisibilityOffCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirClosedStatusChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirStatusChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirDeletedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirEvidenceUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirAuditProgressCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCommentAddedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCommentDeletedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const privilegeChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const supportNewRequestCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const supportStatusChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaCreatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaMethodologyAnalysisStartedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaMethodologyAnalysisCompleteCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaModalStateCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaDataUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaMethodChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaValidatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaReopenedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaAIGenerationStartedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaAIGenerationCompleteCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaAISuggestionsStartedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaAISuggestionsReceivedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaAIValidationStartedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaAIValidationCompleteCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaClarificationAnswerCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaProblemUpdateCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaCategoriesUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaCorrectiveActionsUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaCauseInputTypingCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysModalOpenedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysModalClosedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysModeChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysFieldTypingCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysFieldUpdateCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysStatusChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIAnalyzingCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIResultCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIEditModeCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIEditTypingCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIEditUpdateCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysManualValidatingCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysManualValidationResultCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysManualCorrectionAppliedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIEditValidatingCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIEditValidationResultCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysAIEditFixAppliedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const rcaFiveWhysCauseRecommendationCallbacks = useRef<Set<(data: any) => void>>(new Set());
  
  // Video call callbacks
  const videoCallStartedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const videoCallEndedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const videoCallUserJoinedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const videoCallUserLeftCallbacks = useRef<Set<(data: any) => void>>(new Set());
  
  // Incident evidence callbacks
  const incidentEvidenceAddedCallbacks = useRef<Set<(data: any) => void>>(new Set());

  // LSW completion callbacks
  const lswCompletionChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());

  // LSW project callbacks
  const lswProjectChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());

  // LSW follow-up callbacks
  const lswFollowUpChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());

  // LSW trigger callbacks
  const lswTriggerChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());

  const connect = useCallback(async (userId: string, organizationId: string) => {
    // Prevent multiple connection attempts
    if (socket?.connected || connectionAttempted.current) return;
    connectionAttempted.current = true;

    // Use WS_URL if available, otherwise derive from API_URL
    // For production: API_URL might be https://api.dashmet.com/api, we need https://api.dashmet.com for WebSocket
    let backendUrl = process.env.NEXT_PUBLIC_WS_URL;
    
    if (!backendUrl && process.env.NEXT_PUBLIC_API_URL) {
      // Remove /api suffix and keep the protocol (Socket.IO handles ws/wss automatically)
      backendUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    }
    
    backendUrl = backendUrl || 'http://localhost:5002';
    
    console.log('🔌 Connecting WebSocket to:', backendUrl);

    // Get Firebase ID token for WebSocket auth
    const firebaseUser = auth.currentUser;
    const firebaseToken = firebaseUser ? await firebaseUser.getIdToken() : null;
    if (!firebaseToken) {
      console.warn('🔌 No Firebase token available, skipping WebSocket connection');
      return;
    }
    
    const newSocket = io(backendUrl, {
      auth: { token: firebaseToken, userId, organizationId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,  // Reduced from 5
      reconnectionDelay: 2000,  // Increased delay
      reconnectionDelayMax: 10000,  // Max delay between reconnection attempts
      timeout: 10000,  // Connection timeout
    });

    newSocket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });

    // Stop reconnection attempts after max retries
    newSocket.io.on('reconnect_failed', () => {
      console.warn('🔌 WebSocket reconnection failed - giving up');
      connectionAttempted.current = false;  // Allow manual reconnection later
    });

    // Handle chat messages
    newSocket.on('chat:message', (message: ChatMessage) => {
      messageCallbacks.current.forEach(cb => cb(message));
    });

    // Handle chat notifications (sent directly to user, not via room)
    newSocket.on('chat:notification', (message: ChatMessage) => {
      console.log('🔔 Chat notification received:', message.id);
      chatNotificationCallbacks.current.forEach(cb => cb(message));
    });

    // Handle chat message updates (e.g., question resolved/reopened)
    newSocket.on('chat:message:updated', (message: ChatMessage) => {
      messageUpdatedCallbacks.current.forEach(cb => cb(message));
    });

    // Handle chat message deletions
    newSocket.on('chat:message:deleted', (data: { id: string; incidentId: string; isDeleted: boolean }) => {
      messageDeletedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle typing indicators
    newSocket.on('chat:typing', (data: TypingUser) => {
      if (data.isTyping) {
        setTypingUsers(prev => new Map(prev).set(data.userId, data));
      } else {
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      }
      typingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle user online/offline
    newSocket.on('user:online', (data: OnlineUser) => {
      setOnlineUsers(prev => new Set(prev).add(data.userId));
      userOnlineCallbacks.current.forEach(cb => cb(data));
    });

    newSocket.on('user:offline', (data: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
      userOfflineCallbacks.current.forEach(cb => cb(data));
    });

    // Handle participant events
    newSocket.on('participant:joined', (data: any) => {
      participantJoinedCallbacks.current.forEach(cb => cb(data));
    });

    newSocket.on('participant:left', (data: any) => {
      participantLeftCallbacks.current.forEach(cb => cb(data));
    });

    // Handle participants updated (add/remove) - listen to both event names for compatibility
    newSocket.on('participants:updated', (data: any) => {
      participantsUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Also listen for the backend's actual event name
    newSocket.on('IncidentParticipant:updated', (data: any) => {
      console.log('👥 IncidentParticipant:updated event:', data);
      participantsUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle participant role updated
    newSocket.on('participant:role-updated', (data: any) => {
      console.log('👥 participant:role-updated event:', data);
      participantRoleUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle invitation received (sent directly to invited user)
    newSocket.on('invitation:received', (data: any) => {
      console.log('🔔 Invitation received event:', data);
      console.log('🔔 Invitation callbacks registered:', invitationReceivedCallbacks.current.size);
      invitationReceivedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle invitation declined (sent directly to owner)
    newSocket.on('invitation:declined', (data: any) => {
      console.log('🔔 Invitation declined event:', data);
      invitationDeclinedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle visibility changed (sent directly to owner or via incident room)
    newSocket.on('incident:visibility-changed', (data: any) => {
      console.log('🔔 Visibility changed event:', data);
      visibilityChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle chat reactions (real-time updates for emoji reactions)
    newSocket.on('chat:reaction', (data: any) => {
      console.log('🎉 Reaction event:', data);
      reactionCallbacks.current.forEach(cb => cb(data));
    });

    // Handle message pinned (real-time pin updates)
    newSocket.on('chat:message-pinned', (data: any) => {
      console.log('📌 Message pinned event:', data);
      messagePinnedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle message unpinned (real-time unpin updates)
    newSocket.on('chat:message-unpinned', (data: any) => {
      console.log('📌 Message unpinned event:', data);
      messageUnpinnedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle messages read (real-time read status updates)
    newSocket.on('chat:read', (data: { userId: string; incidentId: string }) => {
      console.log('✓ Messages read event:', data);
      messagesReadCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR collaborator added (when QA/Food Safety user is added to open FMIRs)
    newSocket.on('fmir:collaborator-added', (data: any) => {
      console.log('👥 FMIR collaborator added event:', data);
      fmirCollaboratorAddedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR collaborator removed (when owner removes a collaborator)
    newSocket.on('fmir:collaborator-removed', (data: any) => {
      console.log('👤 FMIR collaborator removed event:', data);
      fmirCollaboratorRemovedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR collaborators updated (broadcast to all viewers when collaborator list changes)
    newSocket.on('fmir:collaborators-updated', (data: any) => {
      console.log('👥 FMIR collaborators updated event:', data);
      fmirCollaboratorsUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR visibility changed (when owner toggles visibility)
    newSocket.on('fmir:visibility-changed', (data: any) => {
      console.log('👁️ FMIR visibility changed event:', data);
      fmirVisibilityChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR visibility OFF (sent directly to collaborators for immediate modal)
    newSocket.on('fmir:visibility-off', (data: any) => {
      console.log('🚫 FMIR visibility OFF event:', data);
      fmirVisibilityOffCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR updated (real-time collaboration sync)
    newSocket.on('fmir:updated', (data: any) => {
      console.log('📝 FMIR updated event:', data);
      fmirUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR closed status changed (real-time lock/unlock by QA)
    newSocket.on('fmir:closed-status-changed', (data: any) => {
      console.log('🔒 FMIR closed status changed event:', data);
      fmirClosedStatusChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR status changed (real-time status updates by QA - e.g., investigation toggle)
    newSocket.on('fmir:status-changed', (data: any) => {
      console.log('📊 FMIR status changed event:', data);
      fmirStatusChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR deleted (real-time deletion notification)
    newSocket.on('fmir:deleted', (data: any) => {
      console.log('🗑️ FMIR deleted event:', data);
      fmirDeletedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR evidence updated (real-time evidence sync)
    newSocket.on('fmir:evidence-updated', (data: any) => {
      console.log('📎 FMIR evidence updated event:', data);
      fmirEvidenceUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR audit progress (real-time AI audit validation progress)
    newSocket.on('fmir:audit-progress', (data: any) => {
      console.log('🔍 FMIR audit progress event:', data);
      fmirAuditProgressCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR comment added (real-time comment sync)
    newSocket.on('fmir:comment-added', (data: any) => {
      console.log('💬 FMIR comment added event:', data);
      fmirCommentAddedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR comment deleted (real-time comment sync)
    newSocket.on('fmir:comment-deleted', (data: any) => {
      console.log('🗑️ FMIR comment deleted event:', data);
      fmirCommentDeletedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle privilege changed (real-time privilege updates)
    newSocket.on('privilege:changed', (data: any) => {
      console.log('🔐 Privilege changed event received from server:', data);
      console.log('🔐 Number of registered callbacks:', privilegeChangedCallbacks.current.size);
      privilegeChangedCallbacks.current.forEach(cb => {
        console.log('🔐 Executing callback');
        cb(data);
      });
    });

    // Handle new support request (real-time notification for Admin/QC Manager)
    newSocket.on('support:new-request', (data: any) => {
      console.log('📬 New support request event:', data);
      supportNewRequestCallbacks.current.forEach(cb => cb(data));
    });

    // Handle support request status changed (real-time notification for user who submitted)
    newSocket.on('support:status-changed', (data: any) => {
      console.log('📬 Support request status changed event:', data);
      supportStatusChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA created (real-time notification for team members)
    newSocket.on('rca:created', (data: any) => {
      console.log('🔬 RCA created event:', data);
      rcaCreatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA methodology analysis started (real-time sync for team members)
    newSocket.on('rca:methodology-analysis-started', (data: any) => {
      console.log('🔬 RCA methodology analysis started:', data);
      rcaMethodologyAnalysisStartedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA methodology analysis complete (real-time sync for team members)
    newSocket.on('rca:methodology-analysis-complete', (data: any) => {
      console.log('🔬 RCA methodology analysis complete:', data);
      rcaMethodologyAnalysisCompleteCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA modal state changes (real-time sync for team collaboration)
    newSocket.on('rca:modal-state', (data: any) => {
      console.log('🔬 RCA modal state event:', data);
      rcaModalStateCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA data updated (real-time fishbone/5-whys sync)
    newSocket.on('rca:data-updated', (data: any) => {
      console.log('🔬 RCA data updated event:', data);
      rcaDataUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA method changed (real-time method sync)
    newSocket.on('rca:method-changed', (data: any) => {
      console.log('🔬 RCA method changed event:', data);
      rcaMethodChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA validated (real-time validation sync)
    newSocket.on('rca:validated', (data: any) => {
      console.log('🔬 RCA validated event:', data);
      rcaValidatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA reopened (real-time reopen sync)
    newSocket.on('rca:reopened', (data: any) => {
      console.log('🔬 RCA reopened event:', data);
      rcaReopenedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA AI generation started (real-time AI progress sync)
    newSocket.on('rca:ai-generation-started', (data: any) => {
      console.log('🔬 RCA AI generation started event:', data);
      rcaAIGenerationStartedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA AI generation complete (real-time AI result sync)
    newSocket.on('rca:ai-generation-complete', (data: any) => {
      console.log('🔬 RCA AI generation complete event:', data);
      rcaAIGenerationCompleteCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA AI suggestions started (for collaborative review)
    newSocket.on('rca:ai-suggestions-started', (data: any) => {
      console.log('🔬 RCA AI suggestions started event:', data);
      rcaAISuggestionsStartedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA AI suggestions received (for collaborative review)
    newSocket.on('rca:ai-suggestions-received', (data: any) => {
      console.log('🔬 RCA AI suggestions received event:', data);
      rcaAISuggestionsReceivedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA AI validation started (problem statement validation)
    newSocket.on('rca:ai-validation-started', (data: any) => {
      console.log('🔬 RCA AI validation started event:', data);
      rcaAIValidationStartedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA AI validation complete (problem statement validation)
    newSocket.on('rca:ai-validation-complete', (data: any) => {
      console.log('🔬 RCA AI validation complete event:', data);
      rcaAIValidationCompleteCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA clarification answer updates (real-time collaborative input)
    newSocket.on('rca:clarification-answer', (data: any) => {
      console.log('📝 RCA clarification answer event:', data);
      rcaClarificationAnswerCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA problem statement updates (real-time collaborative editing)
    newSocket.on('rca:problem-update', (data: any) => {
      console.log('📝 RCA problem update event:', data);
      rcaProblemUpdateCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA categories updates (real-time fishbone diagram sync)
    newSocket.on('rca:categories-updated', (data: any) => {
      console.log('📊 RCA categories updated event:', data);
      rcaCategoriesUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA corrective actions updates (real-time action plans sync)
    newSocket.on('rca:corrective-actions-updated', (data: any) => {
      console.log('🛠️ RCA corrective actions updated event:', data);
      rcaCorrectiveActionsUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA cause input typing (real-time "Add a cause" input sync)
    newSocket.on('rca:cause-input-typing', (data: any) => {
      rcaCauseInputTypingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys modal opened (real-time modal sync)
    newSocket.on('rca:five-whys-modal-opened', (data: any) => {
      console.log('🔍 RCA 5 Whys modal opened event:', data);
      rcaFiveWhysModalOpenedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys modal closed (real-time modal sync)
    newSocket.on('rca:five-whys-modal-closed', (data: any) => {
      console.log('🔍 RCA 5 Whys modal closed event:', data);
      rcaFiveWhysModalClosedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys mode changed (real-time mode sync)
    newSocket.on('rca:five-whys-mode-changed', (data: any) => {
      console.log('🔍 RCA 5 Whys mode changed event:', data);
      rcaFiveWhysModeChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys field typing (real-time typing indicator)
    newSocket.on('rca:five-whys-field-typing', (data: any) => {
      console.log('🔍 RCA 5 Whys field typing event:', data);
      rcaFiveWhysFieldTypingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys field content update (real-time text sync)
    newSocket.on('rca:five-whys-field-update', (data: any) => {
      console.log('🔍 RCA 5 Whys field update event:', data);
      rcaFiveWhysFieldUpdateCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys status changed (real-time color sync)
    newSocket.on('rca:five-whys-status-changed', (data: any) => {
      console.log('🔍 RCA 5 Whys status changed event:', data);
      rcaFiveWhysStatusChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI analyzing state (real-time loading spinner sync)
    newSocket.on('rca:five-whys-ai-analyzing', (data: any) => {
      console.log('🔍 RCA 5 Whys AI analyzing event:', data);
      rcaFiveWhysAIAnalyzingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI result (real-time AI analysis result sync)
    newSocket.on('rca:five-whys-ai-result', (data: any) => {
      console.log('🔍 RCA 5 Whys AI result event:', data);
      rcaFiveWhysAIResultCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI Edit mode (real-time edit mode sync)
    newSocket.on('rca:five-whys-ai-edit-mode', (data: any) => {
      console.log('🔍 RCA 5 Whys AI edit mode event:', data);
      rcaFiveWhysAIEditModeCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI Edit typing (real-time typing indicator)
    newSocket.on('rca:five-whys-ai-edit-typing', (data: any) => {
      console.log('🔍 RCA 5 Whys AI edit typing event:', data);
      rcaFiveWhysAIEditTypingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI Edit update (real-time content sync)
    newSocket.on('rca:five-whys-ai-edit-update', (data: any) => {
      console.log('🔍 RCA 5 Whys AI edit update event:', data);
      rcaFiveWhysAIEditUpdateCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys Manual validation state (real-time validation sync)
    newSocket.on('rca:five-whys-manual-validating', (data: any) => {
      console.log('🔍 RCA 5 Whys Manual validating event:', data);
      rcaFiveWhysManualValidatingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys Manual validation result (real-time result sync)
    newSocket.on('rca:five-whys-manual-validation-result', (data: any) => {
      console.log('🔍 RCA 5 Whys Manual validation result event:', data);
      rcaFiveWhysManualValidationResultCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys Manual correction applied (real-time fix sync)
    newSocket.on('rca:five-whys-manual-correction-applied', (data: any) => {
      console.log('🔍 RCA 5 Whys Manual correction applied event:', data);
      rcaFiveWhysManualCorrectionAppliedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI Edit validation state (real-time AI edit validation sync)
    newSocket.on('rca:five-whys-ai-edit-validating', (data: any) => {
      console.log('🔍 RCA 5 Whys AI Edit validating event:', data);
      rcaFiveWhysAIEditValidatingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI Edit validation result (real-time AI edit validation result sync)
    newSocket.on('rca:five-whys-ai-edit-validation-result', (data: any) => {
      console.log('🔍 RCA 5 Whys AI Edit validation result event:', data);
      rcaFiveWhysAIEditValidationResultCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys AI Edit fix applied (real-time Apply Fix sync)
    newSocket.on('rca:five-whys-ai-edit-fix-applied', (data: any) => {
      console.log('🔍 RCA 5 Whys AI Edit fix applied event:', data);
      rcaFiveWhysAIEditFixAppliedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle RCA 5 Whys cause recommendation (real-time keep/eliminate sync)
    newSocket.on('rca:five-whys-cause-recommendation', (data: any) => {
      console.log('🔍 RCA 5 Whys cause recommendation event:', data);
      rcaFiveWhysCauseRecommendationCallbacks.current.forEach(cb => cb(data));
    });

    // ========================================
    // VIDEO CALL EVENT HANDLERS
    // ========================================
    
    // Handle video call started
    newSocket.on('video-call:started', (data: any) => {
      console.log('📹 Video call started event:', data);
      videoCallStartedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle video call ended
    newSocket.on('video-call:ended', (data: any) => {
      console.log('📹 Video call ended event:', data);
      videoCallEndedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle user joined call
    newSocket.on('video-call:user-joined', (data: any) => {
      console.log('📹 User joined video call event:', data);
      videoCallUserJoinedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle user left call
    newSocket.on('video-call:user-left', (data: any) => {
      console.log('📹 User left video call event:', data);
      videoCallUserLeftCallbacks.current.forEach(cb => cb(data));
    });

    // ========================================
    // INCIDENT EVIDENCE EVENT HANDLERS
    // ========================================
    
    // Handle incident evidence added (when chat attachment is uploaded)
    newSocket.on('incident:evidence:added', (data: any) => {
      console.log('📎 Incident evidence added event:', data);
      incidentEvidenceAddedCallbacks.current.forEach(cb => cb(data));
    });

    // ========================================
    // LSW COMPLETION EVENT HANDLERS
    // ========================================
    newSocket.on('lsw:completion-changed', (data: any) => {
      lswCompletionChangedCallbacks.current.forEach(cb => cb(data));
    });

    newSocket.on('lsw:project-changed', (data: any) => {
      lswProjectChangedCallbacks.current.forEach(cb => cb(data));
    });

    newSocket.on('lsw:follow-up-changed', (data: any) => {
      lswFollowUpChangedCallbacks.current.forEach(cb => cb(data));
    });

    newSocket.on('lsw:trigger-changed', (data: any) => {
      lswTriggerChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle incident participants list
    newSocket.on('incident:participants', (data: { incidentId: string; participants: any[] }) => {
      const onlineIds = data.participants.filter(p => p.isOnline).map(p => p.id);
      setOnlineUsers(prev => {
        const next = new Set(prev);
        onlineIds.forEach(id => next.add(id));
        return next;
      });
    });

    // Handle errors
    newSocket.on('error', (data: { message: string }) => {
      console.error('WebSocket error:', data.message);
    });

    setSocket(newSocket);
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      connectionAttempted.current = false;  // Reset so we can reconnect later
    }
  }, [socket]);

  const joinIncident = useCallback((incidentId: string) => {
    console.log('🚪 [WS] joinIncident called, incidentId:', incidentId, 'connected:', socket?.connected);
    if (socket?.connected) {
      socket.emit('incident:join', incidentId);
      setCurrentIncidentId(incidentId);
      console.log('🚪 [WS] Emitted incident:join for:', incidentId);
    }
  }, [socket]);

  const leaveIncident = useCallback((incidentId: string) => {
    if (socket?.connected) {
      socket.emit('incident:leave', incidentId);
      if (currentIncidentId === incidentId) {
        setCurrentIncidentId(null);
      }
    }
  }, [socket, currentIncidentId]);

  const sendMessage = useCallback((incidentId: string, content: string, replyToId?: string) => {
    if (socket?.connected) {
      socket.emit('chat:message', { incidentId, content, replyToId });
    }
  }, [socket]);

  const setTyping = useCallback((incidentId: string, isTyping: boolean) => {
    if (socket?.connected) {
      socket.emit('chat:typing', { incidentId, isTyping });
    }
  }, [socket]);

  const markMessagesRead = useCallback((incidentId: string, messageIds?: string[]) => {
    if (socket?.connected) {
      socket.emit('chat:read', { incidentId, messageIds });
    }
  }, [socket]);

  // Event subscription helpers
  const onMessage = useCallback((callback: (message: ChatMessage) => void) => {
    messageCallbacks.current.add(callback);
    return () => { messageCallbacks.current.delete(callback); };
  }, []);

  const onMessageUpdated = useCallback((callback: (message: ChatMessage) => void) => {
    messageUpdatedCallbacks.current.add(callback);
    return () => { messageUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onMessageDeleted = useCallback((callback: (data: { id: string; incidentId: string; isDeleted: boolean }) => void) => {
    messageDeletedCallbacks.current.add(callback);
    return () => { messageDeletedCallbacks.current.delete(callback); };
  }, []);

  const onChatNotification = useCallback((callback: (message: ChatMessage) => void) => {
    chatNotificationCallbacks.current.add(callback);
    return () => { chatNotificationCallbacks.current.delete(callback); };
  }, []);

  const onTyping = useCallback((callback: (data: TypingUser) => void) => {
    typingCallbacks.current.add(callback);
    return () => { typingCallbacks.current.delete(callback); };
  }, []);

  const onParticipantJoined = useCallback((callback: (data: any) => void) => {
    participantJoinedCallbacks.current.add(callback);
    return () => { participantJoinedCallbacks.current.delete(callback); };
  }, []);

  const onParticipantLeft = useCallback((callback: (data: any) => void) => {
    participantLeftCallbacks.current.add(callback);
    return () => { participantLeftCallbacks.current.delete(callback); };
  }, []);

  const onParticipantsUpdated = useCallback((callback: (data: any) => void) => {
    participantsUpdatedCallbacks.current.add(callback);
    return () => { participantsUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onParticipantRoleUpdated = useCallback((callback: (data: any) => void) => {
    participantRoleUpdatedCallbacks.current.add(callback);
    return () => { participantRoleUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onUserOnline = useCallback((callback: (data: OnlineUser) => void) => {
    userOnlineCallbacks.current.add(callback);
    return () => { userOnlineCallbacks.current.delete(callback); };
  }, []);

  const onUserOffline = useCallback((callback: (data: any) => void) => {
    userOfflineCallbacks.current.add(callback);
    return () => { userOfflineCallbacks.current.delete(callback); };
  }, []);

  const onInvitationReceived = useCallback((callback: (data: any) => void) => {
    console.log('📝 Registering invitation:received callback, total callbacks:', invitationReceivedCallbacks.current.size + 1);
    invitationReceivedCallbacks.current.add(callback);
    return () => { 
      invitationReceivedCallbacks.current.delete(callback);
      console.log('📝 Unregistered invitation:received callback, remaining callbacks:', invitationReceivedCallbacks.current.size);
    };
  }, []);

  const onInvitationDeclined = useCallback((callback: (data: any) => void) => {
    invitationDeclinedCallbacks.current.add(callback);
    return () => { invitationDeclinedCallbacks.current.delete(callback); };
  }, []);

  const onVisibilityChanged = useCallback((callback: (data: any) => void) => {
    visibilityChangedCallbacks.current.add(callback);
    return () => { visibilityChangedCallbacks.current.delete(callback); };
  }, []);

  const onReaction = useCallback((callback: (data: any) => void) => {
    reactionCallbacks.current.add(callback);
    return () => { reactionCallbacks.current.delete(callback); };
  }, []);

  const onMessagePinned = useCallback((callback: (data: any) => void) => {
    messagePinnedCallbacks.current.add(callback);
    return () => { messagePinnedCallbacks.current.delete(callback); };
  }, []);

  const onMessageUnpinned = useCallback((callback: (data: any) => void) => {
    messageUnpinnedCallbacks.current.add(callback);
    return () => { messageUnpinnedCallbacks.current.delete(callback); };
  }, []);

  const onMessagesRead = useCallback((callback: (data: { userId: string; incidentId: string }) => void) => {
    messagesReadCallbacks.current.add(callback);
    return () => { messagesReadCallbacks.current.delete(callback); };
  }, []);

  const onFmirCollaboratorAdded = useCallback((callback: (data: any) => void) => {
    fmirCollaboratorAddedCallbacks.current.add(callback);
    return () => { fmirCollaboratorAddedCallbacks.current.delete(callback); };
  }, []);

  const onFmirCollaboratorRemoved = useCallback((callback: (data: any) => void) => {
    fmirCollaboratorRemovedCallbacks.current.add(callback);
    return () => { fmirCollaboratorRemovedCallbacks.current.delete(callback); };
  }, []);

  const onFmirCollaboratorsUpdated = useCallback((callback: (data: any) => void) => {
    fmirCollaboratorsUpdatedCallbacks.current.add(callback);
    return () => { fmirCollaboratorsUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onFmirVisibilityChanged = useCallback((callback: (data: any) => void) => {
    fmirVisibilityChangedCallbacks.current.add(callback);
    return () => { fmirVisibilityChangedCallbacks.current.delete(callback); };
  }, []);

  const onFmirVisibilityOff = useCallback((callback: (data: any) => void) => {
    fmirVisibilityOffCallbacks.current.add(callback);
    return () => { fmirVisibilityOffCallbacks.current.delete(callback); };
  }, []);

  const onFmirUpdated = useCallback((callback: (data: any) => void) => {
    fmirUpdatedCallbacks.current.add(callback);
    return () => { fmirUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onFmirClosedStatusChanged = useCallback((callback: (data: any) => void) => {
    fmirClosedStatusChangedCallbacks.current.add(callback);
    return () => { fmirClosedStatusChangedCallbacks.current.delete(callback); };
  }, []);

  const onFmirStatusChanged = useCallback((callback: (data: any) => void) => {
    fmirStatusChangedCallbacks.current.add(callback);
    return () => { fmirStatusChangedCallbacks.current.delete(callback); };
  }, []);

  const onFmirDeleted = useCallback((callback: (data: any) => void) => {
    fmirDeletedCallbacks.current.add(callback);
    return () => { fmirDeletedCallbacks.current.delete(callback); };
  }, []);

  const onFmirEvidenceUpdated = useCallback((callback: (data: any) => void) => {
    fmirEvidenceUpdatedCallbacks.current.add(callback);
    return () => { fmirEvidenceUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onFmirAuditProgress = useCallback((callback: (data: any) => void) => {
    fmirAuditProgressCallbacks.current.add(callback);
    return () => { fmirAuditProgressCallbacks.current.delete(callback); };
  }, []);

  const onFmirCommentAdded = useCallback((callback: (data: any) => void) => {
    fmirCommentAddedCallbacks.current.add(callback);
    return () => { fmirCommentAddedCallbacks.current.delete(callback); };
  }, []);

  const onFmirCommentDeleted = useCallback((callback: (data: any) => void) => {
    fmirCommentDeletedCallbacks.current.add(callback);
    return () => { fmirCommentDeletedCallbacks.current.delete(callback); };
  }, []);

  const onPrivilegeChanged = useCallback((callback: (data: any) => void) => {
    console.log('🔐 WebSocket: Registering privilege change callback, current count:', privilegeChangedCallbacks.current.size);
    privilegeChangedCallbacks.current.add(callback);
    console.log('🔐 WebSocket: After registration, callback count:', privilegeChangedCallbacks.current.size);
    return () => { 
      privilegeChangedCallbacks.current.delete(callback); 
      console.log('🔐 WebSocket: Unregistered privilege callback, remaining:', privilegeChangedCallbacks.current.size);
    };
  }, []);

  const onSupportNewRequest = useCallback((callback: (data: any) => void) => {
    supportNewRequestCallbacks.current.add(callback);
    return () => { supportNewRequestCallbacks.current.delete(callback); };
  }, []);

  const onSupportStatusChanged = useCallback((callback: (data: any) => void) => {
    supportStatusChangedCallbacks.current.add(callback);
    return () => { supportStatusChangedCallbacks.current.delete(callback); };
  }, []);

  const onRCACreated = useCallback((callback: (data: any) => void) => {
    rcaCreatedCallbacks.current.add(callback);
    return () => { rcaCreatedCallbacks.current.delete(callback); };
  }, []);

  const onRCAMethodologyAnalysisStarted = useCallback((callback: (data: any) => void) => {
    rcaMethodologyAnalysisStartedCallbacks.current.add(callback);
    return () => { rcaMethodologyAnalysisStartedCallbacks.current.delete(callback); };
  }, []);

  const onRCAMethodologyAnalysisComplete = useCallback((callback: (data: any) => void) => {
    rcaMethodologyAnalysisCompleteCallbacks.current.add(callback);
    return () => { rcaMethodologyAnalysisCompleteCallbacks.current.delete(callback); };
  }, []);

  const onRCAModalState = useCallback((callback: (data: any) => void) => {
    rcaModalStateCallbacks.current.add(callback);
    return () => { rcaModalStateCallbacks.current.delete(callback); };
  }, []);

  const onRCADataUpdated = useCallback((callback: (data: any) => void) => {
    rcaDataUpdatedCallbacks.current.add(callback);
    return () => { rcaDataUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onRCAMethodChanged = useCallback((callback: (data: any) => void) => {
    rcaMethodChangedCallbacks.current.add(callback);
    return () => { rcaMethodChangedCallbacks.current.delete(callback); };
  }, []);

  const onRCAValidated = useCallback((callback: (data: any) => void) => {
    rcaValidatedCallbacks.current.add(callback);
    return () => { rcaValidatedCallbacks.current.delete(callback); };
  }, []);

  const onRCAReopened = useCallback((callback: (data: any) => void) => {
    rcaReopenedCallbacks.current.add(callback);
    return () => { rcaReopenedCallbacks.current.delete(callback); };
  }, []);

  const onRCAAIGenerationStarted = useCallback((callback: (data: any) => void) => {
    rcaAIGenerationStartedCallbacks.current.add(callback);
    return () => { rcaAIGenerationStartedCallbacks.current.delete(callback); };
  }, []);

  const onRCAAIGenerationComplete = useCallback((callback: (data: any) => void) => {
    rcaAIGenerationCompleteCallbacks.current.add(callback);
    return () => { rcaAIGenerationCompleteCallbacks.current.delete(callback); };
  }, []);

  const onRCAAISuggestionsStarted = useCallback((callback: (data: any) => void) => {
    rcaAISuggestionsStartedCallbacks.current.add(callback);
    return () => { rcaAISuggestionsStartedCallbacks.current.delete(callback); };
  }, []);

  const onRCAAISuggestionsReceived = useCallback((callback: (data: any) => void) => {
    rcaAISuggestionsReceivedCallbacks.current.add(callback);
    return () => { rcaAISuggestionsReceivedCallbacks.current.delete(callback); };
  }, []);

  const onRCAAIValidationStarted = useCallback((callback: (data: any) => void) => {
    rcaAIValidationStartedCallbacks.current.add(callback);
    return () => { rcaAIValidationStartedCallbacks.current.delete(callback); };
  }, []);

  const onRCAAIValidationComplete = useCallback((callback: (data: any) => void) => {
    rcaAIValidationCompleteCallbacks.current.add(callback);
    return () => { rcaAIValidationCompleteCallbacks.current.delete(callback); };
  }, []);

  const onRCAClarificationAnswer = useCallback((callback: (data: any) => void) => {
    rcaClarificationAnswerCallbacks.current.add(callback);
    return () => { rcaClarificationAnswerCallbacks.current.delete(callback); };
  }, []);

  const onRCAProblemUpdate = useCallback((callback: (data: any) => void) => {
    rcaProblemUpdateCallbacks.current.add(callback);
    return () => { rcaProblemUpdateCallbacks.current.delete(callback); };
  }, []);

  const onRCACategoriesUpdated = useCallback((callback: (data: any) => void) => {
    rcaCategoriesUpdatedCallbacks.current.add(callback);
    return () => { rcaCategoriesUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onRCACorrectiveActionsUpdated = useCallback((callback: (data: any) => void) => {
    rcaCorrectiveActionsUpdatedCallbacks.current.add(callback);
    return () => { rcaCorrectiveActionsUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onRCACauseInputTyping = useCallback((callback: (data: any) => void) => {
    rcaCauseInputTypingCallbacks.current.add(callback);
    return () => { rcaCauseInputTypingCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysModalOpened = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysModalOpenedCallbacks.current.add(callback);
    return () => { rcaFiveWhysModalOpenedCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysModalClosed = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysModalClosedCallbacks.current.add(callback);
    return () => { rcaFiveWhysModalClosedCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysModeChanged = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysModeChangedCallbacks.current.add(callback);
    return () => { rcaFiveWhysModeChangedCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysFieldTyping = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysFieldTypingCallbacks.current.add(callback);
    return () => { rcaFiveWhysFieldTypingCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysFieldUpdate = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysFieldUpdateCallbacks.current.add(callback);
    return () => { rcaFiveWhysFieldUpdateCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysStatusChanged = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysStatusChangedCallbacks.current.add(callback);
    return () => { rcaFiveWhysStatusChangedCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIAnalyzing = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIAnalyzingCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIAnalyzingCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIResult = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIResultCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIResultCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIEditMode = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIEditModeCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIEditModeCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIEditTyping = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIEditTypingCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIEditTypingCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIEditUpdate = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIEditUpdateCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIEditUpdateCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysManualValidating = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysManualValidatingCallbacks.current.add(callback);
    return () => { rcaFiveWhysManualValidatingCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysManualValidationResult = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysManualValidationResultCallbacks.current.add(callback);
    return () => { rcaFiveWhysManualValidationResultCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysManualCorrectionApplied = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysManualCorrectionAppliedCallbacks.current.add(callback);
    return () => { rcaFiveWhysManualCorrectionAppliedCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIEditValidating = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIEditValidatingCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIEditValidatingCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIEditValidationResult = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIEditValidationResultCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIEditValidationResultCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysAIEditFixApplied = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysAIEditFixAppliedCallbacks.current.add(callback);
    return () => { rcaFiveWhysAIEditFixAppliedCallbacks.current.delete(callback); };
  }, []);

  const onRCAFiveWhysCauseRecommendation = useCallback((callback: (data: any) => void) => {
    rcaFiveWhysCauseRecommendationCallbacks.current.add(callback);
    return () => { rcaFiveWhysCauseRecommendationCallbacks.current.delete(callback); };
  }, []);

  // ========================================
  // VIDEO CALL CALLBACK HANDLERS
  // ========================================
  
  const onVideoCallStarted = useCallback((callback: (data: any) => void) => {
    videoCallStartedCallbacks.current.add(callback);
    return () => { videoCallStartedCallbacks.current.delete(callback); };
  }, []);

  const onVideoCallEnded = useCallback((callback: (data: any) => void) => {
    videoCallEndedCallbacks.current.add(callback);
    return () => { videoCallEndedCallbacks.current.delete(callback); };
  }, []);

  const onVideoCallUserJoined = useCallback((callback: (data: any) => void) => {
    videoCallUserJoinedCallbacks.current.add(callback);
    return () => { videoCallUserJoinedCallbacks.current.delete(callback); };
  }, []);

  const onVideoCallUserLeft = useCallback((callback: (data: any) => void) => {
    videoCallUserLeftCallbacks.current.add(callback);
    return () => { videoCallUserLeftCallbacks.current.delete(callback); };
  }, []);

  // ========================================
  // INCIDENT EVIDENCE CALLBACK HANDLERS
  // ========================================
  
  const onIncidentEvidenceAdded = useCallback((callback: (data: any) => void) => {
    incidentEvidenceAddedCallbacks.current.add(callback);
    return () => { incidentEvidenceAddedCallbacks.current.delete(callback); };
  }, []);

  // ========================================
  // LSW COMPLETION CALLBACK HANDLERS
  // ========================================
  const onLswCompletionChanged = useCallback((callback: (data: any) => void) => {
    lswCompletionChangedCallbacks.current.add(callback);
    return () => { lswCompletionChangedCallbacks.current.delete(callback); };
  }, []);

  const onLswProjectChanged = useCallback((callback: (data: any) => void) => {
    lswProjectChangedCallbacks.current.add(callback);
    return () => { lswProjectChangedCallbacks.current.delete(callback); };
  }, []);

  const onLswFollowUpChanged = useCallback((callback: (data: any) => void) => {
    lswFollowUpChangedCallbacks.current.add(callback);
    return () => { lswFollowUpChangedCallbacks.current.delete(callback); };
  }, []);

  const onLswTriggerChanged = useCallback((callback: (data: any) => void) => {
    lswTriggerChangedCallbacks.current.add(callback);
    return () => { lswTriggerChangedCallbacks.current.delete(callback); };
  }, []);

  const emitRCAModalState = useCallback((incidentId: string, action: 'opened' | 'closed' | 'method-selected' | 'visibility-changed' | 'analyzing', data?: { selectedMethod?: string; visibility?: string }) => {
    if (socket?.connected) {
      socket.emit('rca:modal-state', { incidentId, action, ...data });
    }
  }, [socket]);

  const emitRCAClarificationAnswer = useCallback((incidentId: string, rcaId: string, questionIndex: number, answer: string) => {
    console.log('📝 [WS] emitRCAClarificationAnswer - connected:', socket?.connected, 'incidentId:', incidentId, 'rcaId:', rcaId, 'questionIndex:', questionIndex);
    if (socket?.connected) {
      socket.emit('rca:clarification-answer', { incidentId, rcaId, questionIndex, answer });
      console.log('📝 [WS] Emitted rca:clarification-answer');
    } else {
      console.log('📝 [WS] Socket not connected, cannot emit');
    }
  }, [socket]);

  const emitRCAProblemUpdate = useCallback((incidentId: string, rcaId: string, problem: string) => {
    if (socket?.connected) {
      socket.emit('rca:problem-update', { incidentId, rcaId, problem });
    }
  }, [socket]);

  const emitRCACategoriesUpdated = useCallback((incidentId: string, rcaId: string, categories: any[], problem: string) => {
    console.log('📊 [WS] emitRCACategoriesUpdated - connected:', socket?.connected, 'incidentId:', incidentId, 'rcaId:', rcaId, 'categories count:', categories.length);
    if (socket?.connected) {
      socket.emit('rca:categories-updated', { incidentId, rcaId, categories, problem });
      console.log('📊 [WS] Emitted rca:categories-updated');
    } else {
      console.log('📊 [WS] Socket not connected, cannot emit');
    }
  }, [socket]);

  const emitRCACorrectiveActionsUpdated = useCallback((incidentId: string, rcaId: string, actionPlans: any, preventiveControls: any[]) => {
    console.log('🛠️ [WS] emitRCACorrectiveActionsUpdated - connected:', socket?.connected, 'incidentId:', incidentId, 'rcaId:', rcaId);
    if (socket?.connected) {
      socket.emit('rca:corrective-actions-updated', { incidentId, rcaId, actionPlans, preventiveControls });
      console.log('🛠️ [WS] Emitted rca:corrective-actions-updated');
    } else {
      console.log('🛠️ [WS] Socket not connected, cannot emit');
    }
  }, [socket]);

  const emitRCACauseInputTyping = useCallback((incidentId: string, rcaId: string, categoryId: string, text: string) => {
    if (socket?.connected) {
      socket.emit('rca:cause-input-typing', { incidentId, rcaId, categoryId, text });
    }
  }, [socket]);

  const emitRCAFiveWhysModalOpened = useCallback((incidentId: string, rcaId: string, causeId: string, causeText: string, categoryName: string, mode: 'choose' | 'continue-or-restart' | 'manual' | 'ai', hasAnswers: boolean, answerCount: number, steps: Array<{ stepNumber: number; question: string; answer: string }>, rootCause?: string) => {
    console.log('🔍 [WS] emitRCAFiveWhysModalOpened - connected:', socket?.connected, 'mode:', mode, 'hasAnswers:', hasAnswers);
    if (socket?.connected) {
      socket.emit('rca:five-whys-modal-opened', { incidentId, rcaId, causeId, causeText, categoryName, mode, hasAnswers, answerCount, steps, rootCause });
      console.log('🔍 [WS] Emitted rca:five-whys-modal-opened with mode:', mode);
    }
  }, [socket]);

  const emitRCAFiveWhysModalClosed = useCallback((incidentId: string, rcaId: string) => {
    console.log('🔍 [WS] emitRCAFiveWhysModalClosed - connected:', socket?.connected);
    if (socket?.connected) {
      socket.emit('rca:five-whys-modal-closed', { incidentId, rcaId });
      console.log('🔍 [WS] Emitted rca:five-whys-modal-closed');
    }
  }, [socket]);

  const emitRCAFiveWhysModeChanged = useCallback((incidentId: string, rcaId: string, mode: 'choose' | 'manual' | 'ai', resetData?: { causeId: string; causeText: string; steps: Array<{ stepNumber: number; question: string; answer: string }>; hasAnswers: boolean; answerCount: number }) => {
    console.log('🔍 [WS] emitRCAFiveWhysModeChanged - connected:', socket?.connected, 'mode:', mode, 'hasResetData:', !!resetData);
    if (socket?.connected) {
      socket.emit('rca:five-whys-mode-changed', { incidentId, rcaId, mode, resetData });
      console.log('🔍 [WS] Emitted rca:five-whys-mode-changed');
    }
  }, [socket]);

  const emitRCAFiveWhysFieldTyping = useCallback((incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', isTyping: boolean, stepNumber?: number) => {
    console.log('🔍 [WS] emitRCAFiveWhysFieldTyping - connected:', socket?.connected, 'fieldType:', fieldType, 'stepNumber:', stepNumber, 'isTyping:', isTyping);
    if (socket?.connected) {
      socket.emit('rca:five-whys-field-typing', { incidentId, rcaId, fieldType, stepNumber, isTyping });
    }
  }, [socket]);

  const emitRCAFiveWhysFieldUpdate = useCallback((incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', text: string, stepNumber?: number, nextQuestion?: string) => {
    console.log('🔍 [WS] emitRCAFiveWhysFieldUpdate - connected:', socket?.connected, 'fieldType:', fieldType, 'stepNumber:', stepNumber, 'nextQuestion:', nextQuestion);
    if (socket?.connected) {
      socket.emit('rca:five-whys-field-update', { incidentId, rcaId, fieldType, stepNumber, text, nextQuestion });
    }
  }, [socket]);

  const emitRCAFiveWhysStatusChanged = useCallback((incidentId: string, rcaId: string, causeId: string, hasAnswers: boolean, answerCount: number) => {
    console.log('🔍 [WS] emitRCAFiveWhysStatusChanged - connected:', socket?.connected, 'causeId:', causeId, 'hasAnswers:', hasAnswers, 'answerCount:', answerCount);
    if (socket?.connected) {
      socket.emit('rca:five-whys-status-changed', { incidentId, rcaId, causeId, hasAnswers, answerCount });
    }
  }, [socket]);

  const emitRCAFiveWhysAIAnalyzing = useCallback((incidentId: string, rcaId: string, causeId: string, isAnalyzing: boolean) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIAnalyzing - connected:', socket?.connected, 'causeId:', causeId, 'isAnalyzing:', isAnalyzing);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-analyzing', { incidentId, rcaId, causeId, isAnalyzing });
    }
  }, [socket]);

  const emitRCAFiveWhysAIResult = useCallback((incidentId: string, rcaId: string, causeId: string, result: any) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIResult - connected:', socket?.connected, 'causeId:', causeId);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-result', { incidentId, rcaId, causeId, result });
    }
  }, [socket]);

  const emitRCAFiveWhysAIEditMode = useCallback((incidentId: string, rcaId: string, causeId: string, isEditing: boolean, editedSteps: Array<{ stepNumber: number; question: string; answer: string }>, editedRootCause: string) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIEditMode - connected:', socket?.connected, 'causeId:', causeId, 'isEditing:', isEditing);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-edit-mode', { incidentId, rcaId, causeId, isEditing, editedSteps, editedRootCause });
    }
  }, [socket]);

  const emitRCAFiveWhysAIEditTyping = useCallback((incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', isTyping: boolean, stepNumber?: number) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIEditTyping - connected:', socket?.connected, 'fieldType:', fieldType, 'stepNumber:', stepNumber, 'isTyping:', isTyping);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-edit-typing', { incidentId, rcaId, fieldType, stepNumber, isTyping });
    }
  }, [socket]);

  const emitRCAFiveWhysAIEditUpdate = useCallback((incidentId: string, rcaId: string, fieldType: 'why' | 'rootCause', text: string, stepNumber?: number) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIEditUpdate - connected:', socket?.connected, 'fieldType:', fieldType, 'stepNumber:', stepNumber);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-edit-update', { incidentId, rcaId, fieldType, stepNumber, text });
    }
  }, [socket]);

  const emitRCAFiveWhysManualValidating = useCallback((incidentId: string, rcaId: string, causeId: string, isValidating: boolean) => {
    console.log('🔍 [WS] emitRCAFiveWhysManualValidating - connected:', socket?.connected, 'causeId:', causeId, 'isValidating:', isValidating);
    if (socket?.connected) {
      socket.emit('rca:five-whys-manual-validating', { incidentId, rcaId, causeId, isValidating });
    }
  }, [socket]);

  const emitRCAFiveWhysManualValidationResult = useCallback((incidentId: string, rcaId: string, causeId: string, result: any) => {
    console.log('🔍 [WS] emitRCAFiveWhysManualValidationResult - connected:', socket?.connected, 'causeId:', causeId);
    if (socket?.connected) {
      socket.emit('rca:five-whys-manual-validation-result', { incidentId, rcaId, causeId, result });
    }
  }, [socket]);

  const emitRCAFiveWhysManualCorrectionApplied = useCallback((incidentId: string, rcaId: string, causeId: string, stepNumber: number, correctedText: string) => {
    console.log('🔍 [WS] emitRCAFiveWhysManualCorrectionApplied - connected:', socket?.connected, 'causeId:', causeId, 'stepNumber:', stepNumber);
    if (socket?.connected) {
      socket.emit('rca:five-whys-manual-correction-applied', { incidentId, rcaId, causeId, stepNumber, correctedText });
    }
  }, [socket]);

  const emitRCAFiveWhysAIEditValidating = useCallback((incidentId: string, rcaId: string, causeId: string, isValidating: boolean) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIEditValidating - connected:', socket?.connected, 'causeId:', causeId, 'isValidating:', isValidating);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-edit-validating', { incidentId, rcaId, causeId, isValidating });
    }
  }, [socket]);

  const emitRCAFiveWhysAIEditValidationResult = useCallback((incidentId: string, rcaId: string, causeId: string, result: any) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIEditValidationResult - connected:', socket?.connected, 'causeId:', causeId);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-edit-validation-result', { incidentId, rcaId, causeId, result });
    }
  }, [socket]);

  const emitRCAFiveWhysAIEditFixApplied = useCallback((incidentId: string, rcaId: string, causeId: string, stepNumber: number, correctedText: string) => {
    console.log('🔍 [WS] emitRCAFiveWhysAIEditFixApplied - connected:', socket?.connected, 'causeId:', causeId, 'stepNumber:', stepNumber);
    if (socket?.connected) {
      socket.emit('rca:five-whys-ai-edit-fix-applied', { incidentId, rcaId, causeId, stepNumber, correctedText });
    }
  }, [socket]);

  const emitRCAFiveWhysCauseRecommendation = useCallback((incidentId: string, rcaId: string, causeId: string, categoryName: string, recommendation: 'keep' | 'eliminate', fiveWhysAnalysis?: any) => {
    console.log('🔍 [WS] emitRCAFiveWhysCauseRecommendation - connected:', socket?.connected, 'causeId:', causeId, 'recommendation:', recommendation);
    if (socket?.connected) {
      socket.emit('rca:five-whys-cause-recommendation', { incidentId, rcaId, causeId, categoryName, recommendation, fiveWhysAnalysis });
    }
  }, [socket]);

  // ========================================
  // VIDEO CALL EMIT FUNCTIONS
  // ========================================

  const emitVideoCallStarted = useCallback((incidentId: string, roomUrl: string, roomName: string) => {
    console.log('📹 [WS] emitVideoCallStarted - connected:', socket?.connected, 'incidentId:', incidentId);
    if (socket?.connected) {
      socket.emit('video-call:started', { incidentId, roomUrl, roomName });
    }
  }, [socket]);

  const emitVideoCallEnded = useCallback((incidentId: string, roomName: string) => {
    console.log('📹 [WS] emitVideoCallEnded - connected:', socket?.connected, 'incidentId:', incidentId);
    if (socket?.connected) {
      socket.emit('video-call:ended', { incidentId, roomName });
    }
  }, [socket]);

  const emitVideoCallUserJoined = useCallback((incidentId: string, roomName: string) => {
    console.log('📹 [WS] emitVideoCallUserJoined - connected:', socket?.connected, 'incidentId:', incidentId);
    if (socket?.connected) {
      socket.emit('video-call:user-joined', { incidentId, roomName });
    }
  }, [socket]);

  const emitVideoCallUserLeft = useCallback((incidentId: string, roomName: string) => {
    console.log('📹 [WS] emitVideoCallUserLeft - connected:', socket?.connected, 'incidentId:', incidentId);
    if (socket?.connected) {
      socket.emit('video-call:user-left', { incidentId, roomName });
    }
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        typingUsers,
        currentIncidentId,
        connect,
        disconnect,
        joinIncident,
        leaveIncident,
        sendMessage,
        setTyping,
        markMessagesRead,
        onMessage,
        onMessageUpdated,
        onMessageDeleted,
        onChatNotification,
        onTyping,
        onParticipantJoined,
        onParticipantLeft,
        onParticipantsUpdated,
        onParticipantRoleUpdated,
        onUserOnline,
        onUserOffline,
        onInvitationReceived,
        onInvitationDeclined,
        onVisibilityChanged,
        onReaction,
        onMessagePinned,
        onMessageUnpinned,
        onMessagesRead,
        onFmirCollaboratorAdded,
        onFmirCollaboratorRemoved,
        onFmirCollaboratorsUpdated,
        onFmirVisibilityChanged,
        onFmirVisibilityOff,
        onFmirUpdated,
        onFmirClosedStatusChanged,
        onFmirStatusChanged,
        onFmirDeleted,
        onFmirEvidenceUpdated,
        onFmirAuditProgress,
        onFmirCommentAdded,
        onFmirCommentDeleted,
        onPrivilegeChanged,
        onSupportNewRequest,
        onSupportStatusChanged,
        onRCACreated,
        onRCAMethodologyAnalysisStarted,
        onRCAMethodologyAnalysisComplete,
        onRCAModalState,
        onRCADataUpdated,
        onRCAMethodChanged,
        onRCAValidated,
        onRCAReopened,
        onRCAAIGenerationStarted,
        onRCAAIGenerationComplete,
        onRCAAISuggestionsStarted,
        onRCAAISuggestionsReceived,
        onRCAAIValidationStarted,
        onRCAAIValidationComplete,
        onRCAClarificationAnswer,
        onRCAProblemUpdate,
        onRCACategoriesUpdated,
        onRCACorrectiveActionsUpdated,
        onRCACauseInputTyping,
        onRCAFiveWhysModalOpened,
        onRCAFiveWhysModalClosed,
        onRCAFiveWhysModeChanged,
        onRCAFiveWhysFieldTyping,
        onRCAFiveWhysFieldUpdate,
        onRCAFiveWhysStatusChanged,
        onRCAFiveWhysAIAnalyzing,
        onRCAFiveWhysAIResult,
        emitRCAModalState,
        emitRCAClarificationAnswer,
        emitRCAProblemUpdate,
        emitRCACategoriesUpdated,
        emitRCACorrectiveActionsUpdated,
        emitRCACauseInputTyping,
        emitRCAFiveWhysModalOpened,
        emitRCAFiveWhysModalClosed,
        emitRCAFiveWhysModeChanged,
        emitRCAFiveWhysFieldTyping,
        emitRCAFiveWhysFieldUpdate,
        emitRCAFiveWhysStatusChanged,
        emitRCAFiveWhysAIAnalyzing,
        emitRCAFiveWhysAIResult,
        onRCAFiveWhysAIEditMode,
        onRCAFiveWhysAIEditTyping,
        onRCAFiveWhysAIEditUpdate,
        emitRCAFiveWhysAIEditMode,
        emitRCAFiveWhysAIEditTyping,
        emitRCAFiveWhysAIEditUpdate,
        onRCAFiveWhysManualValidating,
        onRCAFiveWhysManualValidationResult,
        onRCAFiveWhysManualCorrectionApplied,
        emitRCAFiveWhysManualValidating,
        emitRCAFiveWhysManualValidationResult,
        emitRCAFiveWhysManualCorrectionApplied,
        onRCAFiveWhysAIEditValidating,
        onRCAFiveWhysAIEditValidationResult,
        emitRCAFiveWhysAIEditValidating,
        emitRCAFiveWhysAIEditValidationResult,
        onRCAFiveWhysAIEditFixApplied,
        emitRCAFiveWhysAIEditFixApplied,
        onRCAFiveWhysCauseRecommendation,
        emitRCAFiveWhysCauseRecommendation,
        // Video call
        onVideoCallStarted,
        onVideoCallEnded,
        onVideoCallUserJoined,
        onVideoCallUserLeft,
        emitVideoCallStarted,
        emitVideoCallEnded,
        emitVideoCallUserJoined,
        emitVideoCallUserLeft,
        // Incident evidence
        onIncidentEvidenceAdded,
        // LSW completion
        onLswCompletionChanged,
        // LSW projects
        onLswProjectChanged,
        // LSW follow-ups
        onLswFollowUpChanged,
        // LSW triggers
        onLswTriggerChanged,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
