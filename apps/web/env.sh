#!/bin/sh
set -e

echo "Replacing environment variables in static files..."

# Process only KANEO_ prefixed environment variables
for i in $(env | grep KANEO_)
do
    key=$(echo $i | cut -d '=' -f 1)
    value=$(echo $i | cut -d '=' -f 2-)
    echo $key=$value

    find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.css' \) -exec sed -i "s|${key}|${value}|g" '{}' +
done

echo "Environment variable replacement complete"
