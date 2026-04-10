# DashBoard AI Whiteboard — Architecture Plan

> Enterprise-grade collaborative whiteboard with AI-first design.  
> Codename: **Canvas AI**

---

## 1. Vision

Build a whiteboard platform that surpasses Microsoft Whiteboard and Miro by embedding AI natively into every interaction — not as a bolt-on feature, but as a core design principle. The board should feel like collaborating with an intelligent assistant that draws, organizes, and thinks alongside you.

---

## 2. Core Library & Rendering Engine

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Canvas Engine** | [tldraw v3](https://github.com/tldraw/tldraw) | Production-proven, React-native, MIT license, infinite canvas, extensible shape system, built-in selection/transform/undo |
| **Real-time Sync** | Yjs + y-websocket | CRDT-based conflict-free collaboration, works offline, sub-50ms sync |
| **Frontend** | Next.js 15 (App Router) | SSR, API routes, middleware, matches existing DashMet stack |
| **Backend** | Express.js + Node.js | WebSocket server for Yjs, REST API for persistence, matches existing backend |
| **Database** | PostgreSQL (Prisma ORM) | Board metadata, user permissions, version history |
| **Object Storage** | AWS S3 / Cloudflare R2 | Images, PDF uploads, board snapshots, exports |
| **Auth** | Firebase Auth (existing) | SSO, MFA, role-based access — reuse DashMet auth layer |
| **AI Runtime** | OpenAI GPT-4o + Whisper + DALL-E 3 | Text generation, voice transcription, image generation |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │  tldraw  │  │ AI Panel │  │ Voice    │  │ Collaboration │   │
│  │  Canvas  │  │ Sidebar  │  │ Controls │  │ Presence      │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘   │
│       │              │             │                │           │
│  ┌────▼──────────────▼─────────────▼────────────────▼───────┐   │
│  │              Yjs Document (CRDT State)                   │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │ WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│                      BACKEND (Express.js)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ y-websocket  │  │ REST API     │  │ AI Processing Queue  │   │
│  │ Server       │  │ /api/boards  │  │ (Bull + Redis)       │   │
│  └──────────────┘  └──────────────┘  └──────────┬───────────┘   │
│                                                  │              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────▼───────────┐   │
│  │ PostgreSQL   │  │ S3 / R2      │  │ OpenAI API           │   │
│  │ (Prisma)     │  │ (Assets)     │  │ GPT-4o / Whisper     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model

```
Board
├── id, title, description, thumbnail
├── ownerId → User
├── organizationId → Organization
├── visibility: PRIVATE | TEAM | PUBLIC
├── yjsDocId (reference to Yjs document state)
├── createdAt, updatedAt
│
├── BoardCollaborator[]
│   ├── userId → User
│   ├── role: OWNER | EDITOR | VIEWER
│   └── joinedAt
│
├── BoardVersion[]  (auto-saved snapshots)
│   ├── snapshot (JSON blob or Yjs state vector)
│   ├── createdBy → User
│   └── createdAt
│
├── BoardAsset[]  (uploaded images, PDFs)
│   ├── url (S3 key)
│   ├── type: IMAGE | PDF | SVG
│   └── metadata (dimensions, size)
│
├── BoardTemplate[]
│   ├── name, category
│   ├── shapes (JSON)
│   └── isPublic
│
└── AIInteraction[]  (audit trail)
    ├── prompt, response
    ├── type: DIAGRAM | SUMMARY | LAYOUT | SKETCH_REFINE
    └── createdAt
```

---

## 5. Feature Set

### 5.1 Core Whiteboard (tldraw)

- [x] Infinite canvas with zoom/pan
- [x] Freehand drawing (pen, highlighter, eraser)
- [x] Shapes: rectangle, ellipse, arrow, line, diamond, star, polygon
- [x] Text boxes with rich formatting (bold, italic, color, size)
- [x] Sticky notes (resizable, color-coded)
- [x] Connectors/arrows with auto-routing between shapes
- [x] Image upload (drag & drop, paste from clipboard)
- [x] PDF import (render pages as images on canvas)
- [x] Grouping, locking, layering (bring to front/back)
- [x] Undo/redo (unlimited history)
- [x] Grid & snap alignment
- [x] Mini-map navigation
- [x] Keyboard shortcuts

### 5.2 Real-Time Collaboration

- [x] Multi-user editing (see cursors, names, avatars)
- [x] Presence indicators (who is viewing/editing)
- [x] Follow mode (watch another user's viewport)
- [x] Comments & threads (pin to any location on canvas)
- [x] @mentions in comments
- [x] Voting / reactions on sticky notes
- [x] Cursor chat (quick ephemeral messages)
- [x] Offline mode with automatic sync on reconnect (Yjs CRDT)

### 5.3 Organization & Management

- [x] Board folders / workspaces
- [x] Templates library (Kanban, SWOT, Fishbone, Sprint Retro, etc.)
- [x] Role-based access (Owner, Editor, Viewer)
- [x] Share via link (with permission level)
- [x] Version history with visual diff & restore
- [x] Board search (by title, content, tags)
- [x] Favorites & recent boards
- [x] Board duplication

### 5.4 Export & Integration

- [x] Export: PNG, SVG, PDF, PPTX
- [x] Embed boards in other apps (iframe)
- [x] API for programmatic board creation
- [x] Integration with DashMet meetings (attach whiteboard to meeting)
- [x] Slack/Teams notifications for board activity

---

## 6. AI Features — The Differentiator

### 6.1 AI Shape Recognition (Sketch-to-Shape)

**What**: Draw rough shapes freehand → AI instantly converts to clean geometric shapes.

```
User draws wobbly circle → AI snaps to perfect circle
User draws rough flowchart → AI creates connected, aligned shapes
User draws rough table → AI creates structured grid
```

**Implementation**: Custom tldraw tool that captures stroke data, runs inference via a lightweight CNN model (TensorFlow.js client-side for speed), then replaces strokes with proper tldraw shapes.

### 6.2 Natural Language to Diagram

**What**: Type or speak a description → AI generates the diagram.

```
Prompt: "Create a flowchart for user registration:
         sign up → verify email → complete profile → dashboard"

Result: 4 rounded rectangles connected by arrows, auto-laid out top-to-bottom
```

**Implementation**: GPT-4o generates structured JSON (nodes + edges), custom renderer converts to tldraw shapes with dagre/ELK auto-layout.

### 6.3 AI Brainstorm Assistant

**What**: Start with a central topic → AI generates related ideas as sticky notes, expanding outward like a mind map.

```
Central topic: "Reduce production downtime"
AI generates: 
  - "Predictive maintenance sensors"
  - "Operator training program"  
  - "Spare parts inventory optimization"
  - "Root cause analysis automation"
  - ... (user can ask for more)
```

**Implementation**: GPT-4o with domain context, outputs placed radially around the central node. User can accept, edit, or regenerate each suggestion.

### 6.4 Smart Summarize & Cluster

**What**: Select a messy collection of sticky notes → AI groups them by theme, generates a summary, and optionally re-arranges them into organized clusters.

```
Before: 27 scattered sticky notes from brainstorm session
After:  5 themed columns with headers + 1-paragraph executive summary
```

**Implementation**: Embed sticky note text → cluster via k-means on embeddings → GPT-4o names each cluster → auto-layout into columns.

### 6.5 Voice-to-Diagram

**What**: Speak a process description → AI draws the diagram in real-time.

```
User says: "First the operator inspects the raw materials, 
            then they go to mixing, if the mix fails QA 
            it goes back to mixing, otherwise it moves to packaging"

Result: Flowchart with decision diamond for QA check, loop-back arrow
```

**Implementation**: Whisper API for transcription → GPT-4o for structured extraction → auto-layout renderer. Streaming — shapes appear as you speak.

### 6.6 Handwriting-to-Text (OCR)

**What**: Write text freehand with stylus/mouse → AI converts to typed text in place, preserving position and size.

**Implementation**: Tesseract.js (client-side) for fast recognition, with GPT-4o fallback for messy handwriting. Runs on stroke completion (debounced).

### 6.7 AI Auto-Layout

**What**: Select shapes → "Auto arrange" → AI determines the best layout based on content relationships.

```
Detects: This looks like an org chart → applies hierarchical layout
Detects: These are process steps → applies left-to-right flow
Detects: These are categories → applies grid/column layout
```

**Implementation**: Content analysis via embeddings to determine diagram type, then apply appropriate layout algorithm (dagre for flows, d3-hierarchy for trees, force-directed for networks).

### 6.8 AI Image Generation on Canvas

**What**: Describe an image → AI generates it directly on the canvas as a shape.

```
Prompt: "A factory floor with conveyor belts, isometric style"
Result: DALL-E 3 generated image placed on canvas, editable like any other element
```

### 6.9 Smart Templates

**What**: Describe your use case → AI generates a custom template.

```
Prompt: "I need a template for weekly food safety review 
         with sections for incidents, corrective actions, 
         and follow-ups"

Result: Pre-built board with labeled sections, headers, 
        color-coded zones, and placeholder sticky notes
```

### 6.10 Meeting Board AI

**What**: Connect to a live meeting → AI listens and builds a visual board in real-time.

```
During meeting: AI captures key points as sticky notes
                AI draws action items with assignees
                AI creates a timeline of decisions
Post-meeting:   Board is ready for review, no manual note-taking
```

**Implementation**: Integrates with MeetingIntelligence app. Whisper for transcription → GPT-4o for extraction → auto-placed on pre-configured meeting template.

---

## 7. What Competitors Lack (Our Edge)

| Gap in Miro / MS Whiteboard | Canvas AI Solution |
|-----|------|
| AI is a sidebar chatbot, not integrated into canvas | AI operates directly on canvas objects — select shapes and transform them |
| No voice-to-diagram | Full voice pipeline: speak → diagram appears in real-time |
| No sketch recognition (freehand stays freehand) | Instant sketch-to-shape with neural network |
| Templates are static | AI generates custom templates from description |
| No meeting integration | Native integration with MeetingIntelligence — live board during calls |
| Offline is limited/broken | Full offline with CRDT sync (Yjs) — works on airplane |
| Expensive per-seat ($8-16/user/mo) | Self-hosted option, usage-based AI pricing |
| No RCA/food safety domain tools | Built-in Fishbone, 5-Why, FMEA templates with AI-guided analysis |
| Export options limited | PNG, SVG, PDF, PPTX, plus board-to-presentation mode |
| No version control | Git-like version history with visual diff |

---

## 8. Tech Stack Summary

```
Frontend:       Next.js 15, React 19, TypeScript, Tailwind CSS
Canvas:         tldraw v3 (custom shapes, tools, UI)
Real-time:      Yjs + y-websocket (CRDT collaboration)
Backend:        Express.js, Node.js, TypeScript
Database:       PostgreSQL (Prisma ORM)
Cache/Queue:    Redis + BullMQ (AI job processing)
Storage:        AWS S3 / Cloudflare R2
Auth:           Firebase Auth (reuse existing)
AI:             OpenAI GPT-4o, Whisper, DALL-E 3
AI (client):    TensorFlow.js (sketch recognition), Tesseract.js (OCR)
Layout:         dagre (flowcharts), ELK (complex), d3-hierarchy (trees)
Testing:        Vitest, Playwright, React Testing Library
Deployment:     Docker, Render / AWS ECS
```

---

## 9. Implementation Phases

### Phase 1 — Foundation (Weeks 1-3)

- [ ] tldraw integration into Next.js app
- [ ] Board CRUD API (create, list, open, delete)
- [ ] Yjs WebSocket server for real-time collaboration
- [ ] Board persistence (Yjs state → PostgreSQL)
- [ ] Basic auth integration (Firebase)
- [ ] Image upload to S3
- [ ] Export: PNG, SVG, PDF

### Phase 2 — Collaboration & UX (Weeks 4-5)

- [ ] Multi-user cursors and presence
- [ ] Comments & threads
- [ ] Follow mode
- [ ] Board templates (10 built-in: Kanban, SWOT, Fishbone, Sprint Retro, etc.)
- [ ] Version history & restore
- [ ] Folders / workspace organization
- [ ] Share via link with permissions

### Phase 3 — AI Core (Weeks 6-8)

- [ ] Natural language → diagram (GPT-4o + auto-layout)
- [ ] AI brainstorm (topic → sticky notes)
- [ ] Smart summarize & cluster
- [ ] Sketch-to-shape recognition (TensorFlow.js)
- [ ] AI auto-layout engine
- [ ] Handwriting OCR (Tesseract.js)

### Phase 4 — AI Advanced (Weeks 9-10)

- [ ] Voice-to-diagram (Whisper + streaming)
- [ ] AI image generation (DALL-E 3)
- [ ] Smart templates from description
- [ ] AI interaction history & audit trail
- [ ] Usage metering for AI features

### Phase 5 — Integration & Polish (Weeks 11-12)

- [ ] MeetingIntelligence integration (live meeting board)
- [ ] DashMet LSW integration (embed boards in reports)
- [ ] PPTX export (board → slide deck)
- [ ] Offline mode hardening
- [ ] Performance optimization (large boards, 1000+ shapes)
- [ ] Mobile responsive / touch support
- [ ] Accessibility (keyboard nav, screen reader)

---

## 10. API Surface

```
POST   /api/boards                    Create board
GET    /api/boards                    List user's boards
GET    /api/boards/:id                Get board metadata
PATCH  /api/boards/:id                Update board (title, visibility)
DELETE /api/boards/:id                Delete board
GET    /api/boards/:id/versions       List version history
POST   /api/boards/:id/versions       Create snapshot
POST   /api/boards/:id/restore/:vid   Restore version
POST   /api/boards/:id/export         Export (png/svg/pdf/pptx)
POST   /api/boards/:id/duplicate      Duplicate board

POST   /api/boards/:id/collaborators  Add collaborator
DELETE /api/boards/:id/collaborators/:uid  Remove collaborator

POST   /api/boards/:id/comments       Add comment
GET    /api/boards/:id/comments       List comments

POST   /api/boards/:id/assets         Upload asset (image/pdf)

WebSocket  /ws/board/:id              Yjs sync protocol

# AI Endpoints
POST   /api/ai/diagram                Text → diagram JSON
POST   /api/ai/brainstorm             Topic → ideas
POST   /api/ai/summarize              Shapes → summary + clusters
POST   /api/ai/voice-to-diagram       Audio → diagram
POST   /api/ai/generate-image         Prompt → image
POST   /api/ai/generate-template      Description → template
POST   /api/ai/recognize-sketch       Strokes → shapes
POST   /api/ai/ocr                    Strokes → text
POST   /api/ai/auto-layout            Shapes → repositioned shapes
```

---

## 11. Security & Compliance

- All WebSocket connections authenticated via Firebase token
- Board-level RBAC: Owner, Editor, Viewer
- AI prompts never include user PII — only canvas content
- AI interaction audit trail for compliance
- Rate limiting on AI endpoints (per-user, per-org)
- S3 assets served via signed URLs (time-limited)
- CORS restricted to app domain
- CSP headers for iframe embed security
- GDPR: board data export & deletion on request

---

## 12. Performance Targets

| Metric | Target |
|--------|--------|
| Canvas render (1000 shapes) | < 16ms frame time (60fps) |
| WebSocket sync latency | < 100ms (same region) |
| Board load time | < 2s (cold), < 500ms (cached) |
| AI diagram generation | < 5s |
| AI brainstorm response | < 3s |
| Voice-to-diagram (streaming) | First shape in < 2s |
| Sketch recognition | < 200ms (client-side) |
| OCR recognition | < 500ms (client-side) |
| Export PNG/SVG | < 2s |
| Export PDF/PPTX | < 5s |
| Concurrent users per board | 50+ |
| Max shapes per board | 10,000+ |

---

*This document is the single source of truth for Canvas AI architecture and feature scope. All implementation should follow this plan.*
