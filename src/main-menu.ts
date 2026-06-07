import {
    Color3,
    Color4,
    HemisphericLight,
    MeshBuilder,
    Scene,
    StandardMaterial,
    TargetCamera,
    Vector3,
} from "@babylonjs/core";
import {
    AdvancedDynamicTexture,
    Button,
    Control,
    Rectangle,
    StackPanel,
    TextBlock,
} from "@babylonjs/gui";
import { isMobileMode } from "./mobile-controls";

const VR_HEADSET_USER_AGENT_PATTERN = /OculusBrowser|Oculus|Quest|Meta Quest|Pico|Vive|Hololens/i;

type MenuDevice = "desktop" | "mobile" | "vr";

type MainMenuOptions = {
    engine: import("@babylonjs/core").Engine;
    canvas: HTMLCanvasElement;
    onPlay: () => void;
};

export async function showMainMenu({ engine, canvas, onPlay }: MainMenuOptions): Promise<void> {
    const device = await detectMenuDevice();

    if (device === "vr") {
        showVRMenu(engine, onPlay);
        return;
    }

    showDomMenu(canvas, device, onPlay);
}

async function detectMenuDevice(): Promise<MenuDevice> {
    if (VR_HEADSET_USER_AGENT_PATTERN.test(navigator.userAgent)) {
        return "vr";
    }

    if (isMobileMode()) {
        return "mobile";
    }

    return "desktop";
}

function showDomMenu(canvas: HTMLCanvasElement, device: Exclude<MenuDevice, "vr">, onPlay: () => void): void {
    canvas.classList.add("is-menu-visible");

    const root = document.createElement("div");
    root.className = `minecraft-menu minecraft-menu--${device}`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Menu principal Minecraft XR Edition");

    const content = document.createElement("div");
    content.classList.add("minecraft-menu__content");
    if (device === 'desktop') {
        content.classList.add("minecraft-menu__content--desktop");
    }

    function startGame(): void {
        root.remove();
        canvas.classList.remove("is-menu-visible");
        onPlay();
    }

    if (device === "desktop") {
        root.append(createDesktopMenuTitle());
        content.append(createDesktopButtonPanel(startGame));
    } else {
        content.append(createMobileMenuHeader(), createMobileButtonPanel(startGame));
    }

    root.append(content);
    document.body.append(root);
}

function createDesktopMenuTitle(): HTMLElement {
    const header = document.createElement("header");
    header.className = "minecraft-menu__desktop-header";

    const title = document.createElement("h1");
    title.className = "minecraft-menu__title";
    title.textContent = "MINECRAFT";

    const splash = document.createElement("p");
    splash.className = "minecraft-menu__splash";
    splash.textContent = "XR Edition";

    header.append(title, splash);
    return header;
}

function createDesktopButtonPanel(onPlay: () => void): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "minecraft-menu__desktop-panel";

    panel.append(
        createMenuButton("Un joueur", "play", false, onPlay),
        createMenuButton("Multijoueur", undefined, true),
        createDesktopButtonRow(
            createMenuButton("Options...", undefined, false),
            createMenuButton("Quitter le jeu", undefined, false),
        ),
    );

    return panel;
}

function createDesktopButtonRow(...buttons: HTMLElement[]): HTMLElement {
    const row = document.createElement("div");
    row.className = "minecraft-menu__button-row";
    row.append(...buttons);
    return row;
}

function createMobileMenuHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "minecraft-menu__mobile-header";

    const title = document.createElement("h1");
    title.className = "minecraft-menu__mobile-title";
    title.textContent = "MINECRAFT";

    const splash = document.createElement("p");
    splash.className = "minecraft-menu__mobile-splash";
    splash.textContent = "XR Edition";

    header.append(title, splash);
    return header;
}

function createMobileButtonPanel(onPlay: () => void): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "minecraft-menu__mobile-panel";

    const actions = document.createElement("div");
    actions.className = "minecraft-menu__mobile-actions";
    actions.append(
        createMenuButton("Jouer", "play", false, onPlay),
        createMenuButton("Paramètres", undefined, false),
    );

    const signIn = createMenuButton("Se connecter", undefined, true);
    signIn.classList.add("minecraft-menu__mobile-signin");

    panel.append(
        actions,
        signIn,
    );

    return panel;
}

