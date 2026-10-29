#!/usr/bin/env bash
# Scan the sites, merge, and upload to Supabase. Used by the daily GitHub Action and by hand.
#   bash scanner/run.sh             scan + upload (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
#   bash scanner/run.sh --dry-run   scan only, print a sample, change nothing
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
cd out
python3 ../scan_as24.py as24_v2.json
python3 ../scan_autohero.py autohero.json
python3 ../scan_cardoen.py cardoen.json
python3 ../merge.py > merge.log
tail -3 merge.log
python3 ../upload.py "$@"
