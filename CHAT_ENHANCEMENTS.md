# Team Collaboration Chat Enhancements

## Overview
Enhanced chat features for the Incident & RCA collaboration system to make team communication more effective, user-friendly, and integrated with the incident lifecycle.

---

## Implementation Checklist

### Phase 1: Quick Actions & UX Improvements
- [x] **1.1 Emoji Reactions** ✅ DONE - Add reaction buttons (👍 ✅ ❓ 🔥 👀) to messages
- [x] **1.2 @Mentions** ✅ DONE - Tag team members with notifications
- [x] **1.3 Pin Important Messages** ✅ DONE - Keep key decisions visible at top
- [x] **1.4 Message Actions Menu** ✅ DONE - Edit, delete, copy, pin options on hover
- [x] **1.5 Improved Reply Button** ✅ DONE - Larger, more visible reply button

### Phase 2: Incident-Specific Actions
- [x] **2.1 Link to Evidence** ✅ DONE - Reference uploaded photos/documents in chat
- [x] **2.2 Link to RCA Findings** ✅ DONE - Share specific fishbone causes or 5-Whys
- [x] **2.3 Create Action Items** ✅ DONE - Turn chat messages into CAPA tasks
- [x] **2.4 Status Update Messages** ✅ DONE - Automatic notifications when incident status changes
- [x] **2.5 Handoff Messages** ✅ DONE - Formal shift handoff with checklist

### Phase 3: Smart Message Types
- [x] **3.1 Decision Messages** ✅ DONE - Mark and highlight key decisions made
- [x] **3.2 Question/Answer Threads** ✅ DONE - Track open questions with resolution status
- [x] **3.3 Update Messages** ✅ DONE - Formal status updates vs casual chat
- [x] **3.4 Announcement Messages** ✅ DONE - Important team-wide announcements

### Phase 4: Rich Content
- [x] **4.1 Image Sharing** ✅ DONE - Drag & drop images directly in chat
- [x] **4.2 File Attachments** ✅ DONE - Share documents in chat
- [x] **4.3 Voice Messages** ✅ DONE - Quick audio recordings
- [x] **4.4 Message Templates** ✅ DONE - Quick insert common phrases/updates

### Phase 5: Organization & Search
- [ ] **5.1 Search Messages** - Full-text search in chat history
- [ ] **5.2 Filter Messages** - By date, user, message type
- [ ] **5.3 Export Chat History** - PDF/CSV export for documentation
- [ ] **5.4 Thread Replies** - Organize sub-conversations

---

## Detailed Feature Specifications

### 1.1 Emoji Reactions
**Description:** Allow users to quickly react to messages with emojis without typing a response.

**Reactions Available:**
- 👍 Like/Agree
- ✅ Done/Confirmed
- ❓ Question/Unclear
- 🔥 Urgent/Important
- 👀 Noted/Seen
- ❤️ Appreciate

**UI/UX:**
- Hover over message → Show reaction picker
- Click reaction → Add/toggle reaction
- Show reaction count below message
- Show who reacted on hover

**Database Changes:**
```prisma
model ChatMessageReaction {
  id        String   @id @default(uuid())
  messageId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())
  
  message   ChatMessage @relation(fields: [messageId], references: [id])
  user      User        @relation(fields: [userId], references: [id])
  
  @@unique([messageId, userId, emoji])
}
```

---

### 1.2 @Mentions
**Description:** Tag specific team members to notify them.

**Features:**
- Type `@` to trigger autocomplete of team members
- Mentioned users receive notification
- Highlight mentions in message
- Filter messages by "mentions me"

**UI/UX:**
- `@` triggers dropdown with participant list
- Mentioned name highlighted in blue
- Notification badge on chat icon
- Push notification (optional)

---

### 1.3 Pin Important Messages
**Description:** Pin critical messages to top of chat for easy reference.

**Features:**
- Pin/unpin button on messages
- Pinned messages section at top
- Max 5 pinned messages per incident
- Show who pinned and when

**Database Changes:**
```prisma
model ChatMessage {
  // ... existing fields
  isPinned    Boolean   @default(false)
  pinnedAt    DateTime?
  pinnedById  String?
}
```

---

### 1.4 Message Actions Menu
**Description:** Contextual menu for message actions.

