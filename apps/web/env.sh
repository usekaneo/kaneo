#!/bin/sh
set -eu

# Values are read through awk's ENVIRON, never interpolated into shell, sed,
# JavaScript, or nginx source. Do not print public or private environment values.
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
asset_source=/usr/share/nginx/html
asset_root=/var/lib/kaneo/html
export KANEO_ENV_RENDERER="$script_dir/env.awk"

# The image's assets stay immutable. A volume at /var/lib/kaneo also supports
# read-only root filesystems and OpenShift's arbitrary runtime UID.
mkdir -p "$asset_root" /var/lib/kaneo/nginx /var/lib/kaneo/tmp
cp -R "$asset_source/." "$asset_root/"
chmod -R u+rwX "$asset_root"

if [ -z "${KANEO_API_URL:-}" ]; then
  echo "WARNING: KANEO_API_URL is not set. API calls may fail." >&2
fi

# find -exec preserves spaces/newlines in filenames. Write each replacement
# beside its source before atomically replacing the complete file.
find "$asset_root" -type f -name '*.js' -exec sh -eu -c '
  for asset do
    temporary=$(mktemp "${asset}.XXXXXX")
    trap '\''rm -f "$temporary"'\'' EXIT HUP INT TERM
    LC_ALL=C awk -v mode=bundle -f "$KANEO_ENV_RENDERER" "$asset" > "$temporary"
    chmod 644 "$temporary"
    mv "$temporary" "$asset"
    trap - EXIT HUP INT TERM
  done
' sh {} +

# Serve JSON as static content. It must never become an nginx configuration
# string, where quotes, backslashes, and dollar signs have another meaning.
for mode in resource authorization; do
  target="$asset_root/mcp-oauth-$mode.json"
  temporary=$(mktemp "${target}.XXXXXX")
  trap 'rm -f "$temporary"' EXIT HUP INT TERM
  LC_ALL=C awk -v mode="$mode" -f "$KANEO_ENV_RENDERER" > "$temporary"
  chmod 644 "$temporary"
  mv "$temporary" "$target"
  trap - EXIT HUP INT TERM
done

echo "Public web configuration prepared."
