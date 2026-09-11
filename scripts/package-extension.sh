#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest_path="$project_dir/manifest.json"

version="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (!/^\d+\.\d+\.\d+$/.test(m.version)) process.exit(1); process.stdout.write(m.version);' "$manifest_path")"
output_path="${1:-$project_dir/dist/image-collector-$version.zip}"
output_dir="$(dirname "$output_path")"

required_files=(
  manifest.json
  popup.html
  popup.css
  popup.js
  library.js
  service-worker.js
  icons/icon-16.png
  icons/icon-32.png
  icons/icon-48.png
  icons/icon-128.png
)

for file in "${required_files[@]}"; do
  [[ -f "$project_dir/$file" ]] || { echo "Missing extension file: $file" >&2; exit 1; }
done

node --check "$project_dir/popup.js"
node --check "$project_dir/library.js"
node --check "$project_dir/service-worker.js"

mkdir -p "$output_dir"
rm -f "$output_path"
(
  cd "$project_dir"
  zip -q -r "$output_path" "${required_files[@]}"
)

echo "Created $output_path"
unzip -tq "$output_path"
