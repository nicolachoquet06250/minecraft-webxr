const FULLSCREEN_EVENTS: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];

function isFullscreenSupported(): boolean {
  return typeof document.documentElement.requestFullscreen === "function";
}

function isFullscreenActive(): boolean {
  return document.fullscreenElement !== null;
}

export async function requestAppFullscreen(): Promise<void> {
  if (!isFullscreenSupported() || isFullscreenActive()) {
    return;
  }

  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // Le navigateur peut refuser le plein écran si l'appel ne vient pas directement
    // d'un geste utilisateur. Dans ce cas, le prochain geste relancera la demande.
  }
}

export function initializeFullscreenOnUserGesture(): void {
  const requestFullscreenFromGesture = () => {
    void requestAppFullscreen();
  };

  for (const eventName of FULLSCREEN_EVENTS) {
    window.addEventListener(eventName, requestFullscreenFromGesture, {
      capture: true,
      passive: true,
    });
  }
}
