#!/bin/bash

# Pillaxia Native Assets Copy Script
# Run this after: npx cap add ios && npx cap add android

set -e

echo "🎨 Copying native assets for Pillaxia..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==================== iOS Assets ====================
if [ -d "ios/App/App/Assets.xcassets" ]; then
    echo -e "${GREEN}📱 iOS platform detected${NC}"
    
    # Create AppIcon.appiconset directory if it doesn't exist
    ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
    mkdir -p "$ICON_DIR"
    
    # Copy iOS icons
    echo "  Copying iOS app icons..."
    cp public/ios-icons/icon-1024.png "$ICON_DIR/AppIcon-512@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-180.png "$ICON_DIR/AppIcon-60@3x.png" 2>/dev/null || true
    cp public/ios-icons/icon-167.png "$ICON_DIR/AppIcon-83.5@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-152.png "$ICON_DIR/AppIcon-76@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-120.png "$ICON_DIR/AppIcon-60@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-87.png "$ICON_DIR/AppIcon-29@3x.png" 2>/dev/null || true
    cp public/ios-icons/icon-80.png "$ICON_DIR/AppIcon-40@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-76.png "$ICON_DIR/AppIcon-76.png" 2>/dev/null || true
    cp public/ios-icons/icon-60.png "$ICON_DIR/AppIcon-60.png" 2>/dev/null || true
    cp public/ios-icons/icon-58.png "$ICON_DIR/AppIcon-29@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-40.png "$ICON_DIR/AppIcon-40.png" 2>/dev/null || true
    cp public/ios-icons/icon-29.png "$ICON_DIR/AppIcon-29.png" 2>/dev/null || true
    
    # Create Contents.json for AppIcon - Complete iOS icon set
    echo "  Creating AppIcon Contents.json..."
    cat > "$ICON_DIR/Contents.json" << 'EOF'
{
  "images": [
    {
      "filename": "AppIcon-20@2x.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-20@3x.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-29@2x.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-29@3x.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-40@2x.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-40@3x.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-60@2x.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "60x60"
    },
    {
      "filename": "AppIcon-60@3x.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "60x60"
    },
    {
      "filename": "AppIcon-20.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-20@2x-ipad.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-29.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-29@2x-ipad.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-40.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-40@2x-ipad.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-76.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "76x76"
    },
    {
      "filename": "AppIcon-76@2x.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "76x76"
    },
    {
      "filename": "AppIcon-83.5@2x.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "83.5x83.5"
    },
    {
      "filename": "AppIcon-1024.png",
      "idiom": "ios-marketing",
      "scale": "1x",
      "size": "1024x1024"
    }
  ],
  "info": {
    "author": "xcode",
    "version": 1
  }
}
EOF

    # Copy all required iOS icon sizes with correct names
    echo "  Copying iOS app icons with correct filenames..."
    cp public/ios-icons/icon-1024.png "$ICON_DIR/AppIcon-1024.png" 2>/dev/null || true
    cp public/ios-icons/icon-180.png "$ICON_DIR/AppIcon-60@3x.png" 2>/dev/null || true
    cp public/ios-icons/icon-167.png "$ICON_DIR/AppIcon-83.5@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-152.png "$ICON_DIR/AppIcon-76@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-120.png "$ICON_DIR/AppIcon-60@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-120.png "$ICON_DIR/AppIcon-40@3x.png" 2>/dev/null || true
    cp public/ios-icons/icon-87.png "$ICON_DIR/AppIcon-29@3x.png" 2>/dev/null || true
    cp public/ios-icons/icon-80.png "$ICON_DIR/AppIcon-40@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-80.png "$ICON_DIR/AppIcon-40@2x-ipad.png" 2>/dev/null || true
    cp public/ios-icons/icon-76.png "$ICON_DIR/AppIcon-76.png" 2>/dev/null || true
    cp public/ios-icons/icon-60.png "$ICON_DIR/AppIcon-20@3x.png" 2>/dev/null || true
    cp public/ios-icons/icon-58.png "$ICON_DIR/AppIcon-29@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-58.png "$ICON_DIR/AppIcon-29@2x-ipad.png" 2>/dev/null || true
    cp public/ios-icons/icon-40.png "$ICON_DIR/AppIcon-40.png" 2>/dev/null || true
    cp public/ios-icons/icon-40.png "$ICON_DIR/AppIcon-20@2x.png" 2>/dev/null || true
    cp public/ios-icons/icon-40.png "$ICON_DIR/AppIcon-20@2x-ipad.png" 2>/dev/null || true
    cp public/ios-icons/icon-29.png "$ICON_DIR/AppIcon-29.png" 2>/dev/null || true
    cp public/ios-icons/icon-29.png "$ICON_DIR/AppIcon-20.png" 2>/dev/null || true

    # Create Splash screen imageset
    SPLASH_DIR="ios/App/App/Assets.xcassets/Splash.imageset"
    mkdir -p "$SPLASH_DIR"
    
    echo "  Copying iOS splash screens..."
    cp public/splash-screens/splash-1284x2778.png "$SPLASH_DIR/splash-2778.png" 2>/dev/null || true
    cp public/splash-screens/splash-1170x2532.png "$SPLASH_DIR/splash-2532.png" 2>/dev/null || true
    cp public/splash-screens/splash-2048x2732.png "$SPLASH_DIR/splash-2732.png" 2>/dev/null || true
    
    # Create Contents.json for Splash
    cat > "$SPLASH_DIR/Contents.json" << 'EOF'
{
  "images": [
    {
      "filename": "splash-2532.png",
      "idiom": "universal",
      "scale": "1x"
    },
    {
      "filename": "splash-2778.png",
      "idiom": "universal",
      "scale": "2x"
    },
    {
      "filename": "splash-2732.png",
      "idiom": "universal",
      "scale": "3x"
    }
  ],
  "info": {
    "author": "xcode",
    "version": 1
  }
}
EOF

    echo -e "${GREEN}  ✅ iOS assets copied successfully${NC}"
