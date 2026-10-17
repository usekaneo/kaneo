#!/bin/sh
set -eu

# Values are read through awk's ENVIRON, never interpolated into shell, sed,
# JavaScript, or nginx source. Do not print public or private environment values.
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
asset_source=/usr/share/kaneo/html
asset_root=/var/lib/kaneo/html
export KANEO_ENV_RENDERER="$script_dir/env.awk"

# The image's assets stay immutable. A volume at /var/lib/kaneo also supports
# read-only root filesystems and OpenShift's arbitrary runtime UID.
mkdir -p "$asset_root" /var/lib/kaneo/nginx /var/lib/kaneo/tmp

if [ -z "${KANEO_API_URL:-}" ]; then
  echo "WARNING: KANEO_API_URL is not set. API calls may fail." >&2
fi

# /usr/share/nginx/html links here, so files mounted there for older images
# land in this directory. Unlinking a mount point fails, and -xdev keeps find
# out of mounted directories, so cleanup removes only the previous copies.
find /var/lib/kaneo -xdev -path "$asset_root/*" -delete 2>/dev/null || true

# Copy the build file by file, skipping paths that survived as mounts so they
# are never overwritten. find -exec preserves spaces/newlines in filenames.
find "$asset_source" -mindepth 1 -exec sh -eu -c '
  asset_source=$1
  shift
  for asset do
    target="$0${asset#"$asset_source"}"
    if [ -d "$asset" ]; then
      mkdir -p "$target"
    elif [ ! -e "$target" ] && [ ! -L "$target" ]; then
      case "$asset" in
        *.js) LC_ALL=C awk -v mode=bundle -f "$KANEO_ENV_RENDERER" "$asset" > "$target" ;;
        *) cp "$asset" "$target" ;;
      esac
      chmod 644 "$target"
    fi
  done
' "$asset_root" "$asset_source" {} +

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
