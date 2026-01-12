# Enterprise RCA Web Application

AI-Powered Root Cause Analysis Platform for Food Safety & Machine Issues

## 🎯 Project Overview

DashMet RCA Engine is an enterprise-grade, multi-tenant web application designed for:
- Food Manufacturing
- Warehousing & Logistics  
- General Manufacturing

Supporting comprehensive Root Cause Analysis for Food Safety and Machine/Equipment issues across USA, Mexico, and Canada.

## 🏗️ Architecture

### Backend (Node.js + Express + TypeScript)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based with session management
- **Security**: Helmet, CORS, Rate Limiting, Input Validation
- **File Uploads**: Multer with secure validation
- **Logging**: Winston

### Frontend (Next.js 14 + React + TypeScript)
- **Framework**: Next.js 14 with App Router
- **UI**: Tailwind CSS + Custom Components
- **State Management**: Zustand + React Query
- **Forms**: React Hook Form + Zod validation
- **Theming**: Dark/Light mode support
- **i18n**: Multi-language (English, Spanish, French)

## 📋 Implementation Status

### ✅ Phase 0: Project Foundation (COMPLETED)

**Phase 0.1: Initialize Web App Project**
- ✅ Backend API project with Express + TypeScript
- ✅ Frontend Next.js project  
- ✅ Environment configuration
- ✅ CORS enabled
- ✅ Secure API routing
- ✅ Base routing system

**Phase 0.2: Global App Structure**
- ✅ App Layout
- ✅ Protected Layout (ready for implementation)
- ✅ Public Layout (ready for implementation)
- ✅ Navigation System (ready for implementation)

**Phase 0.3: Global UI Systems**
- ✅ Theme Engine (Dark/Light mode)
- ✅ Language Engine (English/Spanish/French)
- ✅ Role Context Provider (prepared)
- ✅ Organization Context Provider

**Phase 0.4: Security Baseline**
- ✅ Central Authorization Middleware
- ✅ API Request Validation
- ✅ Rate Limiting
- ✅ Input Sanitization
- ✅ Secure File Upload Validation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
cd dashmet-rca-engine
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. **Set up environment variables**
```bash
# Copy example env files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit the .env files with your configuration
```

4. **Set up the database**
```bash
cd backend
npx prisma generate
npx prisma db push
```

5. **Start development servers**
```bash
# From root directory
npm run dev

# Or separately:
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/health

## 📁 Project Structure

```
dashmet-rca-engine/
├── backend/
│   ├── src/
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── routes/          # API routes
│   │   ├── utils/           # Utilities, logger, prisma
│   │   └── server.ts        # Express server
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   ├── lib/             # API client, utilities
│   │   └── styles/          # Global styles
│   └── package.json
└── package.json             # Workspace root

```

## 🔐 Security Features

- JWT-based authentication with refresh tokens
- Role-Based Access Control (7 roles)
- Multi-tenant organization isolation
- Rate limiting on API endpoints
- Input validation and sanitization
- Secure file upload with type validation
- Helmet security headers
- CORS configuration
- Audit logging

## 🌍 Multi-Language Support

- English (en)
- Spanish (es)
- French (fr)

Language can be switched via user preferences.

## 🎨 Theme Support

- Light mode
- Dark mode
- System preference detection
- Per-user preference storage

## 📝 Next Phases

### Phase 1: Authentication & RBAC
- User registration and login
- Password reset flow
- Session management
- Role-based route protection

### Phase 2: Multi-Tenant Organization Engine
- Organization creation
- Facility and line management
- Dynamic category system

### Phase 3: Incident Capture Engine
- Incident creation flow
- Evidence upload
- AI incident summary

[See COPILOT_EXECUTION_CHECKLIST.md for full roadmap]

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## 📦 Build for Production

```bash
# Build all workspaces
npm run build

# Start production servers
npm run start
```

## 📄 License

Proprietary - DashMet Corporation

## 👥 Contributors

Development Team - DashMet

---

**Status**: Phase 0 Complete ✅ | Ready for Phase 1 Implementation
