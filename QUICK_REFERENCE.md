# 🚀 Quick Reference Guide - DashMet Operations Intelligence

## Instant Commands

```bash
# First Time Setup
./setup.sh                          # Install dependencies & setup env

# Database Setup
cd backend
npx prisma generate                 # Generate Prisma client
npx prisma db push                  # Create database tables
npx prisma studio                   # Open database GUI

# Development
./start-dev.sh                      # Start both frontend & backend
npm run dev                         # Alternative: Start both servers

# Individual Servers
cd backend && npm run dev           # Backend only (port 5000)
cd frontend && npm run dev          # Frontend only (port 3000)

# Build for Production
npm run build                       # Build all workspaces
cd backend && npm run build         # Backend only
cd frontend && npm run build        # Frontend only

# Testing
npm run test                        # Run all tests
cd backend && npm test              # Backend tests
cd frontend && npm test             # Frontend tests
```

## URLs & Endpoints

```
Frontend:          http://localhost:3000
Backend API:       http://localhost:5000
Health Check:      http://localhost:5000/health
API Version:       http://localhost:5000/api/version
Database Studio:   http://localhost:5555 (after prisma studio)
```

## File Locations

### Configuration
```
Root .env:           .env
Backend .env:        backend/.env
Frontend .env:       frontend/.env.local
Database Schema:     backend/prisma/schema.prisma
Tailwind Config:     frontend/tailwind.config.js
TypeScript Config:   backend/tsconfig.json, frontend/tsconfig.json
```

### Key Directories
```
Backend Code:        backend/src/
Frontend Code:       frontend/src/
API Routes:          backend/src/routes/
Middleware:          backend/src/middleware/
Components:          frontend/src/components/
Pages:               frontend/src/app/
Logs:                backend/logs/
Uploads:             backend/uploads/
```

## Database Commands

```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Create/Update Database
npx prisma db push

# Create Migration
npx prisma migrate dev --name migration_name

# Reset Database (WARNING: Deletes all data)
npx prisma migrate reset

# Open Prisma Studio (Database GUI)
npx prisma studio

# Format Schema File
npx prisma format
```

## Environment Variables

### Required Backend Variables
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/rca_engine
JWT_SECRET=your-secret-key
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### Required Frontend Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## User Roles

```
OPERATOR                    # Basic user, reports incidents
SUPERVISOR                  # Manages team, reviews incidents
QA_FOOD_SAFETY             # Food safety specialist
MAINTENANCE_ENGINEERING    # Machine/equipment specialist
CI_MANAGER                 # Continuous improvement manager
ADMIN                      # Organization admin
SYSTEM_ADMIN               # System-wide admin
```

## API Structure (Phase 0 Complete)

```
GET  /health                    # Health check
GET  /api/version              # API version

# Phase 1 (Coming Next)
POST /api/auth/register        # Register user
POST /api/auth/login           # Login
POST /api/auth/logout          # Logout
GET  /api/auth/me              # Current user
```

## Common Issues & Solutions

### Issue: Dependencies not installed
```bash
# Solution
./setup.sh
```

### Issue: Database connection error
```bash
# Solution: Check DATABASE_URL in backend/.env
# Ensure PostgreSQL is running
# macOS: brew services start postgresql@14
# Linux: sudo systemctl start postgresql
```

### Issue: Port already in use
```bash
# Solution: Kill process on port
lsof -ti:5000 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

### Issue: Prisma client not generated
```bash
# Solution
cd backend
npx prisma generate
```

### Issue: TypeScript errors
```bash
# Solution: Ensure dependencies installed
cd backend && npm install
cd ../frontend && npm install
```

## Git Workflow

```bash
# Initial commit
git init
git add .
git commit -m "Phase 0: Project foundation complete"

# Create feature branch
git checkout -b phase-1-authentication

# Commit changes
git add .
git commit -m "Phase 1.1: Authentication system"

# Push to remote
git push origin phase-1-authentication
```

## Development Workflow

1. **Start Phase**
   - Review COPILOT_EXECUTION_CHECKLIST.md
   - Update PROGRESS.md
   - Create feature branch

2. **Development**
   - Write backend API
   - Write frontend components
   - Test locally
   - Update documentation

3. **Completion**
   - Run tests
   - Security check
   - Update checklist
   - Commit changes

## Code Style

### Backend (TypeScript)
```typescript
// Use async/await
export const handler = async (req: Request, res: Response) => {
  try {
    // Logic here
  } catch (error) {
    next(error);
  }
};

// Use Prisma for database
const user = await prisma.user.findUnique({ where: { id } });
```

### Frontend (React/TypeScript)
```typescript
// Use functional components
export default function Component() {
  const [state, setState] = useState();
  return <div>...</div>;
}

// Use hooks
const { data } = useQuery('key', fetchFn);
const { mutate } = useMutation(mutateFn);
```

## Testing

```bash
# Backend
cd backend
npm test                    # All tests
npm test -- --watch        # Watch mode
npm test auth.test.ts      # Specific file

# Frontend  
cd frontend
npm test                    # All tests
npm test -- --watch        # Watch mode
```

## Logs

```bash
# View backend logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Watch logs in real-time
cd backend && npm run dev
# Logs will appear in console
```

## Security Checklist

- [ ] No secrets in code
- [ ] .env files in .gitignore
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] JWT tokens secure
- [ ] File uploads validated
- [ ] HTTPS in production

## Production Deployment

```bash
# Build
npm run build

# Set environment to production
export NODE_ENV=production

# Run migrations
cd backend
npx prisma migrate deploy

# Start production servers
npm run start
```

## Monitoring

```bash
# Check server health
curl http://localhost:5000/health

# Check API version
curl http://localhost:5000/api/version

# Check database connection
cd backend && npx prisma studio
```

## Documentation Files

```
README.md                      # Main documentation
BUILD_COMPLETE_PHASE_0.md     # Phase 0 completion report
PROGRESS.md                    # Build progress tracker
COPILOT_EXECUTION_CHECKLIST.md # Implementation checklist
QUICK_REFERENCE.md            # This file
dashmet-operations-intelligence-architecture.md # System architecture
```

## Support

For issues:
1. Check this guide
2. Review README.md
3. Check error logs
4. Review documentation files

---

**Current Status**: Phase 0 Complete ✅  
**Next Phase**: Phase 1 - Authentication & RBAC  
**Last Updated**: December 7, 2025
