#!/bin/sh
set -e

# Runtime public env for the SPA (avoids relying on sed inside hashed bundles).
# Values are base64 so shell metacharacters in URLs cannot break the script.
write_runtime_config_js() {
  CONFIG_PATH="/usr/share/nginx/html/env-config.js"
  parts=""
  if [ -n "$KANEO_API_URL" ]; then
    b64=$(printf '%s' "$KANEO_API_URL" | base64 | tr -d '\n')
    parts="VITE_API_URL:atob(\"${b64}\")"
  fi
  if [ -n "$KANEO_CLIENT_URL" ]; then
    b64=$(printf '%s' "$KANEO_CLIENT_URL" | base64 | tr -d '\n')
    if [ -n "$parts" ]; then
      parts="${parts},"
    fi
    parts="${parts}VITE_CLIENT_URL:atob(\"${b64}\")"
  fi
  printf '%s\n' "window.__KANEO_RUNTIME_CONFIG__={${parts}};" > "$CONFIG_PATH"
}

write_runtime_config_js

echo "Starting environment variable replacement..."

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

# Process KANEO_CLIENT_URL efficiently
if [ ! -z "$KANEO_CLIENT_URL" ]; then
  echo "Found KANEO_CLIENT_URL: $KANEO_CLIENT_URL"
  
  # Only process files that actually contain the string
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "KANEO_CLIENT_URL" {} \; | xargs -r sed -i "s#KANEO_CLIENT_URL#$KANEO_CLIENT_URL#g"
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "\"KANEO_CLIENT_URL\"" {} \; | xargs -r sed -i "s#\"KANEO_CLIENT_URL\"#\"$KANEO_CLIENT_URL\"#g"
  
  echo "✅ Replaced KANEO_CLIENT_URL with $KANEO_CLIENT_URL"
fi

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

echo "✅ Environment variable replacement complete"
