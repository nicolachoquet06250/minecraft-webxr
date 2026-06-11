import { isMobileMode, isVRMode } from "./mobile-controls";
import { showOptionsMenu } from "./options-menu";

export type MainMenuLaunchOptions = {
    readonly enterVR?: boolean;
};

type MenuDevice = "desktop" | "mobile" | "vr";

type MainMenuOptions = {
    engine: import("@babylonjs/core").Engine;
    canvas: HTMLCanvasElement;
    onPlay: (options?: MainMenuLaunchOptions) => void;
};

export async function showMainMenu({ canvas, onPlay }: MainMenuOptions): Promise<void> {
    const device = await detectMenuDevice();

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

function showDomMenu(
    canvas: HTMLCanvasElement,
    device: MenuDevice,
    onPlay: (options?: MainMenuLaunchOptions) => void,
): void {
    canvas.classList.add("is-menu-visible");

    const root = document.createElement("div");
    root.className = `minecraft-menu minecraft-menu--${device === "vr" ? "desktop minecraft-menu--vr" : device}`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Menu principal Minecraft XR Edition");

    const content = document.createElement("div");
    content.classList.add("minecraft-menu__content");

    if (device === "desktop" || device === "vr") {
        content.classList.add("minecraft-menu__content--desktop");
    }

    function startGame(): void {
        root.remove();
        canvas.classList.remove("is-menu-visible");
        onPlay({ enterVR: device === "vr" });
    }

    if (device === "mobile") {
        content.append(createMobileMenuHeader(), createMobileButtonPanel(startGame));
    } else {
        root.append(createDesktopMenuTitle(device));
        content.append(createDesktopButtonPanel(startGame));
    }

    root.append(content);
    document.body.append(root);
}

function createDesktopMenuTitle(device: "desktop" | "vr"): HTMLElement {
    const header = document.createElement("header");
    header.className = "minecraft-menu__desktop-header";

    const title = document.createElement("h1");
    title.className = "minecraft-menu__title";
    title.textContent = "MINECRAFT";

    const splash = document.createElement("p");
    splash.className = "minecraft-menu__splash";
    splash.textContent = device === "vr" ? "VR Edition" : "XR Edition";

    header.append(title, splash);
    return header;
}

function createDesktopButtonPanel(onPlay: () => void): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "minecraft-menu__desktop-panel";

    function openOptions(): void {
        showOptionsMenu({
            onBack: () => {
                const canvas = document.querySelector<HTMLCanvasElement>("#minecraft");
                if (canvas) {
                    showDomMenu(canvas, "desktop", onPlay);
                }
            },
        });
    }

    panel.append(
        createMenuButton("Un joueur", "play", false, onPlay),
        createMenuButton("Multijoueur", "play", false, onPlay),
        createDesktopButtonRow(
            createMenuButton("Options...", undefined, false, openOptions),
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

    function openOptions(): void {
        showOptionsMenu({
            onBack: () => {
                const canvas = document.querySelector<HTMLCanvasElement>("#minecraft");
                if (canvas) {
                    showDomMenu(canvas, "mobile", onPlay);
                }
            },
        });
    }

    const actions = document.createElement("div");
    actions.className = "minecraft-menu__mobile-actions";
    actions.append(
        createMenuButton("Jouer", "play", false, onPlay),
        createMenuButton("Paramètres", undefined, false, openOptions),
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
