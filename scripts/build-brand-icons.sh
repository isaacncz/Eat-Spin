#!/usr/bin/env bash
# Rebuild shipping icon sizes from the approved Pizza Pick master artwork.
# Requires ImageMagick; no image-generation or network access during builds.
set -eu
cd "$(dirname "$0")/.."
master=assets/brand/eatspin-pizza-pick-master.png
mkdir -p public/brand
convert "$master" -resize 512x512 -strip public/brand/eatspin-mark.png
for size in 192 512; do
  mark_size=$((size * 15 / 16))
  convert "$master" -resize "${mark_size}x${mark_size}" -gravity center \
    -background '#FFD93D' -extent "${size}x${size}" -strip "public/android-chrome-${size}x${size}.png"
done
convert public/android-chrome-512x512.png -resize 180x180 -strip public/apple-touch-icon.png
for size in 16 32; do
  convert public/brand/eatspin-mark.png -resize "${size}x${size}" -strip "public/favicon-${size}x${size}.png"
done
convert public/brand/eatspin-mark.png -define icon:auto-resize=64,48,32,16 public/favicon.ico
# Retain the legacy asset directory with matching artwork for existing imports.
for icon in android-chrome-192x192.png android-chrome-512x512.png apple-touch-icon.png favicon-16x16.png favicon-32x32.png favicon.ico; do
  cp "public/$icon" "src/components/favicon/$icon"
done
