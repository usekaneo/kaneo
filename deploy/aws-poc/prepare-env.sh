#!/bin/bash
# Prepare .env for AWS POC from a local .env (secrets preserved; URLs rewritten).
# Usage: ./prepare-env.sh /path/to/local.env /path/to/out.env [PUBLIC_BASE_URL]
set -euo pipefail
SRC="${1:?local .env path}"
DEST="${2:?output .env path}"
PUBLIC_BASE="${3:-http://appelsetasks.elsesystems.com}"

cp "$SRC" "$DEST"
# Rewrite public URLs for the POC host (do not touch secrets).
perl -i -pe "s#^(APP_URL)=.*#\$1=${PUBLIC_BASE}#g" "$DEST"
perl -i -pe "s#^(KANEO_CLIENT_URL)=.*#\$1=${PUBLIC_BASE}#g" "$DEST"
perl -i -pe "s#^(PUBLIC_APP_URL)=.*#\$1=${PUBLIC_BASE}#g" "$DEST"
perl -i -pe "s#^(KANEO_API_URL)=.*#\$1=${PUBLIC_BASE}/api#g" "$DEST"
if ! grep -q "^KANEO_API_URL=" "$DEST"; then
  echo "KANEO_API_URL=${PUBLIC_BASE}/api" >> "$DEST"
fi
perl -i -pe "s#^(CORS_ORIGINS)=.*#\$1=${PUBLIC_BASE}#g" "$DEST"
if ! grep -q "^CORS_ORIGINS=" "$DEST"; then
  echo "CORS_ORIGINS=${PUBLIC_BASE}" >> "$DEST"
fi
# Keep DocuSeal on Docker internal network
perl -i -pe 's#^(DOCUSEAL_URL)=.*#$1=http://docuseal:3000#g' "$DEST"
perl -i -pe 's#^(DOCUSEAL_WEBHOOK_URL)=.*#$1=http://elsetasks:5173/api/docuseal/webhook#g' "$DEST"
# Cal.com not deployed on this POC — clear local tunnel URLs if present
perl -i -pe 's#^(CALCOM_BASE_URL)=http://localhost:.*#$1=#g' "$DEST"
perl -i -pe 's#^(CALCOM_API_BASE_URL)=http://host\.docker\.internal:.*#$1=#g' "$DEST"
echo "Wrote $DEST (public base: $PUBLIC_BASE)"
