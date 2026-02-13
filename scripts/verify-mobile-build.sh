#!/usr/bin/env bash
# Verify Capacitor mobile app build: web build + sync, then optional open in IDE.
# Run from project root: ./scripts/verify-mobile-build.sh [ios|android]
# Without args: only build and sync (no IDE). With ios/android: also run cap open.

set -e
cd "$(dirname "$0")/.."

echo "=== Pillaxia mobile (Capacitor) verification ==="

# 1. Web build
echo ""
echo "1. Building web app (Vite)..."
npm run build
if [[ ! -f dist/index.html ]]; then
  echo "ERROR: dist/index.html missing after build."
  exit 1
fi
echo "   OK: dist/ has web assets."

# 2. Sync native projects
echo ""
echo "2. Syncing native projects (cap sync)..."
npx cap sync
echo "   OK: cap sync completed."

# 3. Check platforms exist
missing=0
for dir in ios android; do
  if [[ ! -d "$dir" ]]; then
    echo "   WARN: $dir/ not found. Run: npm run mobile:add"
    missing=1
  fi
done
if [[ $missing -eq 1 ]]; then
  echo ""
  echo "   Add native projects first: npm run mobile:add"
  exit 1
fi
echo "   OK: ios/ and android/ present."

echo ""
echo "=== Mobile build verification passed ==="
echo ""
echo "Next: run the app in a simulator or device:"
echo "  iOS:    npm run cap:ios    (opens Xcode; pick simulator/device and Run)"
echo "  Android: npm run cap:android (opens Android Studio; pick device and Run)"
echo ""

# Optional: open IDE
target="${1:-}"
if [[ "$target" == "ios" ]]; then
  echo "Opening Xcode..."
  npx cap open ios
elif [[ "$target" == "android" ]]; then
  echo "Opening Android Studio..."
  npx cap open android
fi
