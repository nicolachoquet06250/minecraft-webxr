echo "Initialisation du Codespace..."

echo "Installation des dépendances Node..."
npm install

echo "Configuration Rust/WASM..."
rustup target add wasm32-unknown-unknown

if ! command -v wasm-pack >/dev/null 2>&1; then
  cargo install wasm-pack
fi

sudo apt update
sudo apt upgrade -y
sudo apt install binaryen -y

echo "Vérification du projet..."
npm run build || true

echo "Codespace prêt."