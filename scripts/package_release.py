"""Build the portable release with Python stdlib + Node.js; no dependencies."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", VERSION):
    raise SystemExit("VERSION deve conter uma versão, por exemplo 1.0.0")

subprocess.run(["node", "build.cjs"], cwd=ROOT, check=True)
OUTPUT = ROOT / "release"
OUTPUT.mkdir(exist_ok=True)

app = (ROOT / "Entrequadros.html").read_text(encoding="utf-8")
app = app.replace("<head>", '<head>\n<meta name="application-name" content="FrameCut">\n'
                  f'<meta name="application-version" content="{VERSION}">', 1)
(OUTPUT / "FrameCut.html").write_text(app, encoding="utf-8", newline="\n")
for name in ["COMO-USAR.html", "COMO-USAR.txt"]:
    (OUTPUT / name).write_bytes((ROOT / "docs" / name).read_bytes())

names = ["FrameCut.html", "COMO-USAR.html", "COMO-USAR.txt"]
# Fixed entry timestamps make repeat builds reproducible for identical sources.
with zipfile.ZipFile(OUTPUT / "FrameCut-portatil.zip", "w", compression=zipfile.ZIP_DEFLATED,
                     compresslevel=9) as archive:
    for name in names:
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (OUTPUT / name).read_bytes(), compresslevel=9)

assets = ["FrameCut.html", "FrameCut-portatil.zip", "COMO-USAR.html"]
checksums = [f"{hashlib.sha256((OUTPUT / name).read_bytes()).hexdigest()}  {name}" for name in assets]
(OUTPUT / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n", encoding="utf-8", newline="\n")

with zipfile.ZipFile(OUTPUT / "FrameCut-portatil.zip") as archive:
    assert archive.testzip() is None
    assert archive.namelist() == names
    for name in names:
        assert archive.read(name) == (OUTPUT / name).read_bytes()

print(json.dumps({"version": VERSION, "assets": [
    {"name": name, "bytes": (OUTPUT / name).stat().st_size}
    for name in assets + ["SHA256SUMS.txt"]
]}, ensure_ascii=False))
