#!/bin/sh
set -e

echo "Starting environment variable replacement..."

# Process KANEO_API_URL first (with special handling)
if [ ! -z "$KANEO_API_URL" ]; then
  echo "Found KANEO_API_URL: $KANEO_API_URL"
  
  # First, replace the exact string "KANEO_API_URL" in all JavaScript files
  # Use grep -l to only process files that contain the string
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "KANEO_API_URL" {} \; | xargs -r sed -i "s#KANEO_API_URL#$KANEO_API_URL#g"
  
  # Also check for the escaped version which might appear in some files
  find /usr/share/nginx/html -type f -name "*.js" -exec grep -l "\"KANEO_API_URL\"" {} \; | xargs -r sed -i "s#\"KANEO_API_URL\"#\"$KANEO_API_URL\"#g"
  
  echo "✅ Replaced KANEO_API_URL with $KANEO_API_URL"
else
  echo "WARNING: KANEO_API_URL environment variable is not set. API calls may fail."
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
