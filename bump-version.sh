#!/bin/bash

# Script pour incrémenter automatiquement la version
# Usage: ./bump-version.sh

VERSION_FILE="ui/js/app.js"
HTML_FILE="ui/index.html"

# Lire la version actuelle
CURRENT_VERSION=$(grep -o 'CURRENT_VERSION = "[0-9.]*"' $VERSION_FILE | grep -o '[0-9.]*')
echo "Version actuelle: $CURRENT_VERSION"

# Incrémenter la version (partie après le dernier point)
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR"

echo "Nouvelle version: $NEW_VERSION"

# Remplacer dans tous les fichiers
sed -i "s/CURRENT_VERSION = \"$CURRENT_VERSION\"/CURRENT_VERSION = \"$NEW_VERSION\"/" $VERSION_FILE
sed -i "s/v$CURRENT_VERSION/v$NEW_VERSION/g" $HTML_FILE
sed -i "s/?v=$CURRENT_VERSION/?v=$NEW_VERSION/g" $HTML_FILE

echo "✅ Version mise à jour vers $NEW_VERSION"
echo "📱 Le pad va automatiquement se mettre à jour"
