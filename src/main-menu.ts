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
import { EYE_HEIGHT, MOVE_SPEED, pressedKeys } from "./constants";
import { isMobileMode, isVRMode } from "./mobile-controls";
import type { PlayerPhysics } from "./types";
import { initializeWebXRGameControls, type WebXRGameControls } from "./vr-mode";

const VR_MENU_SPAWN = new Vector3(2.5, 0, -4.8);
const VR_MENU_MIN_X = -4.35;
const VR_MENU_MAX_X = 11.35;
const VR_MENU_MIN_Z = -4.6;
const VR_MENU_MAX_Z = 8.0;

type MenuDevice = "desktop" | "mobile" | "vr";

type MainMenuOptions = {
    engine: import("@babylonjs/core").Engine;
    canvas: HTMLCanvasElement;
    onPlay: () => void;
};

export async function showMainMenu({ engine, canvas, onPlay }: MainMenuOptions): Promise<void> {
    const device = await detectMenuDevice();

    if (device === "vr") {
        showVRChaletMenu(engine, onPlay);
        return;
    }

    showDomMenu(canvas, device, onPlay);
}

async function detectMenuDevice(): Promise<MenuDevice> {
    if (isVRMode()) {
        return "vr";
    }

    if (isMobileMode()) {
        return "mobile";
    }

    return "desktop";
}

function showVRChaletMenu(
    engine: import("@babylonjs/core").Engine,
    onPlay: () => void,
): void {
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.04, 0.035, 0.025, 1);

    const menuPlayer = createVRMenuPlayer();
    const camera = new TargetCamera("vr-menu-player-camera", getVRMenuEyesPosition(menuPlayer), scene);
    camera.setTarget(new Vector3(-5, 2.3, 1.2));
    scene.activeCamera = camera;

    const light = new HemisphericLight("vr-menu-light", new Vector3(0.2, 1, 0.25), scene);
    light.intensity = 1.15;

    const floor = createVRChaletMap(scene);
    createVRWallMenu(scene, () => {
        pressedKeys.clear();
        engine.stopRenderLoop();
        scene.dispose();
        onPlay();
    });

    let webXRControls: WebXRGameControls | null = null;

    initializeWebXRGameControls(scene, menuPlayer)
        .then((controls) => {
            webXRControls = controls;
        })
        .catch(async (error) => {
            console.warn("Contrôles WebXR indisponibles dans le menu chalet", error);

            try {
                await scene.createDefaultXRExperienceAsync({
                    floorMeshes: [floor],
                });
            } catch (xrError) {
                console.warn("WebXR indisponible dans le menu chalet", xrError);
            }
        });

    engine.runRenderLoop(() => {
        const deltaTime = Math.min(engine.getDeltaTime() / 1000, 0.05);

        webXRControls?.syncBeforePhysics(deltaTime);
        updateVRMenuPlayerFromControls(menuPlayer, deltaTime);

        if (!webXRControls?.isActive()) {
            updateVRMenuCamera(camera, menuPlayer);
        }

        webXRControls?.syncAfterPhysics();
        scene.render();
    });
}

function createVRMenuPlayer(): PlayerPhysics {
    return {
        position: VR_MENU_SPAWN.clone(),
        velocity: Vector3.Zero(),
        yaw: Math.PI,
        pitch: -0.08,
        grounded: true,
        inventory: [],
        selectedSlot: 0,
    };
}

function updateVRMenuPlayerFromControls(player: PlayerPhysics, deltaTime: number): void {
    const moveDirection = getVRMenuMoveDirection(player);

    if (moveDirection.lengthSquared() > 0) {
        player.position.addInPlace(moveDirection.scale(MOVE_SPEED * deltaTime));
        player.position.x = clamp(player.position.x, VR_MENU_MIN_X, VR_MENU_MAX_X);
        player.position.z = clamp(player.position.z, VR_MENU_MIN_Z, VR_MENU_MAX_Z);
    }

    player.position.y = VR_MENU_SPAWN.y;
    player.velocity.set(0, 0, 0);
    player.grounded = true;
}

