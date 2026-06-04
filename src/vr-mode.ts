const VR_HEADSET_USER_AGENT_PATTERN = /OculusBrowser|Oculus|Quest|Meta Quest|Pico|Vive|Hololens/i;

type WebXRNavigator = Navigator & {
  xr?: {
    isSessionSupported?: (sessionMode: "immersive-vr") => Promise<boolean>;
  };
};

export async function isImmersiveVrSupported(): Promise<boolean> {
  const xr = (navigator as WebXRNavigator).xr;

  if (typeof xr?.isSessionSupported === "function") {
    try {
      if (await xr.isSessionSupported("immersive-vr")) {
        return true;
      }
    } catch {
      // Certains navigateurs peuvent refuser le check WebXR selon le contexte.
      // Dans ce cas, on garde un fallback User-Agent pour les casques connus.
    }
  }

  return VR_HEADSET_USER_AGENT_PATTERN.test(navigator.userAgent);
}
