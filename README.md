# Minecraft WebXR

Un clone de Minecraft open-source développé avec **Babylon.js** et **Rust (WebAssembly)**, conçu pour fonctionner dans le navigateur avec un support expérimental pour la Réalité Virtuelle (WebXR) et les contrôles mobiles.

![screenshot](.github/screenshots/screenshot.png)

## 🚀 Fonctionnalités

-   **Moteur de Voxel Performant** : Utilisation de Rust via WebAssembly pour la génération de chunks et le bruit (noise) afin de garantir des performances optimales.
-   **Rendu 3D avec Babylon.js** : Un moteur de rendu puissant pour gérer les meshes de chunks, l'éclairage et les effets visuels.
-   **Génération Procédurale** : Mondes générés dynamiquement à l'aide d'un algorithme de bruit.
-   **Support Multi-plateforme** :
    -   **Clavier/Souris** : Contrôles classiques (ZQSD + Souris).
    -   **Mobile** : Commandes tactiles adaptées.
    -   **WebXR** : Support de la réalité virtuelle pour une immersion totale.
-   **Physique & Interaction** : Système de physique pour le joueur, collision avec les blocs, et mécanique de destruction de blocs.
-   **Système d'Inventaire** : Barre d'inventaire et objets lâchés (dropped items).

## 🛠️ Stack Technique

-   **Frontend** : TypeScript, Vite.js
-   **Moteur 3D** : Babylon.js
-   **Core (Calculs)** : Rust (compilé en WASM via `wasm-pack`)
-   **Mathématiques & Bruit** : `noise` crate (Rust)

## 📦 Installation & Développement

### Prérequis

-   [Node.js](https://nodejs.org/) (v24+)
-   [Rust & Cargo](https://rustup.rs/)
-   [`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/)

### Étapes d'installation

1.  **Cloner le dépôt** :
    ```bash
    git clone https://github.com/nicolachoquet06250/minecraft-webxr.git
    cd minecraft-webxr
    ```

2.  **Installer les dépendances Node.js** :
    ```bash
    npm install
    ```

3.  **Lancer le serveur de développement** :
    ```bash
    npm run dev
    ```
    *Cette commande compilera automatiquement le code Rust en WebAssembly et lancera le serveur Vite.*

### Commandes disponibles

-   `npm run dev` : Compile le WASM et lance le serveur de dev.
-   `npm run build` : Compile le WASM, le TypeScript et génère le build de production dans `dist/`.
-   `npm run build:wasm` : Compile uniquement la partie Rust/WASM.
-   `npm run preview` : Prévisualise le build de production localement.

## 🕹️ Contrôles

### 💻 Desktop
- **Déplacement** : `Z` `Q` `S` `D` ou touches fléchées.
- **Sauter** : `Espace`.
- **Regarder** : Souris (cliquer pour verrouiller le pointeur).
- **Détruire un bloc** : Clic gauche.

### 📱 Mobile
- **Déplacement** : Joystick virtuel à gauche de l'écran.
- **Regarder** : Joystick virtuel à droite de l'écran.
- **Sauter** : Bouton dédié à droite.
- **Détruire un bloc** : Bouton dédié à droite.

### 🥽 VR (WebXR)
- **Activation** : Cliquer sur l'icône VR en bas à droite (si un casque est détecté).
- **Déplacement & Interaction** : Support standard WebXR via les contrôleurs VR.

## 📂 Structure du projet

-   `src/` : Code source TypeScript (Babylon.js, événements, contrôles).
-   `wasm/` : Code source Rust (génération de chunks, logique bas niveau).
-   `public/` : Assets statiques.

## 📄 Licence

Ce projet est sous licence [MIT](LICENSE).
