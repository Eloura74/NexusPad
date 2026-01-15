#!/bin/bash

# Script pour incrémenter automatiquement la version + sync multi-device
# Usage: ./bump-version.sh

VERSION_FILE="ui/js/app.js"
HTML_FILE="ui/index.html"
HTML_PRO_FILE="ui/index-pro.html"
VERSION_JSON="ui/version.json"

# Lire la version actuelle
CURRENT_VERSION=$(grep -o 'CURRENT_VERSION = "[0-9.]*"' $VERSION_FILE | grep -o '[0-9.]*')
echo "🔍 Version actuelle: $CURRENT_VERSION"

# Incrémenter la version (partie après le dernier point)
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR"

echo "🚀 Nouvelle version: $NEW_VERSION"

# Timestamp Unix actuel
TIMESTAMP=$(date +%s)

# Remplacer dans tous les fichiers
sed -i "s/CURRENT_VERSION = \"$CURRENT_VERSION\"/CURRENT_VERSION = \"$NEW_VERSION\"/" $VERSION_FILE
sed -i "s/v$CURRENT_VERSION/v$NEW_VERSION/g" $HTML_FILE
sed -i "s/?v=$CURRENT_VERSION/?v=$NEW_VERSION/g" $HTML_FILE

# Mettre à jour le fichier HTML Pro si il existe
if [ -f "$HTML_PRO_FILE" ]; then
  sed -i "s/v[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" $HTML_PRO_FILE
  sed -i "s/?v=[0-9]\+\.[0-9]\+/?v=$NEW_VERSION/g" $HTML_PRO_FILE
  echo "📱 HTML Pro mis à jour"
fi

# Mettre à jour version.json pour sync automatique
if [ -f "$VERSION_JSON" ]; then
  sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" $VERSION_JSON
  sed -i "s/\"timestamp\": [0-9]*/\"timestamp\": $TIMESTAMP/" $VERSION_JSON
  echo "🔄 version.json mis à jour"
fi

echo "✅ Version mise à jour vers $NEW_VERSION"
echo "📱 Tous les pads vont se synchroniser automatiquement"
echo "🕒 Timestamp: $TIMESTAMP"
echo "📱 Le pad va automatiquement se mettre à jour"
