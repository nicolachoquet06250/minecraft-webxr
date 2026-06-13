import { cancelBlockBreaking } from "./block-breaking";
import { pressedKeys } from "./constants";
import { MultiplayerClient } from "./multiplayer-client";

const MENU_ID = "voxicraft-ingame-menu";
const STYLE_ID = "voxicraft-ingame-menu-style";
const GAME_MODE_STORAGE_KEY = "voxicraft:game-mode";

let initialized = false;
let menuOpen = false;

export function initializeInGameMenu(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  ensureMenuStyle();

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (menuOpen) {
      closeInGameMenu();
    } else {
      openInGameMenu();
    }
  }, true);
}

function openInGameMenu(): void {
  if (menuOpen || document.getElementById(MENU_ID)) {
    return;
  }

  menuOpen = true;
  clearGameplayInputState();

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  const overlay = document.createElement("div");
  overlay.id = MENU_ID;
  overlay.className = "voxicraft-ingame-menu";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Menu du jeu");

  const panel = document.createElement("section");
  panel.className = "voxicraft-ingame-menu__panel";

  const title = document.createElement("h2");
  title.className = "voxicraft-ingame-menu__title";
  title.textContent = "Menu";

  const closeButton = createButton("Fermer le menu", () => {
    closeInGameMenu();
  });

  const disconnectButton = createButton("Se déconnecter", () => {
    disconnectAndReturnToMainMenu();
  });

  const quitButton = createButton("Quitter le jeu", () => {
    quitGameWindow();
  });

  panel.append(title, closeButton, disconnectButton, quitButton);
  overlay.append(panel);
  document.body.append(overlay);
  closeButton.focus();
}

function closeInGameMenu(): void {
  const overlay = document.getElementById(MENU_ID);
  overlay?.remove();
  menuOpen = false;
  clearGameplayInputState();
}

function disconnectAndReturnToMainMenu(): void {
  closeInGameMenu();
  clearGameplayInputState();
  MultiplayerClient.disconnectActiveSession();

  try {
    window.localStorage.removeItem(GAME_MODE_STORAGE_KEY);
  } catch {
    // Ignorer les erreurs de stockage local en navigation privée restrictive.
  }

  window.setTimeout(() => {
    window.location.reload();
  }, 50);
}

function quitGameWindow(): void {
  clearGameplayInputState();
  MultiplayerClient.disconnectActiveSession();
  window.close();

  window.setTimeout(() => {
    if (!window.closed) {
      window.location.href = "about:blank";
    }
  }, 150);
}

function clearGameplayInputState(): void {
  pressedKeys.clear();
  cancelBlockBreaking();
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "voxicraft-ingame-menu__button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function ensureMenuStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .voxicraft-ingame-menu {
      position: fixed;
      inset: 0;
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(3px);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .voxicraft-ingame-menu__panel {
      min-width: min(360px, calc(100vw - 32px));
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-radius: 14px;
      background: rgba(20, 24, 32, 0.92);
      box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45);
    }

    .voxicraft-ingame-menu__title {
      margin: 0 0 10px;
      color: #fff;
      text-align: center;
      font-size: 28px;
      line-height: 1.1;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .voxicraft-ingame-menu__button {
      min-height: 44px;
      padding: 10px 18px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(88, 108, 136, 0.95), rgba(48, 60, 78, 0.95));
      color: #fff;
      font: inherit;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
    }

    .voxicraft-ingame-menu__button:hover,
    .voxicraft-ingame-menu__button:focus-visible {
      outline: none;
      background: linear-gradient(180deg, rgba(112, 138, 174, 0.98), rgba(62, 78, 104, 0.98));
      border-color: rgba(255, 255, 255, 0.6);
    }
  `;
  document.head.append(style);
}