else
    echo -e "${YELLOW}⚠️  iOS platform not found. Run 'npx cap add ios' first.${NC}"
fi

# ==================== Android Assets ====================
if [ -d "android/app/src/main/res" ]; then
    echo -e "${GREEN}🤖 Android platform detected${NC}"
    
    RES_DIR="android/app/src/main/res"
    
    # Create mipmap directories
    echo "  Copying Android launcher icons..."
    mkdir -p "$RES_DIR/mipmap-mdpi"
    mkdir -p "$RES_DIR/mipmap-hdpi"
    mkdir -p "$RES_DIR/mipmap-xhdpi"
    mkdir -p "$RES_DIR/mipmap-xxhdpi"
    mkdir -p "$RES_DIR/mipmap-xxxhdpi"
    mkdir -p "$RES_DIR/mipmap-anydpi-v26"
    
    # Copy launcher icons
    cp public/android-icons/ic_launcher-mdpi.png "$RES_DIR/mipmap-mdpi/ic_launcher.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-hdpi.png "$RES_DIR/mipmap-hdpi/ic_launcher.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-xhdpi.png "$RES_DIR/mipmap-xhdpi/ic_launcher.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-xxhdpi.png "$RES_DIR/mipmap-xxhdpi/ic_launcher.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-xxxhdpi.png "$RES_DIR/mipmap-xxxhdpi/ic_launcher.png" 2>/dev/null || true
    
    # Copy round launcher icons (same as regular for now)
    cp public/android-icons/ic_launcher-mdpi.png "$RES_DIR/mipmap-mdpi/ic_launcher_round.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-hdpi.png "$RES_DIR/mipmap-hdpi/ic_launcher_round.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-xhdpi.png "$RES_DIR/mipmap-xhdpi/ic_launcher_round.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-xxhdpi.png "$RES_DIR/mipmap-xxhdpi/ic_launcher_round.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher-xxxhdpi.png "$RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png" 2>/dev/null || true
    
    # Copy adaptive icon layers
    echo "  Copying adaptive icon layers..."
    cp public/android-icons/ic_launcher_foreground.png "$RES_DIR/mipmap-xxxhdpi/ic_launcher_foreground.png" 2>/dev/null || true
    cp public/android-icons/ic_launcher_background.png "$RES_DIR/mipmap-xxxhdpi/ic_launcher_background.png" 2>/dev/null || true
    
    # Create adaptive icon XML
    cat > "$RES_DIR/mipmap-anydpi-v26/ic_launcher.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF

    cat > "$RES_DIR/mipmap-anydpi-v26/ic_launcher_round.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF

    # Create drawable directories for splash screens
    echo "  Copying Android splash screens..."
    mkdir -p "$RES_DIR/drawable"
    mkdir -p "$RES_DIR/drawable-mdpi"
    mkdir -p "$RES_DIR/drawable-hdpi"
    mkdir -p "$RES_DIR/drawable-xhdpi"
    mkdir -p "$RES_DIR/drawable-xxhdpi"
    mkdir -p "$RES_DIR/drawable-xxxhdpi"
    
    cp public/android-splash/splash-mdpi.png "$RES_DIR/drawable-mdpi/splash.png" 2>/dev/null || true
    cp public/android-splash/splash-hdpi.png "$RES_DIR/drawable-hdpi/splash.png" 2>/dev/null || true
    cp public/android-splash/splash-xhdpi.png "$RES_DIR/drawable-xhdpi/splash.png" 2>/dev/null || true
    cp public/android-splash/splash-xxhdpi.png "$RES_DIR/drawable-xxhdpi/splash.png" 2>/dev/null || true
    cp public/android-splash/splash-xxxhdpi.png "$RES_DIR/drawable-xxxhdpi/splash.png" 2>/dev/null || true
    
    # Copy a default splash to drawable
    cp public/android-splash/splash-xxhdpi.png "$RES_DIR/drawable/splash.png" 2>/dev/null || true
    
    echo -e "${GREEN}  ✅ Android assets copied successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Android platform not found. Run 'npx cap add android' first.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Asset copy complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run 'npx cap sync' to sync changes"
echo "  2. Open in Xcode: 'npx cap open ios'"
echo "  3. Open in Android Studio: 'npx cap open android'"
