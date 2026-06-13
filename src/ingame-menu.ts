import { cancelBlockBreaking } from "./block-breaking";
import { pressedKeys } from "./constants";
import { isMobileMode } from "./mobile-controls";
import { MultiplayerClient } from "./multiplayer-client";

const MENU_ID = "voxicraft-ingame-menu";
const BURGER_ID = "voxicraft-ingame-menu-burger";
const STYLE_ID = "voxicraft-ingame-menu-style";
const GAME_MODE_STORAGE_KEY = "voxicraft:game-mode";

let initialized = false;
let menuOpen = false;

export function initializeInGameMenu(): void {
  if (initialized) {
    updateMobileBurgerVisibility();
    return;
  }

  initialized = true;
  ensureMenuStyle();
  ensureMobileBurgerButton();
  updateMobileBurgerVisibility();

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleInGameMenu();
  }, true);

  window.addEventListener("resize", updateMobileBurgerVisibility);
  window.addEventListener("orientationchange", updateMobileBurgerVisibility);
}

export function openInGameMenu(): void {
  if (menuOpen || document.getElementById(MENU_ID)) {
    return;
  }

  menuOpen = true;
  updateMobileBurgerVisibility();
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

  const content = document.createElement("div");
  content.className = "voxicraft-ingame-menu__content";

  const header = document.createElement("header");
  header.className = "voxicraft-ingame-menu__header";

  const title = document.createElement("h2");
  title.className = "voxicraft-ingame-menu__title";
  title.textContent = "VOXICRAFT";

  const subtitle = document.createElement("p");
  subtitle.className = "voxicraft-ingame-menu__splash";
  subtitle.textContent = "Pause !";

  const panel = document.createElement("section");
  panel.className = "voxicraft-ingame-menu__panel";

  const closeButton = createButton("Fermer le menu", () => {
    closeInGameMenu();
  });

  const disconnectButton = createButton("Se déconnecter", () => {
    disconnectAndReturnToMainMenu();
  });

  const quitButton = createButton("Quitter le jeu", () => {
    quitGameWindow();
  });

  header.append(title, subtitle);
  panel.append(closeButton, disconnectButton, quitButton);
  content.append(header, panel);
  overlay.append(content);
  document.body.append(overlay);
  closeButton.focus();
}

export function closeInGameMenu(): void {
  const overlay = document.getElementById(MENU_ID);
  overlay?.remove();
  menuOpen = false;
  updateMobileBurgerVisibility();
  clearGameplayInputState();
}

