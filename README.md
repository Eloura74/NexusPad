# 🎮 NexusPad v1.0

> **Transformez votre smartphone ou tablette en Stream Deck professionnel gratuit**

[![Version](https://img.shields.io/badge/Version-1.0-brightgreen.svg)](https://github.com/coder/nexuspad)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Web-orange.svg)]()
[![Touch](https://img.shields.io/badge/Touch-Optimized-purple.svg)]()

---

## 🤔 C'est quoi NexusPad ?

**NexusPad** est une solution logicielle open-source qui remplace un **Elgato Stream Deck** physique. 

Au lieu d'acheter un boîtier coûteux (150€+), NexusPad vous permet d'utiliser **n'importe quel écran tactile** (vieux smartphone Android, iPad, tablette, ou même un second écran tactile) comme surface de contrôle pour votre PC.

### Pourquoi utiliser NexusPad ?
- 💸 **100% Gratuit & Open Source** : Pas de matériel propriétaire à acheter.
- 📱 **Recyclage Malin** : Donnez une seconde vie à vos vieux appareils.
- ⚡ **Sans Fil** : Fonctionne via le réseau Wi-Fi local.
- 🎨 **Design Premium** : Interface moderne style "Glassmorphism" avec animations fluides.
- 🔄 **Synchronisation Totale** : Modifiez un bouton sur votre PC, il change instantanément sur votre tablette.

---

## 🌟 Aperçu

**NexusPad** est une interface web moderne et tactile qui transforme n'importe quel écran en macropad professionnel. Conçu pour les streamers, développeurs et créateurs de contenu, il offre une expérience fluide avec synchronisation automatique multi-appareils.

### ✨ Fonctionnalités Principales

| 🎨 **Interface** | 🔄 **Synchronisation** | 🎮 **Contrôles** |
|---|---|---|
| Design glassmorphisme | Auto-sync temps réel | Raccourcis clavier |
| Animation fluide | Version bumping automatique | Lancement d'applications |
| Drag & drop tactile | Multi-device support | Commandes shell |
| Icônes FontAwesome | Git integration | Profils multiples |

---

## 🚀 Installation Rapide

### Prérequis
- Python 3.8+
- Git
- Navigateur moderne (Chrome/Firefox/Safari)

### 1. Cloner le Projet
```bash
git clone http://192.168.1.86:3000/coder/nexuspad.git
cd nexuspad
```

### 2. Lancer l'Interface
```bash
# Serveur de développement simple
cd ui && python3 -m http.server 8091
# Ou avec le serveur WebSocket complet
cd server && python3 ws_server.py
```

### 3. Accéder à l'Interface
- **Local** : `http://localhost:8091`
- **Réseau** : `http://[IP]:8091`
- **Pad Tactile** : `http://192.168.1.109:8091` *(exemple)*

---

## 🎯 Utilisation

### Interface Principale

```
┌─────────────────────────────────────────────────┐
│  🔵 NEXUSPAD v1.0    PC: en ligne    ⚙️ ↕️ 💤 ⚙  │
├─────────────────────────────────────────────────┤
│  📊                 🎮 Stream Deck Layout        │
│ Profiles                                        │
│                                                 │
│   🔍      📋       ➡️      📷                   │
│ SEARCH   COPY    SUIVANT  CAPTURE              │
│                                                 │
│   📋      📜       📋      💾                   │
│ COPIER  HISTOIR.  COLLER  SAUVER               │
│                                                 │
│   ↩️      ↪️       +       +                   │
│ ANNULER RETABLIR   NEW     NEW                 │
└─────────────────────────────────────────────────┘
```

### 🎛️ Modes d'Interaction

#### **Mode Normal** *(défaut)*
- **Clic** → Exécute l'action de la touche
- Utilisation classique du macropad

#### **⚙️ Mode Édition** *(cyan)*
```bash
# Activer
Clic sur l'icône ⚙️ (engrenage)

# Utiliser  
Clic sur n'importe quelle touche → Ouvre l'éditeur de paramètres
```

#### **↕️ Mode Réorganisation** *(purple)*
```bash
# Activer
Clic sur l'icône ↕️ (flèches)

# Utiliser
Glisser-déposer les touches pour les réorganiser
```

---

## 🔄 Système de Synchronisation Automatique

### **Le Script Magique : `./bump-version.sh`**

Ce script révolutionnaire permet la synchronisation automatique de tous vos appareils :

```bash
#!/bin/bash
# 🚀 Auto-increment version + sync multi-device

# Lire version actuelle
CURRENT_VERSION=$(grep -o 'CURRENT_VERSION = "[0-9.]*"' ui/js/app.js | grep -o '[0-9.]*')

# Incrémenter automatiquement  
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2) 
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR"

# Mise à jour dans tous les fichiers
sed -i "s/CURRENT_VERSION = \"$CURRENT_VERSION\"/CURRENT_VERSION = \"$NEW_VERSION\"/" ui/js/app.js
sed -i "s/v$CURRENT_VERSION/v$NEW_VERSION/g" ui/index.html
sed -i "s/?v=$CURRENT_VERSION/?v=$NEW_VERSION/g" ui/index.html

echo "✅ Version mise à jour vers $NEW_VERSION"
echo "📱 Le pad va automatiquement se mettre à jour"
```

### **Workflow de Développement Optimisé**

```bash
# 1. Faire vos modifications de code
vim ui/js/app.js  # Ou profiles.json

# 2. Bump automatique de version
./bump-version.sh

# 3. Commit et push
git add .
git commit -m "Nouvelle fonctionnalité XYZ"  
git push origin main

# 4. 🎉 TOUS les pads se synchronisent automatiquement !
```

### **Auto-Sync Multi-Device**

Le système détecte automatiquement les changements :

| Fréquence | Device | Comportement |
|-----------|--------|-------------|
| **5 min** | 📱 Pad Tactile | Check version + reload si différent |
| **10 min** | 💻 Desktop | Check version + notification |
| **Immédiat** | 🔄 Développement | Live reload sur changement |

```javascript
// Détection automatique dans app.js
async function checkForUpdates() {
    const response = await fetch('./?nocache=' + Date.now());
    const html = await response.text();
    const versionMatch = html.match(/NEXUSPAD.*?v(\d+\.\d+)/);
    
    if (versionMatch && versionMatch[1] !== CURRENT_VERSION) {
        toast("🔄 Mise à jour détectée - Rechargement...", 3000);
        setTimeout(() => window.location.reload(true), 2000);
    }
}
```

---

## 🎨 Architecture & Design

### **Stack Technique**

```
📁 nexuspad/
├── 🌐 ui/                     # Frontend Web
│   ├── 📄 index.html         # Interface principale
│   ├── 🎨 css/theme.css      # Design glassmorphisme  
│   ├── ⚡ js/app.js          # Logique interactive
│   └── ⚙️ profiles.json     # Configuration touches
├── 🔌 server/                # Backend WebSocket
│   └── 🐍 ws_server.py       # Serveur Python
├── 🚀 bump-version.sh        # Script auto-sync
└── 📚 README.md             # Documentation
```

### **Technologies**

| Frontend | Backend | Tools |
|----------|---------|-------|
| HTML5 | Python 3 | Git |
| CSS3 + TailwindCSS | WebSockets | Bash |
| Vanilla JavaScript | asyncio | FontAwesome |
| Touch Events API | JSON | Docker *(optionnel)* |

### **Design System**

#### 🎨 **Couleurs**
```css
:root {
  --bg-primary: #05070b;       /* Background sombre */
  --glass: rgba(15, 23, 42, 0.3); /* Effet verre */
  --cyan: #06b6d4;             /* Accent principal */
  --purple: #a855f7;           /* Mode réorganisation */  
  --green: #22c55e;            /* Succès */
  --red: #ef4444;              /* Danger */
}
```

#### ✨ **Animations**
- **Hover** : `transform: scale(1.05)` + glow
- **Click** : Pulse effect avec `box-shadow`
- **Drag** : Opacity + visual feedback
- **Transition** : `transition: all 0.2s ease`

---

## ⚙️ Configuration Avancée

### **Structure des Profils**

```json
{
  "profiles": [
    {
      "id": "BUREAU",
      "label": "BUREAU", 
      "grid": { "cols": 4 },
      "buttons": [
        {
          "label": "Copier",
          "hint": "Ctrl+C", 
          "accent": "cyan",
          "icon": "fa-copy",
          "action": {
            "type": "keys",
            "payload": "CTRL+C"
          }
        }
      ]
    }
  ]
}
```

### **Types d'Actions Supportées**

#### 🎹 **Raccourcis Clavier**
```json
{
  "type": "keys",
  "payload": "CTRL+SHIFT+ESC"  // Task Manager
}
```

#### 🚀 **Lancement d'Applications**  
```json
{
  "type": "run",
  "payload": "C:\\Program Files\\OBS Studio\\obs64.exe"
}
```

#### 💻 **Commandes Shell**
```json
{
  "type": "shell", 
  "payload": "start chrome https://youtube.com"
}
```

### **Icônes FontAwesome**

```json
"icon": "fa-copy",        // 📋 Copier
"icon": "fa-paste",       // 📄 Coller  
"icon": "fa-camera",      // 📷 Capture
"icon": "fa-rotate-left", // ↩️ Annuler
"icon": "fa-play",        // ▶️ Play
"icon": "fa-microphone"   // 🎤 Micro
```

---

## 🚀 Fonctionnalités Avancées

### **🤏 Drag & Drop Tactile**

Le système supporte nativement le touch sur écrans tactiles :

```javascript
// Touch Events pour écrans tactiles
document.addEventListener("touchstart", function(e) {
    if (isReorganizeMode && target.draggable) {
        e.preventDefault(); // Empêche le scroll
        touchDragData = {
            element: target,
            fromIndex: index,
            startY: e.touches[0].clientY
        };
    }
}, { passive: false });
```

**Feedback Visuel Temps Réel** :
- Opacity pendant le drag
- Highlight des zones de drop
- Animation de déplacement fluide

### **🔄 WebSocket Real-time**

Communication bidirectionnelle PC ↔ Pad :

```python
# ws_server.py
async def handle_message(websocket, message):
    if message['type'] == 'cmd':
        if message['cmd'] == 'keys':
            # Envoyer raccourci au PC cible
            keyboard.send(message['keys'])
        elif message['cmd'] == 'run':  
            # Lancer application
            subprocess.run(message['path'])
```

### **📱 Auto-Detection Device**

```javascript
const isTouchDevice = ('ontouchstart' in window) || 
                     (navigator.maxTouchPoints > 0);

if (isTouchDevice) {
    // Interface optimisée tactile
    enableTouchDrag();
    setUpdateInterval(300000); // 5 minutes  
} else {
    // Interface desktop
    setUpdateInterval(600000); // 10 minutes
}
```

---

## 🎯 Cas d'Usage

### **🎬 Streamer Pro**
```json
{
  "id": "STREAMING",
  "buttons": [
    {"label": "Start Stream", "action": {"type": "keys", "payload": "F9"}},
    {"label": "Mute Mic", "action": {"type": "keys", "payload": "F11"}}, 
    {"label": "Scene Gaming", "action": {"type": "keys", "payload": "F1"}},
    {"label": "Scene Chat", "action": {"type": "keys", "payload": "F2"}}
  ]
}
```

### **💻 Développeur**
```json
{
  "id": "DEV",
  "buttons": [
    {"label": "Terminal", "action": {"type": "keys", "payload": "CTRL+SHIFT+`"}},
    {"label": "Debug", "action": {"type": "keys", "payload": "F5"}},
    {"label": "Git Commit", "action": {"type": "shell", "payload": "git add . && git commit"}},
    {"label": "Deploy", "action": {"type": "shell", "payload": "./deploy.sh"}}
  ]
}
```

### **🎨 Créateur de Contenu**
```json
{
  "id": "CREATIVE", 
  "buttons": [
    {"label": "Photoshop", "action": {"type": "run", "payload": "photoshop.exe"}},
    {"label": "After Effects", "action": {"type": "run", "payload": "afterfx.exe"}},
    {"label": "Render", "action": {"type": "keys", "payload": "CTRL+M"}},
    {"label": "Export", "action": {"type": "keys", "payload": "CTRL+ALT+E"}}
  ]
}
```

---

## 🛠️ Développement

### **Setup Environnement**

```bash
# 1. Clone du repo
git clone http://192.168.1.86:3000/coder/nexuspad.git
cd nexuspad

# 2. Serveur de développement  
python3 -m http.server 8091 --directory ui

# 3. WebSocket backend (optionnel)
cd server && python3 ws_server.py

# 4. Watch mode pour CSS/JS
# Utilisez votre IDE préféré avec live-reload
```

### **Workflow Git**

```bash
# 1. Nouvelle fonctionnalité
git checkout -b feature/nouvelle-fonction

# 2. Développement + test
# ... modifications ...

# 3. Bump version automatique
./bump-version.sh

# 4. Commit & merge
git add .
git commit -m "✨ Nouvelle fonction: drag & drop amélioré"
git checkout main 
git merge feature/nouvelle-fonction

# 5. Push & deploy
git push origin main
# 🎉 Auto-sync sur tous les devices !
```

### **Structure des Versions**

| Version | Description | Changements |
|---------|-------------|-------------|
| **v0.1** | MVP initial | Interface de base |
| **v0.5** | WebSocket | Communication PC |
| **v1.0** | **Drag & Drop** | **Touch + Sync auto** |
| **v1.1** | Profils avancés | Templates + export |
| **v2.0** | Cloud sync | Multi-utilisateurs |

---

## 🔧 Dépannage

### **Problèmes Courants**

#### **❌ Le pad ne se met pas à jour**
```bash
# Vérifier la version
grep "CURRENT_VERSION" ui/js/app.js

# Force le cache clear
Ctrl+Shift+R sur le navigateur du pad

# Relancer le bump
./bump-version.sh
```

#### **❌ Drag & Drop ne fonctionne pas**
```bash
# Vérifier le mode
- Clic sur ↕️ (flèches purple) 
- Vérifier que isReorganizeMode = true dans la console

# Pour écrans tactiles
- S'assurer que touch events sont supportés
- Tester avec Chrome/Firefox récent
```

#### **❌ Actions ne s'exécutent pas**  
```bash
# WebSocket
- Vérifier ws_server.py lancé sur port 8765
- Check firewall/antivirus

# Permissions
- Lancer en administrateur si raccourcis système
```

### **Debug Mode**

```javascript
// Dans app.js
const DEBUG = true; // Activer les logs

// Console browser (F12)
// Voir les logs en temps réel
```

---

## 🌟 Roadmap

### **v1.1 - Templates Pro** *(Q1 2026)*
- [ ] Bibliothèque de profils prêts à l'emploi
- [ ] Import/Export configurations
- [ ] Marketplace communautaire

### **v1.2 - Mobile First** *(Q2 2026)*  
- [ ] PWA (Progressive Web App)
- [ ] Offline support
- [ ] Notifications push

### **v2.0 - Cloud Sync** *(Q3 2026)*
- [ ] Sync multi-utilisateurs
- [ ] Backup automatique
- [ ] Collaboration temps réel

### **v2.1 - AI Integration** *(Q4 2026)*
- [ ] Suggestions automatiques de raccourcis
- [ ] Optimisation basée sur l'usage
- [ ] Commandes vocales

---

## 🤝 Contribution

### **Comment Contribuer**

1. **Fork** le projet
2. **Créer** une branche feature
3. **Développer** + tester
4. **Bump** la version avec `./bump-version.sh`  
5. **Pull Request** avec description détaillée

### **Guidelines**

- 🎨 **Design** : Respecter le système glassmorphisme
- ⚡ **Performance** : Optimiser pour les écrans tactiles
- 📱 **Mobile-First** : Tester sur tous les devices
- 🧪 **Tests** : Vérifier sur différents OS/navigateurs

### **Contributors**

- [@coder](http://192.168.1.86:3000/coder) - Créateur & Maintainer principal

---

## 📄 License

**MIT License** - Voir [LICENSE](LICENSE) pour les détails.

---

## 🔗 Liens Utiles

- **🌐 Demo Live** : `http://192.168.1.86:8091`
- **📚 Documentation** : `http://192.168.1.86:3000/coder/nexuspad/wiki`
- **🐛 Issues** : `http://192.168.1.86:3000/coder/nexuspad/issues`
- **📈 Releases** : `http://192.168.1.86:3000/coder/nexuspad/releases`

---

## 💡 Inspiration

Inspiré par les meilleurs outils de productivité :
- **Stream Deck** d'Elgato
- **Touch Bar** de MacBook Pro  
- **Control Surface** pour DAW
- **Smart Home Dashboards**

---

<div align="center">

## 🚀 **NexusPad - L'avenir du contrôle tactile est entre vos mains !**

### ⭐ **Si ce projet vous plaît, n'hésitez pas à lui donner une étoile !** ⭐

</div>

---

*Dernière mise à jour : 15 janvier 2026 | Version 1.0 | Made with ❤️ by [@coder](http://192.168.1.86:3000/coder)*
