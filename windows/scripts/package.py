"""Build a portable Windows ZIP from the verified official Electron runtime.

Usage: python scripts/package.py /path/to/electron-win.zip /path/to/output
No signing, Windows-only build tools, or installation step is required.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ELECTRON_VERSION = "44.9.2"
APP_VERSION = json.loads((ROOT / "package.json").read_text())["version"]
ELECTRON_SHA256 = "1a9ed7f4e70291c95ed9479d7fcd384a2d9cf062e5fb7ce846b119c7c63036c3"

def build(runtime, output):
    checksum = hashlib.sha256(runtime.read_bytes()).hexdigest()
    if checksum != ELECTRON_SHA256:
        raise ValueError(f"Unexpected Electron ZIP checksum: {checksum}")
    stage = output / "build" / "KontoKlar"
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    with zipfile.ZipFile(runtime) as archive:
        for name in archive.namelist():
            if not (stage / name).resolve().is_relative_to(stage.resolve()):
                raise ValueError("Unsafe ZIP entry")
        archive.extractall(stage)
    (stage / "electron.exe").rename(stage / "KontoKlar.exe")
    default_app = stage / "resources" / "default_app.asar"
    default_app.unlink(missing_ok=True)
    app = stage / "resources" / "app"
    app.mkdir()
    shutil.copytree(ROOT / "src", app / "src")
    shutil.copy(ROOT / "main.cjs", app / "main.cjs")
    (app / "package.json").write_text(json.dumps({"name":"kontoklar","version":APP_VERSION,"main":"main.cjs","license":"MIT"}), encoding="utf-8")
    for name in ["README.md", "THIRD-PARTY-NOTICES.txt"]:
        shutil.copy(ROOT / name, stage / name)
    shutil.copy(ROOT / "LICENSE", stage / "Lizenz-KontoKlar.txt")
    shutil.copytree(ROOT / "demo", stage / "Beispiele")
    (stage / "HIER-STARTEN.txt").write_text(
        "KontoKlar starten\n\nDiesen ZIP-Ordner zuerst vollstaendig entpacken.\nDann KontoKlar.exe doppelklicken.\nKeine Installation und kein Internet erforderlich.\n\nAnleitung: README.md\nFiktive Testdokumente: Beispiele\n",encoding="utf-8")
    output.mkdir(parents=True,exist_ok=True)
    target = output / "KontoKlar-Windows-x64.zip"
    with zipfile.ZipFile(target,"w",zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for file in sorted(stage.rglob("*")):
            if file.is_file():
                archive.write(file, file.relative_to(stage.parent))
    source = output / "KontoKlar-Quellcode.zip"
    with zipfile.ZipFile(source,"w",zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for name in ["src","scripts","tests","demo","README.md","LICENSE","THIRD-PARTY-NOTICES.txt","main.cjs","package.json","package-lock.json",".gitignore"]:
            path=ROOT/name
            files=path.rglob("*") if path.is_dir() else [path]
            for file in files:
                if file.is_file() and "output" not in file.relative_to(ROOT).parts:
                    archive.write(file,Path("KontoKlar-Quellcode")/file.relative_to(ROOT))
    for file in [target, source]:
        print(f"{file}: {file.stat().st_size / 1024**2:.1f} MB",flush=True)
    (output/"SHA256.txt").write_text("\n".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}" for p in [target,source])+"\n")

if __name__ == "__main__":
    build(Path(sys.argv[1]),Path(sys.argv[2]))
