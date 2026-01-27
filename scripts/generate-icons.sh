#!/bin/bash

# Pillaxia Native Icon Generator
# Generates all iOS and Android icons from a single source image
# Uses macOS sips for exact pixel-perfect sizing

set -e

SOURCE_ICON="public/app-icon.png"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Pillaxia Native Icon Generator         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if source exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo -e "${RED}❌ Source icon not found at $SOURCE_ICON${NC}"
    echo "   Please ensure you have a 1024x1024 app icon"
    exit 1
fi

echo -e "📦 Source: ${GREEN}$SOURCE_ICON${NC}"
echo ""

# Function to resize icon
resize_icon() {
    local size=$1
    local dest=$2
    cp "$SOURCE_ICON" "$dest"
    sips -z $size $size "$dest" --out "$dest" > /dev/null 2>&1
}

# ==================== iOS Icons ====================
if [ -d "ios/App/App/Assets.xcassets" ]; then
    echo -e "${GREEN}📱 Generating iOS icons...${NC}"
    
    ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
    mkdir -p "$ICON_DIR"
    
    # Generate all required iOS icon sizes
    echo "  • AppIcon-1024.png (1024x1024)"
    resize_icon 1024 "$ICON_DIR/AppIcon-1024.png"
    
    echo "  • AppIcon-60@3x.png (180x180)"
    resize_icon 180 "$ICON_DIR/AppIcon-60@3x.png"
    
    echo "  • AppIcon-83.5@2x.png (167x167)"
    resize_icon 167 "$ICON_DIR/AppIcon-83.5@2x.png"
    
    echo "  • AppIcon-76@2x.png (152x152)"
    resize_icon 152 "$ICON_DIR/AppIcon-76@2x.png"
    
    echo "  • AppIcon-60@2x.png (120x120)"
    resize_icon 120 "$ICON_DIR/AppIcon-60@2x.png"
    
    echo "  • AppIcon-40@3x.png (120x120)"
    resize_icon 120 "$ICON_DIR/AppIcon-40@3x.png"
    
    echo "  • AppIcon-29@3x.png (87x87)"
    resize_icon 87 "$ICON_DIR/AppIcon-29@3x.png"
    
    echo "  • AppIcon-40@2x.png (80x80)"
    resize_icon 80 "$ICON_DIR/AppIcon-40@2x.png"
    
    echo "  • AppIcon-40@2x-ipad.png (80x80)"
    resize_icon 80 "$ICON_DIR/AppIcon-40@2x-ipad.png"
    
    echo "  • AppIcon-76.png (76x76)"
    resize_icon 76 "$ICON_DIR/AppIcon-76.png"
    
    echo "  • AppIcon-20@3x.png (60x60)"
    resize_icon 60 "$ICON_DIR/AppIcon-20@3x.png"
    
    echo "  • AppIcon-29@2x.png (58x58)"
    resize_icon 58 "$ICON_DIR/AppIcon-29@2x.png"
    
    echo "  • AppIcon-29@2x-ipad.png (58x58)"
    resize_icon 58 "$ICON_DIR/AppIcon-29@2x-ipad.png"
    
    echo "  • AppIcon-40.png (40x40)"
    resize_icon 40 "$ICON_DIR/AppIcon-40.png"
    
    echo "  • AppIcon-20@2x.png (40x40)"
    resize_icon 40 "$ICON_DIR/AppIcon-20@2x.png"
    
    echo "  • AppIcon-20@2x-ipad.png (40x40)"
    resize_icon 40 "$ICON_DIR/AppIcon-20@2x-ipad.png"
    
    echo "  • AppIcon-29.png (29x29)"
    resize_icon 29 "$ICON_DIR/AppIcon-29.png"
    
    echo "  • AppIcon-20.png (20x20)"
    resize_icon 20 "$ICON_DIR/AppIcon-20.png"
    
    # Create Contents.json
    cat > "$ICON_DIR/Contents.json" << 'EOF'
{
  "images": [
    {"filename": "AppIcon-20@2x.png", "idiom": "iphone", "scale": "2x", "size": "20x20"},
    {"filename": "AppIcon-20@3x.png", "idiom": "iphone", "scale": "3x", "size": "20x20"},
    {"filename": "AppIcon-29@2x.png", "idiom": "iphone", "scale": "2x", "size": "29x29"},
    {"filename": "AppIcon-29@3x.png", "idiom": "iphone", "scale": "3x", "size": "29x29"},
    {"filename": "AppIcon-40@2x.png", "idiom": "iphone", "scale": "2x", "size": "40x40"},
    {"filename": "AppIcon-40@3x.png", "idiom": "iphone", "scale": "3x", "size": "40x40"},
    {"filename": "AppIcon-60@2x.png", "idiom": "iphone", "scale": "2x", "size": "60x60"},
    {"filename": "AppIcon-60@3x.png", "idiom": "iphone", "scale": "3x", "size": "60x60"},
    {"filename": "AppIcon-20.png", "idiom": "ipad", "scale": "1x", "size": "20x20"},
    {"filename": "AppIcon-20@2x-ipad.png", "idiom": "ipad", "scale": "2x", "size": "20x20"},
    {"filename": "AppIcon-29.png", "idiom": "ipad", "scale": "1x", "size": "29x29"},
    {"filename": "AppIcon-29@2x-ipad.png", "idiom": "ipad", "scale": "2x", "size": "29x29"},
    {"filename": "AppIcon-40.png", "idiom": "ipad", "scale": "1x", "size": "40x40"},
    {"filename": "AppIcon-40@2x-ipad.png", "idiom": "ipad", "scale": "2x", "size": "40x40"},
    {"filename": "AppIcon-76.png", "idiom": "ipad", "scale": "1x", "size": "76x76"},
    {"filename": "AppIcon-76@2x.png", "idiom": "ipad", "scale": "2x", "size": "76x76"},
    {"filename": "AppIcon-83.5@2x.png", "idiom": "ipad", "scale": "2x", "size": "83.5x83.5"},
    {"filename": "AppIcon-1024.png", "idiom": "ios-marketing", "scale": "1x", "size": "1024x1024"}
  ],
  "info": {"author": "xcode", "version": 1}
}
EOF
    
    echo -e "${GREEN}  ✅ iOS icons complete (18 icons)${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  iOS platform not found. Skipping iOS icons.${NC}"
    echo ""