**Actions:**
- Reply (existing)
- React (new)
- Pin/Unpin (new)
- Copy text
- Edit (own messages, within 15 min)
- Delete (own messages)
- Report (other's messages)

**UI/UX:**
- Three-dot menu on hover
- Or right-click context menu
- Keyboard shortcuts (R for reply, E for edit)

---

### 2.1 Link to Evidence
**Description:** Reference uploaded incident evidence in chat.

**Features:**
- `/evidence` command shows evidence picker
- Thumbnail preview in chat
- Click to view full evidence
- Evidence linked to message

---

### 2.3 Create Action Items from Chat
**Description:** Convert important chat messages into trackable CAPA items.

**Features:**
- "Create Task" button on messages
- Pre-fills task with message content
- Links back to original message
- Shows task status in chat

---

### 3.1 Decision Messages
**Description:** Mark messages as official decisions for audit trail.

**Features:**
- "Mark as Decision" action
- Special styling (border, icon)
- Appears in decision log
- Cannot be edited after marking

**UI:** 
```
┌─────────────────────────────────────┐
│ 📋 DECISION                         │
│ We will replace the conveyor belt   │
│ by end of week.                     │
│ ─────────────────────────────────── │
│ Decided by: John Smith              │
│ Dec 31, 2025 at 2:30 PM             │
└─────────────────────────────────────┘
```

---

### 5.1 Search Messages
**Description:** Find past messages quickly.

**Features:**
- Search bar in chat header
- Full-text search
- Highlight matches
- Jump to message in context
- Search filters (date, user, type)

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 High | Emoji Reactions | Medium | High |
| 🔴 High | @Mentions | Medium | High |
| 🔴 High | Message Actions Menu | Low | High |
| 🟡 Medium | Pin Messages | Low | Medium |
| 🟡 Medium | Image Sharing | Medium | Medium |
| 🟡 Medium | Search Messages | Medium | High |
| 🟢 Low | Decision Messages | Medium | Medium |
| 🟢 Low | Create Action Items | High | High |
| 🟢 Low | Voice Messages | High | Low |

---

## Phase 3: Smart Message Types - Implementation Details

### 3.1 Decision Messages ✅
**Description:** Mark important messages as official decisions for audit trail.

**Features:**
- "Mark as Decision" action in message context menu
- Special purple styling with decision icon
- Cannot be unmarked after marking (for audit integrity)
- GET /api/chat/:incidentId/decisions endpoint to retrieve all decisions

**UI:**
```
┌─────────────────────────────────────┐
│ 📋 DECISION                         │
│ We will replace the conveyor belt   │
│ by end of week.                     │
│ ─────────────────────────────────── │
│ Decided by: John Smith              │
│ Dec 31, 2025 at 2:30 PM             │
└─────────────────────────────────────┘
```

### 3.2 Question/Answer Threads ✅
**Description:** Track open questions requiring team input.

**Features:**
- Create questions via toolbar (❓ button)
- Questions highlighted with amber border
- Resolve questions with optional answer
- Reopen resolved questions if needed
- GET /api/chat/:incidentId/questions endpoint with open/resolved filter
- Question summary (total, open, resolved counts)

**Endpoints:**
- POST /api/chat/:incidentId/messages/question
- POST /api/chat/:incidentId/messages/:messageId/resolve-question
- POST /api/chat/:incidentId/messages/:messageId/reopen-question
- GET /api/chat/:incidentId/questions

### 3.3 Update Messages ✅
**Description:** Formal status updates distinct from casual chat.

**Categories:**
- Progress (blue) - Regular progress updates
- Blocker (red) - Issues blocking progress
- Milestone (green) - Key achievements
- General (gray) - Other updates

**Priority Levels:**
- Low, Normal, High

**Endpoint:**
- POST /api/chat/:incidentId/messages/update

### 3.4 Announcement Messages ✅
**Description:** Important team-wide announcements.

**Priority Levels:**
- Normal - Standard notification
- Important - Highlighted message (⚠️)
- Urgent - Immediate attention (🚨)

**Features:**
- Optional expiration date
- Notifies all participants
- Only team leads, owners, or admins can post

**Endpoints:**
- POST /api/chat/:incidentId/messages/announcement
- GET /api/chat/:incidentId/announcements

---

## Current Progress

### Completed ✅
- [x] Basic real-time chat with WebSocket
- [x] Message threading (reply to)
- [x] Read receipts
- [x] Typing indicators
- [x] Online status
- [x] System messages
- [x] Improved Reply button (larger, more visible)
- [x] Emoji Reactions
- [x] @Mentions
- [x] Pin Important Messages
- [x] Message Actions Menu
- [x] Link to Evidence
- [x] Link to RCA Findings
- [x] Create Action Items from Chat
- [x] Status Update Messages
- [x] Shift Handoff Messages
- [x] Decision Messages
- [x] Question/Answer Threads
- [x] Update Messages
- [x] Announcement Messages
- [x] Image Sharing (drag & drop)
- [x] File Attachments
- [x] Voice Messages
- [x] Message Templates

### In Progress 🚧
- [ ] Phase 5: Organization & Search (Search, filter, export)

### Next Up 📋
- [ ] Thread Replies

---

## Phase 4: Rich Content - Implementation Details

### 4.1 Image Sharing ✅
**Features:**
- Drag & drop images directly into chat
- Click to upload from file picker
- Image preview before sending
- Full-screen preview on click
- Support for multiple images at once (up to 10)

**Endpoints:**
- POST /api/chat/:incidentId/upload (single file)
- POST /api/chat/:incidentId/upload-multiple (multiple files)

### 4.2 File Attachments ✅
**Features:**
- Share PDF, Word, Excel, and other documents
- File type icons based on mime type
- File size display
- Direct download link
- Caption support

### 4.3 Voice Messages ✅
**Features:**
- In-browser audio recording
- Play/pause during review
- Recording time display (max 5 minutes)
- Discard and re-record option
- Waveform visualization
- Playback controls in chat

### 4.4 Message Templates ✅
**Features:**
- Quick insert common phrases
- 8 default templates for common scenarios
- Create custom templates
- Category organization (updates, investigation, actions, etc.)
- Usage tracking for popular templates
- Search and filter templates

**Default Templates:**
1. Status Update
2. Investigation Finding
3. Action Required
4. Root Cause Identified
5. Escalation Notice
6. Shift Handoff
7. Evidence Added
8. Meeting Summary

**Endpoints:**
- GET /api/chat/templates
- POST /api/chat/templates
- PUT /api/chat/templates/:templateId
- DELETE /api/chat/templates/:templateId
- POST /api/chat/templates/:templateId/use
