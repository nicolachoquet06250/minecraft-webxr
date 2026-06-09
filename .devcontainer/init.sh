echo "Initialisation du Codespace..."

echo "Installation de git lfs"
sudo apt install -y git-lfs
git lfs install

echo "Installation des dépendances Node..."
npm install

echo "Configuration Rust/WASM..."
rustup target add wasm32-unknown-unknown

if ! command -v wasm-pack >/dev/null 2>&1; then
  cargo install wasm-pack
fi

echo "Vérification du projet..."
npm run build || true

echo "Codespace prêt."