fi

# ==================== Android Icons ====================
if [ -d "android/app/src/main/res" ]; then
    echo -e "${GREEN}🤖 Generating Android icons...${NC}"
    
    RES_DIR="android/app/src/main/res"
    
    # Create directories
    mkdir -p "$RES_DIR/mipmap-mdpi"
    mkdir -p "$RES_DIR/mipmap-hdpi"
    mkdir -p "$RES_DIR/mipmap-xhdpi"
    mkdir -p "$RES_DIR/mipmap-xxhdpi"
    mkdir -p "$RES_DIR/mipmap-xxxhdpi"
    mkdir -p "$RES_DIR/mipmap-anydpi-v26"
    mkdir -p "$RES_DIR/values"
    mkdir -p "$RES_DIR/drawable"
    mkdir -p "$RES_DIR/drawable-mdpi"
    mkdir -p "$RES_DIR/drawable-hdpi"
    mkdir -p "$RES_DIR/drawable-xhdpi"
    mkdir -p "$RES_DIR/drawable-xxhdpi"
    mkdir -p "$RES_DIR/drawable-xxxhdpi"
    
    # Launcher icons
    echo "  • Launcher icons (5 densities)"
    resize_icon 48 "$RES_DIR/mipmap-mdpi/ic_launcher.png"
    resize_icon 72 "$RES_DIR/mipmap-hdpi/ic_launcher.png"
    resize_icon 96 "$RES_DIR/mipmap-xhdpi/ic_launcher.png"
    resize_icon 144 "$RES_DIR/mipmap-xxhdpi/ic_launcher.png"
    resize_icon 192 "$RES_DIR/mipmap-xxxhdpi/ic_launcher.png"
    
    # Round launcher icons
    echo "  • Round launcher icons (5 densities)"
    resize_icon 48 "$RES_DIR/mipmap-mdpi/ic_launcher_round.png"
    resize_icon 72 "$RES_DIR/mipmap-hdpi/ic_launcher_round.png"
    resize_icon 96 "$RES_DIR/mipmap-xhdpi/ic_launcher_round.png"
    resize_icon 144 "$RES_DIR/mipmap-xxhdpi/ic_launcher_round.png"
    resize_icon 192 "$RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png"
    
    # Adaptive icon foreground
    echo "  • Adaptive icon foreground layers (5 densities)"
    resize_icon 108 "$RES_DIR/mipmap-mdpi/ic_launcher_foreground.png"
    resize_icon 162 "$RES_DIR/mipmap-hdpi/ic_launcher_foreground.png"
    resize_icon 216 "$RES_DIR/mipmap-xhdpi/ic_launcher_foreground.png"
    resize_icon 324 "$RES_DIR/mipmap-xxhdpi/ic_launcher_foreground.png"
    resize_icon 432 "$RES_DIR/mipmap-xxxhdpi/ic_launcher_foreground.png"
    
    # Splash icons
    echo "  • Splash screen icons (5 densities)"
    resize_icon 128 "$RES_DIR/drawable-mdpi/splash.png"
    resize_icon 192 "$RES_DIR/drawable-hdpi/splash.png"
    resize_icon 256 "$RES_DIR/drawable-xhdpi/splash.png"
    resize_icon 384 "$RES_DIR/drawable-xxhdpi/splash.png"
    resize_icon 512 "$RES_DIR/drawable-xxxhdpi/splash.png"
    resize_icon 384 "$RES_DIR/drawable/splash.png"
    
    # Background color
    echo "  • Adaptive icon background color"
    cat > "$RES_DIR/values/ic_launcher_background.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1a1f4e</color>
</resources>
EOF
    
    # Adaptive icon XML
    echo "  • Adaptive icon XML configs"
    cat > "$RES_DIR/mipmap-anydpi-v26/ic_launcher.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF

    cat > "$RES_DIR/mipmap-anydpi-v26/ic_launcher_round.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF
    
    echo -e "${GREEN}  ✅ Android icons complete (26 icons)${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Android platform not found. Skipping Android icons.${NC}"
    echo ""
fi

# ==================== Summary ====================
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Icon generation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: npx cap sync"
echo "  2. iOS:     npx cap open ios"
echo "  3. Android: npx cap open android"
echo ""
