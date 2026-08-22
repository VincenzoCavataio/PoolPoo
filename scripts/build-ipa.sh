#!/usr/bin/env bash
# Builds an unsigned .ipa for sideloading (AltStore / Sideloadly re-sign it themselves).
#
# One-time setup this script assumes:
#   - Node 24 available through nvm
#   - CocoaPods installed into ios/vendor/bundle via `bundle install` (see ios/Gemfile)
#   - `npx expo prebuild -p ios` has generated the ios/ project
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEME="AfterHours"
BUILD_DIR="$ROOT/ios/build"
ARCHIVE="$BUILD_DIR/$SCHEME.xcarchive"

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 24 >/dev/null
export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"
export BUNDLE_GEMFILE="$ROOT/ios/Gemfile"

echo "==> pod install"
(cd "$ROOT/ios" && bundle exec pod install)

echo "==> archive (unsigned)"
rm -rf "$ARCHIVE"
mkdir -p "$BUILD_DIR"
xcodebuild \
  -workspace "$ROOT/ios/$SCHEME.xcworkspace" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  archive

echo "==> packaging .ipa"
rm -rf "$BUILD_DIR/Payload" "$BUILD_DIR/$SCHEME.ipa"
mkdir -p "$BUILD_DIR/Payload"
cp -R "$ARCHIVE/Products/Applications/$SCHEME.app" "$BUILD_DIR/Payload/"
(cd "$BUILD_DIR" && zip -qry "$SCHEME.ipa" Payload && rm -rf Payload)

echo "==> done: $BUILD_DIR/$SCHEME.ipa"
