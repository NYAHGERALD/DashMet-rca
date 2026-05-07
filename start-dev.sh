#!/bin/bash

# Development startup script

echo "🚀 Starting DashMet Operations Intelligence in development mode..."
echo ""

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
  echo "❌ backend/.env not found. Run ./setup.sh first"
  exit 1
fi

# Check if node_modules exist
if [ ! -d "backend/node_modules" ] && [ ! -d "node_modules" ]; then
  echo "❌ Dependencies not installed. Run ./setup.sh first"
  exit 1
fi

if [ ! -d "frontend/node_modules" ] && [ ! -d "node_modules" ]; then
  echo "❌ Dependencies not installed. Run ./setup.sh first"
  exit 1
fi

echo "✅ Starting backend and frontend servers..."
echo ""
echo "📡 Backend API will run on: http://localhost:5000"
echo "🌐 Frontend will run on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start both servers concurrently
npm run dev
