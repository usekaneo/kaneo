#!/bin/sh

# One-shot CLI commands skip the runtime startup scripts that prepare TMPDIR.
if [ -n "${TMPDIR:-}" ] && { [ ! -d "$TMPDIR" ] || [ ! -w "$TMPDIR" ]; }; then
  export TMPDIR=/tmp
fi

exec node /app/packages/cli/dist/kaneo.mjs "$@"
