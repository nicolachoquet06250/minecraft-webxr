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
    const grass = createMaterial(scene, "vr-menu-grass", new Color3(0.27, 0.58, 0.2));
    const wood = createMaterial(scene, "vr-menu-wood", new Color3(0.47, 0.26, 0.12));
    const darkWood = createMaterial(scene, "vr-menu-dark-wood", new Color3(0.22, 0.13, 0.08));
    const roof = createMaterial(scene, "vr-menu-roof", new Color3(0.34, 0.18, 0.1));
    const glass = createMaterial(scene, "vr-menu-glass", new Color3(0.45, 0.75, 0.9));

    const ground = MeshBuilder.CreateBox("vr-menu-ground", { width: 18, depth: 18, height: 0.2 }, scene);
    ground.position.y = -0.1;
    ground.material = grass;

    const cabin = MeshBuilder.CreateBox("vr-menu-chalet-body", { width: 5.2, depth: 4, height: 2.8 }, scene);
    cabin.position.y = 1.4;
    cabin.material = wood;

    const roofLeft = MeshBuilder.CreateBox("vr-menu-roof-left", { width: 5.8, depth: 4.6, height: 0.42 }, scene);
    roofLeft.position.set(-1.35, 3.05, 0);
    roofLeft.rotation.z = Math.PI / 5;
    roofLeft.material = roof;

    const roofRight = MeshBuilder.CreateBox("vr-menu-roof-right", { width: 5.8, depth: 4.6, height: 0.42 }, scene);
    roofRight.position.set(1.35, 3.05, 0);
    roofRight.rotation.z = -Math.PI / 5;
    roofRight.material = roof;

    const door = MeshBuilder.CreateBox("vr-menu-door", { width: 1, height: 1.9, depth: 0.08 }, scene);
    door.position.set(0, 0.95, -2.04);
    door.material = darkWood;

    for (const x of [-1.55, 1.55]) {
        const window = MeshBuilder.CreateBox(`vr-menu-window-${x}`, { width: 0.9, height: 0.75, depth: 0.09 }, scene);
        window.position.set(x, 1.7, -2.08);
        window.material = glass;
    }

    for (const x of [-3.2, 3.2]) {
        const trunk = MeshBuilder.CreateBox(`vr-menu-tree-trunk-${x}`, { width: 0.45, height: 1.8, depth: 0.45 }, scene);
        trunk.position.set(x, 0.9, 2.8);
        trunk.material = darkWood;

        const leaves = MeshBuilder.CreateBox(`vr-menu-tree-leaves-${x}`, { width: 1.6, height: 1.6, depth: 1.6 }, scene);
        leaves.position.set(x, 2.25, 2.8);
        leaves.material = grass;
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
