#!/bin/bash

# iOS Icon Generator for Pillaxia
# Uses macOS sips to generate exact pixel sizes from source icon

set -e

SOURCE_ICON="public/app-icon.png"
ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"

# Check if source exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Source icon not found at $SOURCE_ICON"
    echo "   Please ensure you have a 1024x1024 app icon"
    exit 1
fi

# Check if iOS directory exists
if [ ! -d "ios/App/App/Assets.xcassets" ]; then
    echo "❌ iOS platform not found. Run 'npx cap add ios' first."
    exit 1
fi

echo "🎨 Generating iOS app icons from $SOURCE_ICON..."

mkdir -p "$ICON_DIR"

# Function to resize icon
resize_icon() {
    local size=$1
    local filename=$2
    echo "  Creating ${filename} (${size}x${size})..."
    cp "$SOURCE_ICON" "$ICON_DIR/$filename"
    sips -z $size $size "$ICON_DIR/$filename" --out "$ICON_DIR/$filename" > /dev/null 2>&1
}

# Generate all required iOS icon sizes
resize_icon 1024 "AppIcon-1024.png"
resize_icon 180 "AppIcon-60@3x.png"
resize_icon 167 "AppIcon-83.5@2x.png"
resize_icon 152 "AppIcon-76@2x.png"
resize_icon 120 "AppIcon-60@2x.png"
resize_icon 120 "AppIcon-40@3x.png"
resize_icon 87 "AppIcon-29@3x.png"
resize_icon 80 "AppIcon-40@2x.png"
resize_icon 80 "AppIcon-40@2x-ipad.png"
resize_icon 76 "AppIcon-76.png"
resize_icon 60 "AppIcon-20@3x.png"
resize_icon 58 "AppIcon-29@2x.png"
resize_icon 58 "AppIcon-29@2x-ipad.png"
resize_icon 40 "AppIcon-40.png"
resize_icon 40 "AppIcon-20@2x.png"
resize_icon 40 "AppIcon-20@2x-ipad.png"
resize_icon 29 "AppIcon-29.png"
resize_icon 20 "AppIcon-20.png"

# Create Contents.json
echo "  Creating Contents.json..."
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

echo ""
echo "✅ iOS icons generated successfully!"
echo ""
echo "Next steps:"
echo "  1. Run 'npx cap sync'"
echo "  2. Open Xcode: 'npx cap open ios'"
echo "  3. Build and upload to TestFlight"
