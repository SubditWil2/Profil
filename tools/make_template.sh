#!/bin/bash
# Rakit ulang Template_Profil_Kegiatan.pptx dari deck contoh. Pemakaian: ./make_template.sh contoh.pptx keluaran.pptx
set -e
SRC="$1"; OUT="$2"; W=$(mktemp -d)
python3 -c "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$SRC" "$W/pkg"
python3 "$(dirname "$0")/prepare_package.py" "$W/pkg"
python3 /mnt/skills/public/pptx/scripts/clean.py "$W/pkg/"
python3 "$(dirname "$0")/build_template.py" "$W/pkg"
python3 /mnt/skills/public/pptx/scripts/clean.py "$W/pkg/"
rm -f "$OUT"; (cd "$W/pkg" && zip -Xqr "$OUT" .)
echo "Selesai: $OUT"
