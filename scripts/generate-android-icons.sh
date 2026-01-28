#!/bin/bash

# Android Icon Generator for Pillaxia
# Uses macOS sips to generate exact pixel sizes from source icon

set -e

SOURCE_ICON="public/app-icon.png"
RES_DIR="android/app/src/main/res"

# Check if source exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Source icon not found at $SOURCE_ICON"
    echo "   Please ensure you have a 1024x1024 app icon"
    exit 1
fi

# Check if Android directory exists
if [ ! -d "$RES_DIR" ]; then
    echo "❌ Android platform not found. Run 'npx cap add android' first."
    exit 1
fi

echo "🤖 Generating Android app icons from $SOURCE_ICON..."

# Create mipmap directories
mkdir -p "$RES_DIR/mipmap-mdpi"
mkdir -p "$RES_DIR/mipmap-hdpi"
mkdir -p "$RES_DIR/mipmap-xhdpi"
mkdir -p "$RES_DIR/mipmap-xxhdpi"
mkdir -p "$RES_DIR/mipmap-xxxhdpi"
mkdir -p "$RES_DIR/mipmap-anydpi-v26"

# Function to resize icon
resize_icon() {
    local size=$1
    local dest=$2
    echo "  Creating ${dest} (${size}x${size})..."
    cp "$SOURCE_ICON" "$dest"
    sips -z $size $size "$dest" --out "$dest" > /dev/null 2>&1
}

# Generate launcher icons for each density
# mdpi: 48x48
# hdpi: 72x72
# xhdpi: 96x96
# xxhdpi: 144x144
# xxxhdpi: 192x192

echo "📱 Generating launcher icons..."
resize_icon 48 "$RES_DIR/mipmap-mdpi/ic_launcher.png"
resize_icon 72 "$RES_DIR/mipmap-hdpi/ic_launcher.png"
resize_icon 96 "$RES_DIR/mipmap-xhdpi/ic_launcher.png"
resize_icon 144 "$RES_DIR/mipmap-xxhdpi/ic_launcher.png"
resize_icon 192 "$RES_DIR/mipmap-xxxhdpi/ic_launcher.png"

# Generate round launcher icons
echo "🔵 Generating round launcher icons..."
resize_icon 48 "$RES_DIR/mipmap-mdpi/ic_launcher_round.png"
resize_icon 72 "$RES_DIR/mipmap-hdpi/ic_launcher_round.png"
resize_icon 96 "$RES_DIR/mipmap-xhdpi/ic_launcher_round.png"
resize_icon 144 "$RES_DIR/mipmap-xxhdpi/ic_launcher_round.png"
resize_icon 192 "$RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png"

# Generate adaptive icon foreground (108dp with 72dp safe zone)
# Foreground should be 432x432 for xxxhdpi (108 * 4)
echo "🎨 Generating adaptive icon layers..."
resize_icon 108 "$RES_DIR/mipmap-mdpi/ic_launcher_foreground.png"
resize_icon 162 "$RES_DIR/mipmap-hdpi/ic_launcher_foreground.png"
resize_icon 216 "$RES_DIR/mipmap-xhdpi/ic_launcher_foreground.png"
resize_icon 324 "$RES_DIR/mipmap-xxhdpi/ic_launcher_foreground.png"
resize_icon 432 "$RES_DIR/mipmap-xxxhdpi/ic_launcher_foreground.png"

# Create solid background color drawable
echo "  Creating adaptive icon background..."
cat > "$RES_DIR/values/ic_launcher_background.xml" 2>/dev/null << 'EOF' || true
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1a1f4e</color>
</resources>
EOF

# Create adaptive icon XML
echo "  Creating adaptive icon XML..."
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

# Generate splash screen icons
echo "💦 Generating splash screen icons..."
mkdir -p "$RES_DIR/drawable"
mkdir -p "$RES_DIR/drawable-mdpi"
mkdir -p "$RES_DIR/drawable-hdpi"
mkdir -p "$RES_DIR/drawable-xhdpi"
mkdir -p "$RES_DIR/drawable-xxhdpi"
mkdir -p "$RES_DIR/drawable-xxxhdpi"

# Splash icons (centered logo, typically larger)
resize_icon 128 "$RES_DIR/drawable-mdpi/splash.png"
resize_icon 192 "$RES_DIR/drawable-hdpi/splash.png"
resize_icon 256 "$RES_DIR/drawable-xhdpi/splash.png"
resize_icon 384 "$RES_DIR/drawable-xxhdpi/splash.png"
resize_icon 512 "$RES_DIR/drawable-xxxhdpi/splash.png"
resize_icon 384 "$RES_DIR/drawable/splash.png"

echo ""
echo "✅ Android icons generated successfully!"
echo ""
echo "Generated assets:"
echo "  • Launcher icons (mdpi through xxxhdpi)"
echo "  • Round launcher icons"
echo "  • Adaptive icon foreground layers"
echo "  • Adaptive icon background color"
echo "  • Splash screen icons"
echo ""
echo "Next steps:"
echo "  1. Run 'npx cap sync'"
echo "  2. Open Android Studio: 'npx cap open android'"
echo "  3. Build and test"
