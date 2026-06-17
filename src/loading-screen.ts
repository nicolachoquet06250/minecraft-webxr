import { Scene } from "@babylonjs/core";

type LoadingController = {
  markWorldReady: () => void;
  dispose: () => void;
};

declare global {
  interface Window {
    __voxicraftLoadingScreen?: LoadingController;
  }
}

const DURATION_MS = 18_000;
const MAX_LOADING_RUNS = 2;
const MAP_SIZE = 360;
const CELL_SIZE = 8;
const GRID_SIZE = MAP_SIZE / CELL_SIZE;
const INITIAL_SEED = 1337;
const STYLE_ID = "voxicraft-loading-screen-style";
const OVERLAY_CLASS = "voxicraft-loading-screen";
const SEA_LEVEL = 0.02;
const BEACH_LEVEL = 0.11;
const HILL_LEVEL = 0.48;
const ROCK_LEVEL = 0.72;

const COLORS = {
  deepOcean: "#15306f",
  ocean: "#2451a6",
  shallowOcean: "#4e8bd8",
  river: "#2f74cf",
  lake: "#3f86dc",
  sand: "#d7c27a",
  sandLight: "#eadca7",
  grass: "#74b44a",
  forest: "#4f8c38",
  hill: "#7c9a57",
  rock: "#8a8a8a",
  rockLight: "#b9b9b9",
} as const;

type CellType = keyof typeof COLORS;

type MapCell = {
  x: number;
  y: number;
  type: CellType;
  priority: number;
};

const LAND_TYPES: ReadonlySet<CellType> = new Set(["grass", "forest", "hill", "rock", "rockLight"]);
const SHORE_TYPES: ReadonlySet<CellType> = new Set(["river", "lake", "sand", "sandLight"]);
const WATER_TYPES: ReadonlySet<CellType> = new Set(["ocean", "deepOcean", "shallowOcean"]);

