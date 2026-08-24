#!/bin/sh
set -e

echo "Starting environment variable replacement..."

# Inject only a URL origin into nginx configuration. This deliberately rejects
# paths, credentials, queries, fragments, and config syntax before substitution.
metadata_config=/etc/nginx/conf.d/00-share-metadata.conf
metadata_origin=""
client_url_trimmed=$(printf '%s' "${KANEO_CLIENT_URL:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s#/*$##')
client_url_single_line=$(printf '%s' "$client_url_trimmed" | tr -d '\r\n')
if [ -n "$client_url_trimmed" ]; then
  if [ "$client_url_trimmed" = "$client_url_single_line" ] && \
    printf '%s' "$client_url_trimmed" | grep -Eq '^https?://(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(:[0-9]{1,5})?$'; then
    metadata_origin=$client_url_trimmed
  else
    echo "WARNING: KANEO_CLIENT_URL is not a valid HTTP(S) origin. Share metadata will use the request host."
  fi
fi

# The allowlist above excludes sed/nginx metacharacters other than ':' and '/'.
sed -i "s#__KANEO_CLIENT_ORIGIN__#$metadata_origin#g" "$metadata_config"

replace_client_url_placeholders() {
  replacement=$1
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "KANEO_CLIENT_URL" {} \; |
    xargs -r sed -i "s#KANEO_CLIENT_URL#$replacement#g"
}

# Process KANEO_API_URL first (with special handling)
if [ ! -z "$KANEO_API_URL" ]; then
  echo "Found KANEO_API_URL: $KANEO_API_URL"

  # First, replace the exact string "KANEO_API_URL" in all JavaScript files
  # Use grep -l to only process files that contain the string
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "KANEO_API_URL" {} \; | xargs -r sed -i "s#KANEO_API_URL#$KANEO_API_URL#g"

  # Also check for the escaped version which might appear in some files
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "\"KANEO_API_URL\"" {} \; | xargs -r sed -i "s#\"KANEO_API_URL\"#\"$KANEO_API_URL\"#g"

  # Build MCP OAuth discovery JSON for nginx to serve at /.well-known
  BASE_URL=$(echo "$KANEO_API_URL" | sed 's#/api/*$##')
  PRM_JSON="{\"resource\":\"${BASE_URL}/api/mcp\",\"authorization_servers\":[\"${BASE_URL}/api\"]}"
  AS_JSON="{\"issuer\":\"${BASE_URL}/api\",\"authorization_endpoint\":\"${BASE_URL}/api/mcp/authorize\",\"token_endpoint\":\"${BASE_URL}/api/mcp/token\",\"registration_endpoint\":\"${BASE_URL}/api/mcp/register\",\"response_types_supported\":[\"code\"],\"grant_types_supported\":[\"authorization_code\"],\"code_challenge_methods_supported\":[\"S256\"],\"token_endpoint_auth_methods_supported\":[\"none\"]}"
  sed -i "s#MCP_PRM_JSON_PLACEHOLDER#$PRM_JSON#g" /etc/nginx/conf.d/default.conf
  sed -i "s#MCP_AS_JSON_PLACEHOLDER#$AS_JSON#g" /etc/nginx/conf.d/default.conf

  echo "✅ Replaced KANEO_API_URL with $KANEO_API_URL"
else
  echo "WARNING: KANEO_API_URL environment variable is not set. API calls may fail."
  # No API URL — remove MCP placeholders so nginx doesn't serve broken JSON
  sed -i "s#MCP_PRM_JSON_PLACEHOLDER#{}#g" /etc/nginx/conf.d/default.conf
  sed -i "s#MCP_AS_JSON_PLACEHOLDER#{}#g" /etc/nginx/conf.d/default.conf
fi

# Process KANEO_CLIENT_URL efficiently. Reuse the validated origin so a
# malformed value cannot become sed input or JavaScript source. Always remove
# the build-time placeholder: an empty replacement makes the browser use its
# current origin instead of treating KANEO_CLIENT_URL as a real hostname.
if [ -n "$metadata_origin" ]; then
  echo "Found KANEO_CLIENT_URL: $metadata_origin"
  echo "✅ Replaced KANEO_CLIENT_URL with $metadata_origin"
fi
replace_client_url_placeholders "$metadata_origin"

# Process any other KANEO_ prefixed environment variables (for future extensibility)
# Exclude the ones we've already processed
for key in $(env | grep '^KANEO_' | grep -v 'KANEO_API_URL\|KANEO_CLIENT_URL' | cut -d= -f1); do
  value=$(printenv "$key")
  
  if [ ! -z "$value" ]; then
    echo "Found $key: $value"
    
    # Only process files that contain this specific key
    find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.css" \) -exec grep -l "$key" {} \; | xargs -r sed -i "s#$key#$value#g"
    
    echo "✅ Replaced $key with $value"
  fi
done

# Empty the quoted Turnstile placeholder when its env var was left unset.
# Without this, the literal placeholder stays in the bundle and is read by
# the frontend as a truthy string — which broke self-hosted signup when
# KANEO_TURNSTILE_SITE_KEY was left unset (issue #1304).
echo "Stripping unset KANEO_* placeholders..."
find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.css" \) \
  -exec sed -i -E 's#[`"'"'"']KANEO_TURNSTILE_SITE_KEY[`"'"'"']#""#g' {} +

echo "✅ Environment variable replacement complete"
