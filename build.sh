#!/usr/bin/env bash
# Build the G3 single binary: static-export the frontend, embed it, compile Go.
set -euo pipefail

DIST="server/internal/httpd/dist"
OUT="g3.exe"

echo "[build] frontend static export"
npm run build

echo "[build] sync out/ -> $DIST"
rm -rf "$DIST"
mkdir -p "$DIST"
cp -r out/. "$DIST/"
touch "$DIST/.gitkeep" # keep the tracked placeholder present

echo "[build] go build -> $OUT"
go -C server build -o "../$OUT" ./cmd/g3

echo "[build] done -> ./$OUT"
