#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_TOOLS_DIR="${ANDROID_TOOLS_DIR:-$PROJECT_DIR/../.android-tools}"
ANDROID_PLATFORM_DIR="$ANDROID_TOOLS_DIR/android-35"
ANDROID_BUILD_DIR="$ANDROID_TOOLS_DIR/android-15"
KONTOKLAR_VERSION="$(python - "$PROJECT_DIR/app/src/main/AndroidManifest.xml" <<'PY'
import sys,xml.etree.ElementTree as E
print(E.parse(sys.argv[1]).getroot().attrib['{http://schemas.android.com/apk/res/android}versionName'])
PY
)"
python "$PROJECT_DIR/scripts/sync_assets.py"
mkdir -p "$PROJECT_DIR/build/classes" "$PROJECT_DIR/build/dex" "$PROJECT_DIR/signing"
java -jar "$ANDROID_TOOLS_DIR/ecj.jar" -1.8 -nowarn -bootclasspath "$ANDROID_PLATFORM_DIR/android.jar:$ANDROID_BUILD_DIR/core-lambda-stubs.jar" -classpath "$ANDROID_PLATFORM_DIR/android.jar" -d "$PROJECT_DIR/build/classes" "$PROJECT_DIR/app/src/main/java/de/kontoklar/app/MainActivity.java"
java -cp "$ANDROID_BUILD_DIR/lib/d8.jar" com.android.tools.r8.D8 --lib "$ANDROID_PLATFORM_DIR/android.jar" --min-api 29 --output "$PROJECT_DIR/build/dex" "$PROJECT_DIR/build/classes/de/kontoklar/app/"*.class
"$ANDROID_BUILD_DIR/aapt2" compile --dir "$PROJECT_DIR/app/src/main/res" -o "$PROJECT_DIR/build/resources.zip"
"$ANDROID_BUILD_DIR/aapt2" link -I "$ANDROID_PLATFORM_DIR/android.jar" --manifest "$PROJECT_DIR/app/src/main/AndroidManifest.xml" -A "$PROJECT_DIR/app/src/main/assets" -R "$PROJECT_DIR/build/resources.zip" -o "$PROJECT_DIR/build/unsigned.apk"
python - "$PROJECT_DIR/build" <<'PY'
from pathlib import Path
import sys,zipfile
p=Path(sys.argv[1])
with zipfile.ZipFile(p/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:z.write(p/'dex/classes.dex','classes.dex')
PY
"$ANDROID_BUILD_DIR/zipalign" -p -f 4 "$PROJECT_DIR/build/unsigned.apk" "$PROJECT_DIR/build/aligned.apk"
if [ ! -f "$PROJECT_DIR/signing/release.jks" ]; then
  python - "$PROJECT_DIR/signing/password.txt" <<'PY'
from pathlib import Path
import sys,secrets,os
p=Path(sys.argv[1]);p.write_text(secrets.token_urlsafe(32));os.chmod(p,0o600)
PY
  keytool -genkeypair -keystore "$PROJECT_DIR/signing/release.jks" -storetype JKS -alias kontoklar -keyalg RSA -keysize 3072 -validity 10000 -storepass:file "$PROJECT_DIR/signing/password.txt" -keypass:file "$PROJECT_DIR/signing/password.txt" -dname "CN=KontoKlar Android, O=KontoKlar, C=DE"
fi
"$ANDROID_BUILD_DIR/apksigner" sign --ks "$PROJECT_DIR/signing/release.jks" --ks-key-alias kontoklar --ks-pass "file:$PROJECT_DIR/signing/password.txt" --out "$PROJECT_DIR/build/KontoKlar-Android-v$KONTOKLAR_VERSION.apk" "$PROJECT_DIR/build/aligned.apk"
"$ANDROID_BUILD_DIR/apksigner" verify --verbose "$PROJECT_DIR/build/KontoKlar-Android-v$KONTOKLAR_VERSION.apk"
echo "APK ready: $PROJECT_DIR/build/KontoKlar-Android-v$KONTOKLAR_VERSION.apk"
