#!/bin/bash
# Validasi semua .pptx di sebuah folder (skill pptx: validate.py) dan cari sisa tag.
# Pemakaian: tests/check_outputs.sh <folder_out> <template.pptx>
for f in "$1"/*.pptx; do
  r=$(python3 /mnt/skills/public/pptx/scripts/office/validate.py "$f" --original "$2" 2>&1 | tail -1)
  left=$(markitdown "$f" 2>/dev/null | grep -cE '\{[@A-Za-z_][^ ]*\}')
  echo "$(basename "$f") | $r | sisa-tag: $left"
done
