#!/bin/sh
set -e

echo "Starting environment variable replacement..."

# Look specifically for the KANEO_API_URL environment variable
if [ ! -z "$KANEO_API_URL" ]; then
  echo "Found KANEO_API_URL: $KANEO_API_URL"

  # First, replace the exact string "KANEO_API_URL" in all JavaScript files
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "KANEO_API_URL" {} \; | xargs -I{} sed -i "s|KANEO_API_URL|$KANEO_API_URL|g" {}

  # Also check for the escaped version which might appear in some files
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "\"KANEO_API_URL\"" {} \; | xargs -I{} sed -i "s|\"KANEO_API_URL\"|\"$KANEO_API_URL\"|g" {}

  echo "Replaced KANEO_API_URL with $KANEO_API_URL"
else
  echo "WARNING: KANEO_API_URL environment variable is not set. API calls may fail."
fi

# Process any other KANEO_ prefixed environment variables
for envvar in $(env | grep KANEO_ | grep -v KANEO_API_URL)
do
  key=$(echo $envvar | cut -d '=' -f 1)
  value=$(echo $envvar | cut -d '=' -f 2-)
  echo "Replacing $key with $value"

  find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.css" \) -exec sed -i "s|$key|$value|g" {} \;
done

echo "Environment variable replacement complete"
