#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_TOOLS_DIR="${ANDROID_TOOLS_DIR:-$PROJECT_DIR/../.android-tools}"
PLATFORM="$ANDROID_TOOLS_DIR/android-35"
TOOLS="$ANDROID_TOOLS_DIR/android-15"
mkdir -p "$PROJECT_DIR/build/testclasses" "$PROJECT_DIR/build/testdex" "$PROJECT_DIR/build/testassets"
cp "$PROJECT_DIR/demo/Beispiel-Kontoauszug.png" "$PROJECT_DIR/build/testassets/"
java -jar "$ANDROID_TOOLS_DIR/ecj.jar" -1.8 -nowarn -bootclasspath "$PLATFORM/android.jar:$TOOLS/core-lambda-stubs.jar" -classpath "$PLATFORM/android.jar:$PROJECT_DIR/build/classes" -d "$PROJECT_DIR/build/testclasses" "$PROJECT_DIR/tests/android/"*.java
java -cp "$TOOLS/lib/d8.jar" com.android.tools.r8.D8 --lib "$PLATFORM/android.jar" --min-api 29 --output "$PROJECT_DIR/build/testdex" "$PROJECT_DIR/build/testclasses/de/kontoklar/app/"*.class
"$TOOLS/aapt2" link -I "$PLATFORM/android.jar" --manifest "$PROJECT_DIR/tests/android/AndroidManifest.xml" -A "$PROJECT_DIR/build/testassets" -o "$PROJECT_DIR/build/test-unsigned.apk"
python - "$PROJECT_DIR/build" <<'PY'
from pathlib import Path
import zipfile,sys
p=Path(sys.argv[1])
with zipfile.ZipFile(p/'test-unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:z.write(p/'testdex/classes.dex','classes.dex')
PY
"$TOOLS/zipalign" -p -f 4 "$PROJECT_DIR/build/test-unsigned.apk" "$PROJECT_DIR/build/test-aligned.apk"
"$TOOLS/apksigner" sign --ks "$PROJECT_DIR/signing/release.jks" --ks-key-alias kontoklar --ks-pass "file:$PROJECT_DIR/signing/password.txt" --out "$PROJECT_DIR/build/KontoKlar-tests.apk" "$PROJECT_DIR/build/test-aligned.apk"
echo 'Run: adb install -r build/KontoKlar-tests.apk && adb shell am instrument -w de.kontoklar.app.test/de.kontoklar.app.SmokeTest'