function getVRMenuMoveDirection(player: PlayerPhysics): Vector3 {
    const forward = new Vector3(
        Math.sin(player.yaw),
        0,
        Math.cos(player.yaw),
    );

    const right = new Vector3(
        Math.cos(player.yaw),
        0,
        -Math.sin(player.yaw),
    );

    const moveDirection = Vector3.Zero();

    if (pressedKeys.has("KeyW") || pressedKeys.has("KeyZ") || pressedKeys.has("ArrowUp")) {
        moveDirection.addInPlace(forward);
    }

    if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
        moveDirection.subtractInPlace(forward);
    }

    if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) {
        moveDirection.addInPlace(right);
    }

    if (pressedKeys.has("KeyA") || pressedKeys.has("KeyQ") || pressedKeys.has("ArrowLeft")) {
        moveDirection.subtractInPlace(right);
    }

    if (moveDirection.lengthSquared() > 0) {
        moveDirection.normalize();
    }

    return moveDirection;
}

function updateVRMenuCamera(camera: TargetCamera, player: PlayerPhysics): void {
    const eyesPosition = getVRMenuEyesPosition(player);
    const lookDirection = new Vector3(
        Math.sin(player.yaw) * Math.cos(player.pitch),
        Math.sin(player.pitch),
        Math.cos(player.yaw) * Math.cos(player.pitch),
    );

    camera.position.copyFrom(eyesPosition);
    camera.setTarget(eyesPosition.add(lookDirection));
}

