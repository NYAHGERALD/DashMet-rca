#!/bin/bash

# Enterprise RCA Engine - Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up DashMet RCA Engine..."
echo ""

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18 or higher is required. Current version: $(node -v)"
  exit 1
fi
echo "✅ Node.js version: $(node -v)"
echo ""

# Check PostgreSQL
echo "📋 Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
  echo "⚠️  PostgreSQL not found. Please install PostgreSQL 14+"
  echo "   macOS: brew install postgresql@14"
  echo "   Ubuntu: sudo apt install postgresql"
else
  echo "✅ PostgreSQL installed"
fi
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
echo "✅ Backend dependencies installed"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install
echo "✅ Frontend dependencies installed"
cd ..
echo ""

# Setup environment files
echo "🔧 Setting up environment files..."

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ Root .env created from .env.example"
else
  echo "⚠️  Root .env already exists, skipping"
fi

if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo "✅ Backend .env created from .env.example"
  echo "⚠️  Please update backend/.env with your database credentials"
else
  echo "⚠️  Backend .env already exists, skipping"
fi

if [ ! -f "frontend/.env.local" ]; then
  cp frontend/.env.example frontend/.env.local
  echo "✅ Frontend .env.local created from .env.example"
else
  echo "⚠️  Frontend .env.local already exists, skipping"
fi
echo ""

# Create directories
echo "📁 Creating required directories..."
mkdir -p backend/logs
mkdir -p backend/uploads
echo "✅ Directories created"
echo ""

# Setup Prisma
echo "🗄️  Setting up Prisma..."
cd backend
npx prisma generate
echo "✅ Prisma client generated"
echo ""

echo "⚠️  IMPORTANT: Before running the app, please:"
echo "   1. Create a PostgreSQL database"
echo "   2. Update backend/.env with your database URL"
echo "   3. Run: cd backend && npx prisma db push"
echo ""

echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Update environment variables in backend/.env"
echo "   2. Run database migrations: cd backend && npx prisma db push"
echo "   3. Start development: npm run dev"
echo ""
