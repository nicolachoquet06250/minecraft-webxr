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
    scene.clearColor = new Color4(0.55, 0.76, 0.98, 1);

    const camera = new TargetCamera("vr-menu-camera", new Vector3(0, 3.1, -10), scene);
    camera.setTarget(new Vector3(0, 2.4, 0));
    scene.activeCamera = camera;

    const light = new HemisphericLight("vr-menu-light", new Vector3(0.2, 1, 0.25), scene);
    light.intensity = 0.95;

    createHorizonLobbyScene(scene);
    createVRMenuPanel(scene, () => {
        engine.stopRenderLoop();
        scene.dispose();
        onPlay();
    });

    engine.runRenderLoop(() => {
        scene.render();
    });
}

function createHorizonLobbyScene(scene: Scene): void {
    const sky = createMaterial(scene, "vr-horizon-sky", new Color3(0.5, 0.78, 1.0));
    const platformMaterial = createMaterial(scene, "vr-horizon-platform", new Color3(0.82, 0.88, 0.96));
    const cyan = createMaterial(scene, "vr-horizon-cyan", new Color3(0.05, 0.68, 1.0));
    const blue = createMaterial(scene, "vr-horizon-blue", new Color3(0.05, 0.17, 0.58));
    const glass = createMaterial(scene, "vr-horizon-glass", new Color3(0.45, 0.85, 1.0));
    const dark = createMaterial(scene, "vr-horizon-dark", new Color3(0.03, 0.05, 0.12));
    const foliage = createMaterial(scene, "vr-horizon-foliage", new Color3(0.9, 0.38, 0.78));

    const ground = MeshBuilder.CreateBox("vr-horizon-platform", { width: 18, depth: 18, height: 0.25 }, scene);
    ground.position.y = -0.12;
    ground.material = platformMaterial;

    const runway = MeshBuilder.CreateBox("vr-horizon-runway", { width: 4.2, depth: 15, height: 0.08 }, scene);
    runway.position.set(0, 0.05, -0.4);
    runway.material = cyan;

    const screenWall = MeshBuilder.CreateBox("vr-horizon-screen-wall", { width: 7.5, depth: 0.2, height: 3.6 }, scene);
    screenWall.position.set(0, 2.1, 2.9);
    screenWall.material = dark;

    const screenGlow = MeshBuilder.CreateBox("vr-horizon-screen-glow", { width: 5.8, depth: 0.08, height: 2.4 }, scene);
    screenGlow.position.set(0, 2.2, 2.76);
    screenGlow.material = blue;

    for (const x of [-5.2, 5.2]) {
        const sideGlass = MeshBuilder.CreateBox(`vr-horizon-window-${x}`, { width: 0.15, depth: 12, height: 2.9 }, scene);
        sideGlass.position.set(x, 1.7, -1.2);
        sideGlass.material = glass;
    }

    for (const [x, z] of [[-3.5, -4.5], [3.5, -4.5], [-3.5, 4.5], [3.5, 4.5]] as const) {
        const pillar = MeshBuilder.CreateBox(`vr-horizon-light-pillar-${x}-${z}`, { width: 0.38, depth: 0.38, height: 3.4 }, scene);
        pillar.position.set(x, 1.7, z);
        pillar.material = cyan;
    }

    for (const [x, z] of [[-7.2, -3.6], [7.2, -3.6], [-7.2, 4.2], [7.2, 4.2]] as const) {
        const island = MeshBuilder.CreateBox(`vr-horizon-floating-island-${x}-${z}`, { width: 2.2, depth: 2.2, height: 0.35 }, scene);
        island.position.set(x, 0.35, z);
        island.material = sky;

        const tree = MeshBuilder.CreateBox(`vr-horizon-tree-${x}-${z}`, { width: 1.35, depth: 1.35, height: 1.35 }, scene);
        tree.position.set(x, 1.25, z);
        tree.material = foliage;
    }

    for (const z of [-5.2, 5.2]) {
        const portalTop = MeshBuilder.CreateBox(`vr-horizon-portal-top-${z}`, { width: 5, depth: 0.22, height: 0.25 }, scene);
        portalTop.position.set(0, 3.55, z);
        portalTop.material = cyan;

        for (const x of [-2.7, 2.7]) {
            const portalSide = MeshBuilder.CreateBox(`vr-horizon-portal-side-${x}-${z}`, { width: 0.25, depth: 0.22, height: 3 }, scene);
            portalSide.position.set(x, 2.05, z);
            portalSide.material = cyan;
        }
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