function getVRMenuEyesPosition(player: PlayerPhysics): Vector3 {
    return player.position.add(new Vector3(0, EYE_HEIGHT, 0));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function createVRChaletMap(scene: Scene) {
    const floorMaterial = createMaterial(scene, "vr-menu-birch-floor", new Color3(0.78, 0.68, 0.42));
    const floorLineMaterial = createMaterial(scene, "vr-menu-floor-lines", new Color3(0.55, 0.42, 0.22));
    const wallMaterial = createMaterial(scene, "vr-menu-spruce-wall", new Color3(0.36, 0.22, 0.1));
    const darkWoodMaterial = createMaterial(scene, "vr-menu-dark-wood", new Color3(0.12, 0.075, 0.035));
    const blackMaterial = createMaterial(scene, "vr-menu-black-screen", new Color3(0.015, 0.012, 0.01));
    const whiteMaterial = createMaterial(scene, "vr-menu-white-wool", new Color3(0.88, 0.88, 0.82));
    const grayMaterial = createMaterial(scene, "vr-menu-gray-wool", new Color3(0.24, 0.24, 0.23));
    const glassMaterial = createMaterial(scene, "vr-menu-glass", new Color3(0.75, 0.9, 0.98));
    const bookRedMaterial = createMaterial(scene, "vr-menu-book-red", new Color3(0.65, 0.08, 0.05));
    const bookGreenMaterial = createMaterial(scene, "vr-menu-book-green", new Color3(0.1, 0.55, 0.1));
    const bookBlueMaterial = createMaterial(scene, "vr-menu-book-blue", new Color3(0.08, 0.16, 0.65));
    const mapGreenMaterial = createMaterial(scene, "vr-menu-map-green", new Color3(0.05, 0.55, 0.08));
    const mapBlueMaterial = createMaterial(scene, "vr-menu-map-blue", new Color3(0.03, 0.2, 0.75));
    const torchMaterial = createMaterial(scene, "vr-menu-torch", new Color3(1, 0.24, 0.02));
    const cyanMaterial = createMaterial(scene, "vr-menu-cyan", new Color3(0, 0.75, 0.8));

    const floor = MeshBuilder.CreateBox("vr-menu-room-floor", { width: 17, depth: 14, height: 0.18 }, scene);
    floor.position.set(3.5, -0.09, 1.8);
    floor.material = floorMaterial;

    for (let x = -4; x <= 11; x += 1.5) {
        const plank = MeshBuilder.CreateBox(`vr-menu-floor-plank-${x}`, { width: 0.05, depth: 14, height: 0.02 }, scene);
        plank.position.set(x, 0.02, 1.8);
        plank.material = floorLineMaterial;
    }

    const ceiling = MeshBuilder.CreateBox("vr-menu-ceiling", { width: 17, depth: 14, height: 0.18 }, scene);
    ceiling.position.set(3.5, 4.65, 1.8);
    ceiling.material = floorMaterial;

    for (let z = -4; z <= 7; z += 2.5) {
        const beam = MeshBuilder.CreateBox(`vr-menu-ceiling-beam-${z}`, { width: 17.2, depth: 0.26, height: 0.24 }, scene);
        beam.position.set(3.5, 4.48, z);
        beam.material = darkWoodMaterial;
    }

    const backWall = MeshBuilder.CreateBox("vr-menu-back-wall", { width: 17, height: 4.7, depth: 0.24 }, scene);
    backWall.position.set(3.5, 2.25, 8.8);
    backWall.material = wallMaterial;

    const leftWall = MeshBuilder.CreateBox("vr-menu-left-wall", { width: 0.24, height: 4.7, depth: 14 }, scene);
    leftWall.position.set(-5.1, 2.25, 1.8);
    leftWall.material = wallMaterial;

    const rightWall = MeshBuilder.CreateBox("vr-menu-right-wall", { width: 0.24, height: 4.7, depth: 14 }, scene);
    rightWall.position.set(12.1, 2.25, 1.8);
    rightWall.material = wallMaterial;

    const centralPillar = MeshBuilder.CreateBox("vr-menu-central-pillar", { width: 0.5, height: 4.7, depth: 0.5 }, scene);
    centralPillar.position.set(4.2, 2.25, 6.2);
    centralPillar.material = darkWoodMaterial;

    const bigScreen = MeshBuilder.CreateBox("vr-menu-big-wall-screen", { width: 5.8, height: 2.6, depth: 0.08 }, scene);
    bigScreen.position.set(-4.94, 2.55, 1.2);
    bigScreen.rotation.y = Math.PI / 2;
    bigScreen.material = blackMaterial;

    const sofaSeat = MeshBuilder.CreateBox("vr-menu-white-sofa-seat", { width: 4.8, depth: 1.2, height: 0.55 }, scene);
    sofaSeat.position.set(-0.8, 0.35, 0.3);
    sofaSeat.material = whiteMaterial;

    const sofaBack = MeshBuilder.CreateBox("vr-menu-white-sofa-back", { width: 4.8, depth: 0.28, height: 1.25 }, scene);
    sofaBack.position.set(-0.8, 0.85, 0.95);
    sofaBack.material = whiteMaterial;

    for (const x of [-3.35, 1.75]) {
        const arm = MeshBuilder.CreateBox(`vr-menu-white-sofa-arm-${x}`, { width: 0.35, depth: 1.35, height: 1.1 }, scene);
        arm.position.set(x, 0.72, 0.35);
        arm.material = whiteMaterial;
    }

    const lowTable = MeshBuilder.CreateBox("vr-menu-low-table", { width: 2.4, depth: 1.25, height: 0.42 }, scene);
    lowTable.position.set(-0.8, 0.25, -1.55);
    lowTable.material = darkWoodMaterial;

    const rug = MeshBuilder.CreateBox("vr-menu-dark-rug", { width: 3.6, depth: 2.1, height: 0.03 }, scene);
    rug.position.set(-0.6, 0.05, -3.1);
    rug.material = grayMaterial;

    for (const [x, z] of [[-4.0, -1.7], [2.3, -1.2], [-3.8, -3.8]] as const) {
        const base = MeshBuilder.CreateBox(`vr-menu-torch-stick-${x}-${z}`, { width: 0.13, depth: 0.13, height: 0.75 }, scene);
        base.position.set(x, 0.38, z);
        base.material = darkWoodMaterial;

        const flame = MeshBuilder.CreateBox(`vr-menu-torch-flame-${x}-${z}`, { width: 0.22, depth: 0.22, height: 0.22 }, scene);
        flame.position.set(x, 0.86, z);
        flame.material = torchMaterial;
    }

    const map = MeshBuilder.CreateBox("vr-menu-wall-map", { width: 0.08, height: 2.8, depth: 2.1 }, scene);
    map.position.set(11.92, 2.7, 2.3);
    map.material = mapGreenMaterial;

    for (const [y, z] of [[2.2, 1.6], [2.9, 2.7], [3.5, 2.1]] as const) {
        const river = MeshBuilder.CreateBox(`vr-menu-map-river-${y}-${z}`, { width: 0.09, height: 0.22, depth: 0.8 }, scene);
        river.position.set(11.86, y, z);
        river.material = mapBlueMaterial;
    }

    const window = MeshBuilder.CreateBox("vr-menu-right-window", { width: 0.1, height: 1.6, depth: 1.5 }, scene);
    window.position.set(11.85, 2.6, 5.2);
    window.material = glassMaterial;

    for (let z = 6.3; z <= 8.1; z += 0.55) {
        for (let y = 1.2; y <= 3.8; y += 0.55) {
            const book = MeshBuilder.CreateBox(`vr-menu-book-${z}-${y}`, { width: 0.1, height: 0.42, depth: 0.38 }, scene);
            book.position.set(11.82, y, z);
            book.material = y % 1.1 < 0.55 ? bookRedMaterial : z % 1.1 < 0.55 ? bookBlueMaterial : bookGreenMaterial;
        }
    }

    const enderChest = MeshBuilder.CreateBox("vr-menu-ender-chest", { width: 1.5, depth: 1.15, height: 0.85 }, scene);
    enderChest.position.set(8.6, 0.45, -2.3);
    enderChest.material = blackMaterial;

    const enderGlow = MeshBuilder.CreateBox("vr-menu-ender-chest-glow", { width: 0.55, depth: 0.08, height: 0.18 }, scene);
    enderGlow.position.set(8.6, 0.68, -2.9);
    enderGlow.material = cyanMaterial;

    for (const [x, y, material] of [
        [5.4, 3.25, mapGreenMaterial],
        [6.4, 3.25, glassMaterial],
        [5.4, 2.25, blackMaterial],
        [6.4, 2.25, grayMaterial],
    ] as const) {
        const frame = MeshBuilder.CreateBox(`vr-menu-item-frame-${x}-${y}`, { width: 0.75, height: 0.75, depth: 0.08 }, scene);
        frame.position.set(x, y, 6.05);
        frame.material = floorMaterial;

        const item = MeshBuilder.CreateBox(`vr-menu-item-frame-content-${x}-${y}`, { width: 0.36, height: 0.36, depth: 0.1 }, scene);
        item.position.set(x, y, 5.98);
        item.material = material;
    }

    return floor;
}

function createVRWallMenu(scene: Scene, onPlay: () => void): void {
    const panel = MeshBuilder.CreatePlane("vr-wall-menu-panel", { width: 4.6, height: 2.25 }, scene);
    panel.position.set(-4.86, 2.55, 1.2);
    panel.rotation.y = Math.PI / 2;
    panel.isPickable = true;

    const texture = AdvancedDynamicTexture.CreateForMesh(panel, 1600, 820, false);
    const root = new Rectangle("vr-wall-menu-root");
    root.thickness = 8;
    root.color = "#5b3f24";
    root.cornerRadius = 28;
    root.background = "rgba(18, 14, 10, 0.74)";
    root.paddingLeft = "64px";
    root.paddingRight = "64px";
    root.paddingTop = "56px";
    root.paddingBottom = "56px";
    texture.addControl(root);

    const stack = new StackPanel("vr-wall-menu-stack");
    stack.spacing = 22;
    root.addControl(stack);

    const title = new TextBlock("vr-wall-menu-title", "Minecraft");
    title.height = "116px";
    title.color = "white";
    title.fontFamily = "Georgia, serif";
    title.fontSize = 76;
    title.fontWeight = "700";
    stack.addControl(title);

    const subtitle = new TextBlock("vr-wall-menu-subtitle", "XR Edition");
    subtitle.height = "42px";
    subtitle.color = "#d9e8ff";
    subtitle.fontSize = 34;
    stack.addControl(subtitle);

    stack.addControl(createVRMenuButton("Un joueur", onPlay));
    stack.addControl(createVRMenuButton("Options..."));
    stack.addControl(createVRMenuButton("Quitter le jeu"));
}

function createVRMenuButton(label: string, onClick?: () => void): Button {
    const button = Button.CreateSimpleButton(`vr-wall-menu-button-${label}`, label);
    button.height = "86px";
    button.width = "720px";
    button.thickness = 4;
    button.color = "white";
    button.background = "rgba(112, 112, 112, 0.92)";
    button.cornerRadius = 4;
    button.fontSize = 34;
    button.fontWeight = "600";
    button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

    if (onClick) {
        button.onPointerUpObservable.add(onClick);
    }

    return button;
}

function showDomMenu(canvas: HTMLCanvasElement, device: Exclude<MenuDevice, "vr">, onPlay: () => void): void {
    canvas.classList.add("is-menu-visible");

    const root = document.createElement("div");
    root.className = `minecraft-menu minecraft-menu--${device}`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Menu principal Minecraft XR Edition");

    const content = document.createElement("div");
    content.classList.add("minecraft-menu__content");

    if (device === "desktop") {
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

    panel.append(actions, signIn);
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

function createMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    return material;
}