export function toggleInGameMenu(): void {
  if (menuOpen) {
    closeInGameMenu();
  } else {
    openInGameMenu();
  }
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

function ensureMobileBurgerButton(): void {
  if (document.getElementById(BURGER_ID)) {
    return;
  }

  const button = document.createElement("button");
  button.id = BURGER_ID;
  button.className = "voxicraft-ingame-menu__burger";
  button.type = "button";
  button.setAttribute("aria-label", "Ouvrir le menu");
  button.innerHTML = "<span></span><span></span><span></span>";
  button.addEventListener("click", () => openInGameMenu());
  document.body.append(button);
}

function updateMobileBurgerVisibility(): void {
  const button = document.getElementById(BURGER_ID);

  if (!button) {
    return;
  }

  button.classList.toggle("is-visible", isMobileMode() && !menuOpen);
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
      display: grid;
      place-items: center;
      overflow: hidden;
      background:
        radial-gradient(circle at 50% 42%, rgba(0, 0, 0, 0.18) 0 24%, rgba(0, 0, 0, 0.62) 78%),
        linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.58)),
        repeating-linear-gradient(0deg, rgba(58, 122, 42, 0.72) 0 36px, rgba(75, 143, 50, 0.72) 36px 72px),
        repeating-linear-gradient(90deg, rgba(90, 58, 32, 0.38) 0 36px, rgba(121, 78, 39, 0.38) 36px 72px);
      image-rendering: pixelated;
      color: #fff;
      font-family: Arial, Helvetica, sans-serif;
      user-select: none;
    }

    .voxicraft-ingame-menu__content {
      position: relative;
      z-index: 1;
      width: min(92vw, 560px);
      text-align: center;
    }

    .voxicraft-ingame-menu__header {
      position: relative;
      width: 100%;
      margin: 0 auto clamp(22px, 5vh, 44px);
      text-align: center;
      text-shadow: 5px 5px 0 #151515, -3px -3px 0 #f4f4f4, 0 0 16px rgba(0, 0, 0, 0.55);
    }

    .voxicraft-ingame-menu__title {
      display: block;
      width: 100%;
      margin: 0 auto;
      color: #e1e1e1;
      font-family: Impact, "Arial Black", Haettenschweiler, sans-serif;
      font-size: clamp(56px, 10vw, 104px);
      font-weight: 900;
      letter-spacing: 0.02em;
      line-height: 0.78;
      text-align: center;
      text-transform: uppercase;
      -webkit-text-stroke: 2px #161616;
    }

    .voxicraft-ingame-menu__splash {
      position: absolute;
      right: 20px;
      bottom: -5px;
      width: max-content;
      margin: 0;
      color: #ffff55;
      font-size: clamp(18px, 3.2vw, 30px);
      font-weight: 800;
      text-shadow: 2px 2px 0 #3d3d00;
      transform: rotate(-18deg);
    }

    .voxicraft-ingame-menu__panel {
      display: grid;
      width: min(100%, 440px);
      gap: 12px;
      margin: 0 auto;
    }

    .voxicraft-ingame-menu__button,
    .voxicraft-ingame-menu__burger {
      border: 2px solid #111;
      border-top-color: #cfcfcf;
      border-left-color: #cfcfcf;
      box-shadow: inset -2px -3px 0 rgba(0, 0, 0, 0.42), inset 2px 2px 0 rgba(255, 255, 255, 0.3);
      background:
        linear-gradient(rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.16)),
        repeating-linear-gradient(90deg, #8a8a8a 0 2px, #777 2px 4px);
      color: #fff;
      cursor: pointer;
      font: 500 20px/1 "Arial Black", Arial, Helvetica, sans-serif;
      text-shadow: 2px 2px 0 #222;
    }

    .voxicraft-ingame-menu__button {
      min-height: 46px;
      padding: 0 18px;
    }

    .voxicraft-ingame-menu__button:not(:disabled):hover,
    .voxicraft-ingame-menu__button:not(:disabled):focus-visible,
    .voxicraft-ingame-menu__burger:hover,
    .voxicraft-ingame-menu__burger:focus-visible {
      outline: 2px solid #fff46c;
      background:
        linear-gradient(rgba(255, 255, 255, 0.14), rgba(0, 0, 0, 0.08)),
        repeating-linear-gradient(90deg, #9a9a9a 0 2px, #828282 2px 4px);
    }

    .voxicraft-ingame-menu__burger {
      position: fixed;
      top: max(12px, env(safe-area-inset-top));
      right: max(12px, env(safe-area-inset-right));
      z-index: 12000;
      display: none;
      place-items: center;
      width: 52px;
      height: 52px;
      padding: 0;
      pointer-events: auto;
    }

    .voxicraft-ingame-menu__burger.is-visible {
      display: grid;
    }

    .voxicraft-ingame-menu__burger span {
      display: block;
      width: 28px;
      height: 4px;
      margin: 2px 0;
      background: #fff;
      box-shadow: 2px 2px 0 #222;
    }

    @media (orientation: portrait) {
      .voxicraft-ingame-menu__content {
        width: min(88vw, 430px);
      }

      .voxicraft-ingame-menu__title {
        font-size: clamp(48px, 13vw, 78px);
      }

      .voxicraft-ingame-menu__button {
        min-height: 56px;
        font-size: clamp(20px, 5vw, 26px);
      }
    }
  `;
  document.head.append(style);
}