let currentSeed = INITIAL_SEED;
let activeController: LoadingController | null = null;
let menuWasVisible = false;
let loadingScreenAlreadyStarted = false;
let sceneRenderPatched = false;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${OVERLAY_CLASS} {
      position: fixed;
      inset: 0;
      z-index: 9;
      display: grid;
      place-items: center;
      overflow: hidden;
      background-color: #211a10;
      background-image:
        linear-gradient(45deg, rgba(0, 0, 0, 0.35) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(0, 0, 0, 0.25) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(80, 60, 35, 0.35) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(0, 0, 0, 0.25) 75%);
      background-size: 24px 24px;
      background-position: 0 0, 0 12px, 12px -12px, -12px 0;
      font-family: monospace;
      pointer-events: auto;
      user-select: none;
    }

    .voxicraft-loading-screen__wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .voxicraft-loading-screen__loader {
      position: relative;
      width: 492px;
      height: 538px;
      overflow: visible;
      background: transparent;
      image-rendering: pixelated;
    }

    .voxicraft-loading-screen__percent {
      position: absolute;
      top: 45px;
      left: 0;
      right: 0;
      z-index: 3;
      color: white;
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      text-shadow: 3px 3px 0 #555, -2px -2px 0 #777;
    }

    .voxicraft-loading-screen__map {
      position: absolute;
      left: 64px;
      top: 126px;
      width: 360px;
      height: 360px;
      overflow: hidden;
      background: #000;
      outline: 4px solid #a48755;
      box-shadow:
        0 0 0 4px #6f5834,
        0 0 0 8px #3f2f1b,
        0 0 0 12px #20160d,
        inset 0 2px 0 rgba(255, 255, 255, 0.10),
        inset 0 -2px 0 rgba(0, 0, 0, 0.35);
    }

    .voxicraft-loading-screen__map::before,
    .voxicraft-loading-screen__map::after {
      content: "";
      position: absolute;
      inset: -12px;
      z-index: 2;
      pointer-events: none;
      image-rendering: pixelated;
    }

    .voxicraft-loading-screen__map::before {
      background:
        linear-gradient(#d0b27a, #d0b27a) top left / 20px 6px no-repeat,
        linear-gradient(#d0b27a, #d0b27a) top left / 6px 20px no-repeat,
        linear-gradient(#d0b27a, #d0b27a) top right / 20px 6px no-repeat,
        linear-gradient(#d0b27a, #d0b27a) top right / 6px 20px no-repeat,
        linear-gradient(#d0b27a, #d0b27a) bottom left / 20px 6px no-repeat,
        linear-gradient(#d0b27a, #d0b27a) bottom left / 6px 20px no-repeat,
        linear-gradient(#d0b27a, #d0b27a) bottom right / 20px 6px no-repeat,
        linear-gradient(#d0b27a, #d0b27a) bottom right / 6px 20px no-repeat;
      opacity: 0.95;
    }

    .voxicraft-loading-screen__map::after {
      background:
        linear-gradient(#3c2b16, #3c2b16) top left / 26px 4px no-repeat,
        linear-gradient(#3c2b16, #3c2b16) top left / 4px 26px no-repeat,
        linear-gradient(#3c2b16, #3c2b16) top right / 26px 4px no-repeat,
        linear-gradient(#3c2b16, #3c2b16) top right / 4px 26px no-repeat,
        linear-gradient(#3c2b16, #3c2b16) bottom left / 26px 4px no-repeat,
        linear-gradient(#3c2b16, #3c2b16) bottom left / 4px 26px no-repeat,
        linear-gradient(#3c2b16, #3c2b16) bottom right / 26px 4px no-repeat,
        linear-gradient(#3c2b16, #3c2b16) bottom right / 4px 26px no-repeat;
      opacity: 0.8;
      mix-blend-mode: multiply;
    }

    .voxicraft-loading-screen__canvas {
      position: relative;
      z-index: 1;
      display: block;
      width: 360px;
      height: 360px;
      image-rendering: pixelated;
    }

    @media (max-width: 560px), (max-height: 680px) {
      .${OVERLAY_CLASS} {
        min-height: 100dvh;
      }

      .voxicraft-loading-screen__wrapper {
        gap: clamp(8px, 3dvh, 16px);
      }

      .voxicraft-loading-screen__loader {
        width: min(92vw, calc((100dvh - 76px) * 492 / 538));
        height: auto;
        aspect-ratio: 492 / 538;
      }

      .voxicraft-loading-screen__percent {
        top: calc(45 / 538 * 100%);
        font-size: clamp(16px, 5.2vw, 28px);
      }

      .voxicraft-loading-screen__map {
        left: calc(64 / 492 * 100%);
        top: calc(126 / 538 * 100%);
        width: calc(360 / 492 * 100%);
        height: auto;
        aspect-ratio: 1 / 1;
        outline-width: clamp(2px, 0.8vw, 4px);
        box-shadow:
          0 0 0 clamp(2px, 0.8vw, 4px) #6f5834,
          0 0 0 clamp(4px, 1.6vw, 8px) #3f2f1b,
          0 0 0 clamp(6px, 2.4vw, 12px) #20160d,
          inset 0 clamp(1px, 0.4vw, 2px) 0 rgba(255, 255, 255, 0.10),
          inset 0 clamp(-2px, -0.4vw, -1px) 0 rgba(0, 0, 0, 0.35);
      }

      .voxicraft-loading-screen__map::before,
      .voxicraft-loading-screen__map::after {
        inset: clamp(-12px, -2.4vw, -6px);
      }

      .voxicraft-loading-screen__canvas {
        width: 100%;
        height: 100%;
      }
    }
  `;
  document.head.append(style);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seededRandom(seed: number): () => number {
  return function random(): number {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function noise2D(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + currentSeed * 0.17) * 43_758.5453123;
  return s - Math.floor(s);
}

function fbm(x: number, y: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalization = 0;

  for (let i = 0; i < 5; i += 1) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / normalization;
}

function distToEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.sqrt(dx * dx + dy * dy);
}

function hasNeighbor(
  x: number,
  y: number,
  elevationGrid: number[][],
  radius: number,
  predicate: (elevation: number) => boolean,
): boolean {
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }

      const nx = x + ox;
      const ny = y + oy;

      if (nx >= 0 && ny >= 0 && nx < GRID_SIZE && ny < GRID_SIZE && predicate(elevationGrid[ny][nx])) {
        return true;
      }
    }
  }

  return false;
}

function buildElevationGrid(): number[][] {
  const elevationGrid = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 0));
  const centerX = (GRID_SIZE - 1) / 2;
  const centerY = (GRID_SIZE - 1) / 2;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const nx = (x - centerX) / (GRID_SIZE * 0.43);
      const ny = (y - centerY) / (GRID_SIZE * 0.43);
      const radial = Math.sqrt(nx * nx + ny * ny);
      const macro = fbm(x * 0.055, y * 0.055) * 2 - 1;
      const detail = fbm(x * 0.12 + 50, y * 0.12 - 30) * 2 - 1;
      const ridge = fbm(x * 0.22 + 80, y * 0.22 + 10) * 2 - 1;
      elevationGrid[y][x] = 1 - radial + macro * 0.33 + detail * 0.12 + ridge * 0.05;
    }
  }

  return elevationGrid;
}

function getRiverDistanceA(x: number, y: number): number {
  if (y < 5 || y > 36) {
    return Infinity;
  }

  const rx = 24 + Math.sin(y * 0.28 + currentSeed * 0.01) * 5 + Math.sin(y * 0.10 + 1.5) * 2;
  return Math.abs(x - rx);
}

function getRiverDistanceB(x: number, y: number): number {
  if (x < 8 || x > 32) {
    return Infinity;
  }

  const ry = 14 + (x - 8) * 0.55 + Math.sin(x * 0.40 + 1.7) * 2.3;
  return Math.abs(y - ry);
}

function getCellType(x: number, y: number, elevation: number, moisture: number, elevationGrid: number[][]): CellType {
  const nearOcean = hasNeighbor(x, y, elevationGrid, 1, (neighborElevation) => neighborElevation < SEA_LEVEL);
  const nearLand = hasNeighbor(x, y, elevationGrid, 2, (neighborElevation) => neighborElevation >= SEA_LEVEL);

  if (elevation < SEA_LEVEL) {
    return nearLand ? "shallowOcean" : elevation < SEA_LEVEL - 0.22 ? "deepOcean" : "ocean";
  }

  if (nearOcean || elevation < BEACH_LEVEL) {
    return moisture > 0.55 ? "sandLight" : "sand";
  }

  if (
    elevation >= BEACH_LEVEL + 0.05
    && (
      distToEllipse(x, y, 16, 16, 3.2, 2.4) < 1
      || distToEllipse(x, y, 29, 18, 2.5, 1.8) < 1
      || distToEllipse(x, y, 20, 28, 2.8, 2.0) < 1
    )
  ) {
    return "lake";
  }

  if (elevation >= BEACH_LEVEL + 0.03 && (getRiverDistanceA(x, y) <= 0.65 || getRiverDistanceB(x, y) <= 0.65)) {
    return "river";
  }

  if (elevation < HILL_LEVEL) {
    return moisture > 0.60 ? "forest" : "grass";
  }

  if (elevation < ROCK_LEVEL) {
    return moisture > 0.45 ? "hill" : "rock";
  }

  return moisture > 0.45 ? "rock" : "rockLight";
}

function generateMapCells(): MapCell[] {
  const random = seededRandom(currentSeed);
  const elevationGrid = buildElevationGrid();
  const cells: MapCell[] = [];
  const centerX = (GRID_SIZE - 1) / 2;
  const centerY = (GRID_SIZE - 1) / 2;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const elevation = elevationGrid[y][x];
      const moisture = fbm(x * 0.09 + 120, y * 0.09 + 70);
      const type = getCellType(x, y, elevation, moisture, elevationGrid);
      const dx = x - centerX;
      const dy = y - centerY;
      const radialDistance = Math.sqrt(dx * dx + dy * dy) / GRID_SIZE;
      let priority = radialDistance * 0.55 + noise2D(x * 1.7, y * 1.7) * 0.20 + random() * 0.08;

      if (LAND_TYPES.has(type)) {
        priority -= 0.10;
      }

      if (SHORE_TYPES.has(type)) {
        priority -= 0.04;
      }

      if (WATER_TYPES.has(type)) {
        priority += 0.03;
      }

      cells.push({ x, y, type, priority });
    }
  }

  cells.sort((a, b) => a.priority - b.priority);
  return cells;
}

function drawBackground(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#000";
  context.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
}

function drawCell(context: CanvasRenderingContext2D, cell: MapCell): void {
  context.fillStyle = COLORS[cell.type];
  context.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function createLoadingScreen(): LoadingController {
  injectStyles();

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-label", "Chargement du monde");

  const wrapper = document.createElement("div");
  wrapper.className = "voxicraft-loading-screen__wrapper";

  const loader = document.createElement("div");
  loader.className = "voxicraft-loading-screen__loader";

  const percent = document.createElement("div");
  percent.className = "voxicraft-loading-screen__percent";
  percent.textContent = "0%";

  const map = document.createElement("div");
  map.className = "voxicraft-loading-screen__map";

  const canvas = document.createElement("canvas");
  canvas.className = "voxicraft-loading-screen__canvas";
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D du loader introuvable");
  }

  map.append(canvas);
  loader.append(percent, map);
  wrapper.append(loader);
  overlay.append(wrapper);
  document.body.append(overlay);

  let frameId: number | null = null;
  let cells: MapCell[] = [];
  let worldReady = false;
  let disposed = false;
  let runCount = 0;

  const dispose = (): void => {
    disposed = true;

    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }

    overlay.remove();

    if (activeController === controller) {
      activeController = null;
    }

    if (window.__voxicraftLoadingScreen === controller) {
      window.__voxicraftLoadingScreen = undefined;
    }
  };

  const start = (regenerateSeed = false): void => {
    if (disposed) {
      return;
    }

    runCount += 1;

    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }

    if (regenerateSeed) {
      currentSeed = randomSeed();
    }

    cells = generateMapCells();
    percent.textContent = "0%";
    drawBackground(context);

    const startedAt = performance.now();

    const animate = (): void => {
      if (disposed) {
        return;
      }

      const rawProgress = clamp((performance.now() - startedAt) / DURATION_MS, 0, 1);
      const visibleCount = Math.floor(cells.length * easeInOutCubic(rawProgress));

      drawBackground(context);
      for (let i = 0; i < visibleCount; i += 1) {
        drawCell(context, cells[i]);
      }

      percent.textContent = `${Math.floor(rawProgress * 100)}%`;

      if (rawProgress < 1) {
        frameId = requestAnimationFrame(animate);
        return;
      }

      for (const cell of cells) {
        drawCell(context, cell);
      }

      percent.textContent = "100%";
      frameId = null;

      if (worldReady || runCount >= MAX_LOADING_RUNS) {
        dispose();
      } else {
        start(true);
      }
    };

    frameId = requestAnimationFrame(animate);
  };

  const controller: LoadingController = {
    markWorldReady: () => {
      worldReady = true;
    },
    dispose,
  };

  start(false);
  return controller;
}

function startLoadingScreenIfGameLaunchDetected(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#voxicraft");

  if (
    loadingScreenAlreadyStarted
    || !menuWasVisible
    || activeController
    || !canvas
    || canvas.classList.contains("is-menu-visible")
  ) {
    return;
  }

  if (document.querySelector(".voxicraft-menu")) {
    return;
  }

  loadingScreenAlreadyStarted = true;
  activeController = createLoadingScreen();
  window.__voxicraftLoadingScreen = activeController;
}

function patchSceneRender(): void {
  if (sceneRenderPatched) {
    return;
  }

  sceneRenderPatched = true;
  const originalRender = Scene.prototype.render;

  Scene.prototype.render = function patchedSceneRender(this: Scene, updateCameras?: boolean, ignoreAnimations?: boolean): void {
    originalRender.call(this, updateCameras, ignoreAnimations);
    window.__voxicraftLoadingScreen?.markWorldReady();
  };
}

function watchMainMenuLifecycle(): void {
  const updateMenuState = (): void => {
    const canvas = document.querySelector<HTMLCanvasElement>("#voxicraft");

    if (document.querySelector(".voxicraft-menu") || canvas?.classList.contains("is-menu-visible")) {
      menuWasVisible = true;
    }

    startLoadingScreenIfGameLaunchDetected();
  };

  const observer = new MutationObserver(updateMenuState);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });

  updateMenuState();
}

patchSceneRender();
watchMainMenuLifecycle();
