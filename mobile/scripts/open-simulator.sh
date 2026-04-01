#!/bin/bash
# Open iOS Simulator and bring it to the front so the phone display is visible.

SIMULATOR_APP="/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app"

if [ ! -d "$SIMULATOR_APP" ]; then
  echo "Simulator not found at $SIMULATOR_APP"
  echo "Make sure Xcode is installed from the App Store."
  exit 1
fi

echo "Opening iOS Simulator..."
open "$SIMULATOR_APP"

# Wait for Simulator to start
sleep 4

# Bring Simulator to front (macOS AppleScript)
osascript -e 'tell application "Simulator" to activate' 2>/dev/null || true

echo "Simulator should now be visible. Run 'npm run ios' to launch the app."
