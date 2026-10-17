#!/bin/sh
set -eu

# nginx reads its server configuration from writable runtime storage so an
# arbitrary UID or a read-only root can still render nginx templates. Runs
# before nginx's template hook, which may replace these copies by file name.
runtime=/var/lib/kaneo
mkdir -p "$runtime/html" "$runtime/nginx/conf.d" "$runtime/tmp"
find "$runtime/nginx/conf.d" -mindepth 1 -delete
cp -R /etc/nginx/conf.d/. "$runtime/nginx/conf.d/"
chmod -R u+rwX "$runtime/nginx/conf.d"
