#!/bin/bash
cd "$(cd "$(dirname "$0")/mobile" && pwd)"

echo "Installing dependencies (needs internet)..."
npm install

echo "Ensuring Expo packages match SDK 54..."
npx expo install --fix

echo ""
echo "Starting Expo..."
npx expo start