function createMenuButton(
    label: string,
    action?: "play",
    disabled = false,
    onClick?: () => void,
): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "minecraft-menu__button";
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;

    if (action) {
        button.dataset.menuAction = action;
    }

    if (onClick) {
        button.addEventListener("click", onClick, { once: true });
    }

    return button;
}

function showVRMenu(
    engine: import("@babylonjs/core").Engine,
    onPlay: () => void,
): void {
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.04, 0.035, 0.025, 1);

    const camera = new TargetCamera("vr-menu-camera", new Vector3(-2.6, 3.05, -9.2), scene);
    camera.setTarget(new Vector3(4.8, 2.5, 2.2));
    scene.activeCamera = camera;

    const light = new HemisphericLight("vr-menu-light", new Vector3(0.2, 1, 0.25), scene);
    light.intensity = 1.05;

    createChaletScene(scene);
    createVRMenuPanel(scene, () => {
        engine.stopRenderLoop();
        scene.dispose();
        onPlay();
    });

    engine.runRenderLoop(() => {
        scene.render();
    });
}

function createChaletScene(scene: Scene): void {
    const floor = createMaterial(scene, "vr-menu-birch-floor", new Color3(0.78, 0.68, 0.42));
    const floorLine = createMaterial(scene, "vr-menu-floor-lines", new Color3(0.55, 0.42, 0.22));
    const wall = createMaterial(scene, "vr-menu-spruce-wall", new Color3(0.36, 0.22, 0.1));
    const darkWood = createMaterial(scene, "vr-menu-dark-wood", new Color3(0.12, 0.075, 0.035));
    const black = createMaterial(scene, "vr-menu-black-screen", new Color3(0.015, 0.012, 0.01));
    const white = createMaterial(scene, "vr-menu-white-wool", new Color3(0.88, 0.88, 0.82));
    const gray = createMaterial(scene, "vr-menu-gray-wool", new Color3(0.24, 0.24, 0.23));
    const glass = createMaterial(scene, "vr-menu-glass", new Color3(0.75, 0.9, 0.98));
    const bookRed = createMaterial(scene, "vr-menu-book-red", new Color3(0.65, 0.08, 0.05));
    const bookGreen = createMaterial(scene, "vr-menu-book-green", new Color3(0.1, 0.55, 0.1));
    const bookBlue = createMaterial(scene, "vr-menu-book-blue", new Color3(0.08, 0.16, 0.65));
    const mapGreen = createMaterial(scene, "vr-menu-map-green", new Color3(0.05, 0.55, 0.08));
    const mapBlue = createMaterial(scene, "vr-menu-map-blue", new Color3(0.03, 0.2, 0.75));
    const torch = createMaterial(scene, "vr-menu-torch", new Color3(1, 0.24, 0.02));
    const cyan = createMaterial(scene, "vr-menu-cyan", new Color3(0, 0.75, 0.8));

    // Sol, plafond et murs : vrai intérieur fermé, plus aucune maison extérieure.
    const roomFloor = MeshBuilder.CreateBox("vr-menu-room-floor", { width: 17, depth: 14, height: 0.18 }, scene);
    roomFloor.position.set(3.5, -0.09, 1.8);
    roomFloor.material = floor;

    for (let x = -4; x <= 11; x += 1.5) {
        const plank = MeshBuilder.CreateBox(`vr-menu-floor-plank-${x}`, { width: 0.05, depth: 14, height: 0.02 }, scene);
        plank.position.set(x, 0.02, 1.8);
        plank.material = floorLine;
    }

    const ceiling = MeshBuilder.CreateBox("vr-menu-ceiling", { width: 17, depth: 14, height: 0.18 }, scene);
    ceiling.position.set(3.5, 4.65, 1.8);
    ceiling.material = floor;

    for (let z = -4; z <= 7; z += 2.5) {
        const beam = MeshBuilder.CreateBox(`vr-menu-ceiling-beam-${z}`, { width: 17.2, depth: 0.26, height: 0.24 }, scene);
        beam.position.set(3.5, 4.48, z);
        beam.material = darkWood;
    }

    const backWall = MeshBuilder.CreateBox("vr-menu-back-wall", { width: 17, height: 4.7, depth: 0.24 }, scene);
    backWall.position.set(3.5, 2.25, 8.8);
    backWall.material = wall;

    const leftWall = MeshBuilder.CreateBox("vr-menu-left-wall", { width: 0.24, height: 4.7, depth: 14 }, scene);
    leftWall.position.set(-5.1, 2.25, 1.8);
    leftWall.material = wall;

    const rightWall = MeshBuilder.CreateBox("vr-menu-right-wall", { width: 0.24, height: 4.7, depth: 14 }, scene);
    rightWall.position.set(12.1, 2.25, 1.8);
    rightWall.material = wall;

    const centralPillar = MeshBuilder.CreateBox("vr-menu-central-pillar", { width: 0.5, height: 4.7, depth: 0.5 }, scene);
    centralPillar.position.set(4.2, 2.25, 6.2);
    centralPillar.material = darkWood;

    // Grand tableau/écran sur le mur gauche, comme dans l'image modèle.
    const bigScreen = MeshBuilder.CreateBox("vr-menu-big-wall-screen", { width: 5.8, height: 2.6, depth: 0.08 }, scene);
    bigScreen.position.set(-4.94, 2.55, 1.2);
    bigScreen.rotation.y = Math.PI / 2;
    bigScreen.material = black;

    const screenFrameTop = MeshBuilder.CreateBox("vr-menu-screen-frame-top", { width: 0.16, height: 0.16, depth: 6.3 }, scene);
    screenFrameTop.position.set(-4.86, 3.9, 1.2);
    screenFrameTop.material = darkWood;

    const screenFrameBottom = MeshBuilder.CreateBox("vr-menu-screen-frame-bottom", { width: 0.16, height: 0.16, depth: 6.3 }, scene);
    screenFrameBottom.position.set(-4.86, 1.18, 1.2);
    screenFrameBottom.material = darkWood;

    const screenSign = MeshBuilder.CreateBox("vr-menu-screen-sign", { width: 0.08, height: 0.3, depth: 3.6 }, scene);
    screenSign.position.set(-4.75, 1.0, 1.2);
    screenSign.material = floor;

    // Canapé blanc au centre, orienté vers l'écran.
    const sofaSeat = MeshBuilder.CreateBox("vr-menu-white-sofa-seat", { width: 4.8, depth: 1.2, height: 0.55 }, scene);
    sofaSeat.position.set(-0.8, 0.35, 0.3);
    sofaSeat.material = white;

    const sofaBack = MeshBuilder.CreateBox("vr-menu-white-sofa-back", { width: 4.8, depth: 0.28, height: 1.25 }, scene);
    sofaBack.position.set(-0.8, 0.85, 0.95);
    sofaBack.material = white;

    for (const x of [-3.35, 1.75]) {
        const arm = MeshBuilder.CreateBox(`vr-menu-white-sofa-arm-${x}`, { width: 0.35, depth: 1.35, height: 1.1 }, scene);
        arm.position.set(x, 0.72, 0.35);
        arm.material = white;
    }

    const lowTable = MeshBuilder.CreateBox("vr-menu-low-table", { width: 2.4, depth: 1.25, height: 0.42 }, scene);
    lowTable.position.set(-0.8, 0.25, -1.55);
    lowTable.material = darkWood;

    const rug = MeshBuilder.CreateBox("vr-menu-dark-rug", { width: 3.6, depth: 2.1, height: 0.03 }, scene);
    rug.position.set(-0.6, 0.05, -3.1);
    rug.material = gray;

    // Torches au sol.
    for (const [x, z] of [[-4.0, -1.7], [2.3, -1.2], [-3.8, -3.8]] as const) {
        const base = MeshBuilder.CreateBox(`vr-menu-torch-stick-${x}-${z}`, { width: 0.13, depth: 0.13, height: 0.75 }, scene);
        base.position.set(x, 0.38, z);
        base.material = darkWood;

        const flame = MeshBuilder.CreateBox(`vr-menu-torch-flame-${x}-${z}`, { width: 0.22, depth: 0.22, height: 0.22 }, scene);
        flame.position.set(x, 0.86, z);
        flame.material = torch;
    }

    // Mur de droite : carte verte/bleue, fenêtre, bibliothèque, coffre et zone enchantement.
    const map = MeshBuilder.CreateBox("vr-menu-wall-map", { width: 0.08, height: 2.8, depth: 2.1 }, scene);
    map.position.set(11.92, 2.7, 2.3);
    map.material = mapGreen;

    for (const [y, z] of [[2.2, 1.6], [2.9, 2.7], [3.5, 2.1]] as const) {
        const river = MeshBuilder.CreateBox(`vr-menu-map-river-${y}-${z}`, { width: 0.09, height: 0.22, depth: 0.8 }, scene);
        river.position.set(11.86, y, z);
        river.material = mapBlue;
    }

    const window = MeshBuilder.CreateBox("vr-menu-right-window", { width: 0.1, height: 1.6, depth: 1.5 }, scene);
    window.position.set(11.85, 2.6, 5.2);
    window.material = glass;

    for (let z = 6.3; z <= 8.1; z += 0.55) {
        for (let y = 1.2; y <= 3.8; y += 0.55) {
            const book = MeshBuilder.CreateBox(`vr-menu-book-${z}-${y}`, { width: 0.1, height: 0.42, depth: 0.38 }, scene);
            book.position.set(11.82, y, z);
            book.material = y % 1.1 < 0.55 ? bookRed : z % 1.1 < 0.55 ? bookBlue : bookGreen;
        }
    }

    const enderChest = MeshBuilder.CreateBox("vr-menu-ender-chest", { width: 1.5, depth: 1.15, height: 0.85 }, scene);
    enderChest.position.set(8.6, 0.45, -2.3);
    enderChest.material = black;

    const enderGlow = MeshBuilder.CreateBox("vr-menu-ender-chest-glow", { width: 0.55, depth: 0.08, height: 0.18 }, scene);
    enderGlow.position.set(8.6, 0.68, -2.9);
    enderGlow.material = cyan;

    const enchant = MeshBuilder.CreateBox("vr-menu-enchant-table", { width: 1.2, depth: 1.1, height: 0.8 }, scene);
    enchant.position.set(9.7, 0.45, 5.9);
    enchant.material = black;

    // Cadres sur le mur de séparation, comme les quatre item frames du modèle.
    for (const [x, y, material] of [
        [5.4, 3.25, mapGreen],
        [6.4, 3.25, glass],
        [5.4, 2.25, black],
        [6.4, 2.25, gray],
    ] as const) {
        const frame = MeshBuilder.CreateBox(`vr-menu-item-frame-${x}-${y}`, { width: 0.75, height: 0.75, depth: 0.08 }, scene);
        frame.position.set(x, y, 6.05);
        frame.material = floor;

        const item = MeshBuilder.CreateBox(`vr-menu-item-frame-content-${x}-${y}`, { width: 0.36, height: 0.36, depth: 0.1 }, scene);
        item.position.set(x, y, 5.98);
        item.material = material;
    }
}

