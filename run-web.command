#!/bin/bash
cd "$(cd "$(dirname "$0")" && pwd)"

echo "Installing dependencies (needs internet)..."
npm install --legacy-peer-deps

echo ""
echo "Starting web app..."
npm run dev