function createVRMenuPanel(scene: Scene, onPlay: () => void): void {
    const texture = AdvancedDynamicTexture.CreateFullscreenUI("vr-main-menu", true, scene);
    const panel = new Rectangle("vr-menu-panel");
    panel.width = "520px";
    panel.height = "430px";
    panel.cornerRadius = 6;
    panel.thickness = 3;
    panel.color = "#1b1b1b";
    panel.background = "rgba(0, 0, 0, 0.48)";
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    panel.top = "40px";
    texture.addControl(panel);

    const stack = new StackPanel("vr-menu-stack");
    stack.width = "430px";
    stack.spacing = 12;
    panel.addControl(stack);

    const title = new TextBlock("vr-menu-title", "Minecraft");
    title.height = "76px";
    title.color = "white";
    title.fontFamily = "Georgia, serif";
    title.fontSize = 52;
    title.fontWeight = "700";
    stack.addControl(title);

    const edition = new TextBlock("vr-menu-edition", "XR Edition");
    edition.height = "36px";
    edition.color = "#f2f2f2";
    edition.fontSize = 24;
    stack.addControl(edition);

    stack.addControl(createVRButton("Un joueur", onPlay));
    stack.addControl(createVRButton("Multijoueur", undefined, true));
    stack.addControl(createVRButton("Options..."));
    stack.addControl(createVRButton("Quitter le jeu"));
}

function createVRButton(label: string, onPlay?: () => void, disabled = false): Button {
    const button = Button.CreateSimpleButton(`vr-menu-${label}`, label);
    button.width = "390px";
    button.height = "52px";
    button.thickness = 3;
    button.color = disabled ? "#9c9c9c" : "#ffffff";
    button.background = disabled ? "#5d5d5d" : "#777777";
    button.fontSize = 23;
    button.isEnabled = !disabled;

    if (onPlay) {
        button.onPointerUpObservable.add(onPlay);
    }

    return button;
}

function createMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    return material;
}
