import { isMobileMode, isVRMode } from "./mobile-controls";
import { showOptionsMenu } from "./options-menu";
import { getAuthSession, isAuthenticated, loadProfilePicSvgObjectUrl, loginWithRelay, logoutFromRelaySession, type AuthSession } from "./auth-client";
import { consumeCentralJoinTicketFromUrl } from "./central-join-ticket";

export const GAME_MODE_STORAGE_KEY = "voxicraft:game-mode";

export type GameMode = "singleplayer" | "multiplayer";

export type MainMenuLaunchOptions = {
    readonly enterVR?: boolean;
    readonly gameMode?: GameMode;
};

type MenuDevice = "desktop" | "mobile" | "vr";

type MainMenuOptions = {
    engine: import("@babylonjs/core").Engine;
    canvas: HTMLCanvasElement;
    onPlay: (options?: MainMenuLaunchOptions) => void;
};

type AuthMenuState = {
    authenticated: boolean;
    session: AuthSession | null;
};

type MenuPanelController = {
    element: HTMLElement;
    refresh: () => void;
};

export async function showMainMenu({ canvas, onPlay }: MainMenuOptions): Promise<void> {
    const device = await detectMenuDevice();
    const joinTicketResult = await consumeCentralJoinTicketFromUrl().catch((error) => {
        console.warn("Impossible de consommer le ticket central", error);
        return {
            status: "invalid" as const,
            message: error instanceof Error ? error.message : "Ticket de connexion central invalide ou expiré",
        };
    });

    if (joinTicketResult.status === "authenticated") {
        window.localStorage.setItem(GAME_MODE_STORAGE_KEY, "multiplayer");
        await triggerLoadingScreenFromCanvas(canvas);
        onPlay({ enterVR: device === "vr", gameMode: "multiplayer" });
        return;
    }

    showDomMenu(canvas, device, onPlay, joinTicketResult.status === "invalid" ? joinTicketResult.message : undefined);
}

async function triggerLoadingScreenFromCanvas(canvas: HTMLCanvasElement): Promise<void> {
    canvas.classList.add("is-menu-visible");
    await nextAnimationFrame();
    canvas.classList.remove("is-menu-visible");
    await nextAnimationFrame();
}

const nextAnimationFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

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
    joinTicketError?: string,
): void {
    canvas.classList.add("is-menu-visible");

    const root = document.createElement("div");
    root.className = `voxicraft-menu voxicraft-menu--${device === "vr" ? "desktop voxicraft-menu--vr" : device}`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Menu principal Voxicraft");

    const content = document.createElement("div");
    content.classList.add("voxicraft-menu__content");

    if (device === "desktop" || device === "vr") {
        content.classList.add("voxicraft-menu__content--desktop");
    }

    const lockedByJoinTicketError = Boolean(joinTicketError);

    function startGame(gameMode: GameMode = "singleplayer"): void {
        if (lockedByJoinTicketError || (gameMode === "multiplayer" && !authState.authenticated)) {
            return;
        }

        window.localStorage.setItem(GAME_MODE_STORAGE_KEY, gameMode);
        root.remove();
        canvas.classList.remove("is-menu-visible");
        onPlay({ enterVR: device === "vr", gameMode });
    }

    const authState: AuthMenuState = {
        authenticated: isAuthenticated(),
        session: getAuthSession(),
    };
    const refreshCallbacks = new Set<() => void>();
    const refreshAuthControls = () => {
        for (const refresh of refreshCallbacks) {
            refresh();
        }
    };
    const openLogin = () => {
        if (lockedByJoinTicketError) {
            return;
        }

        showLoginDialog(root, (session) => {
            authState.authenticated = true;
            authState.session = session;
            refreshAuthControls();
        });
    };
    const logout = () => {
        if (lockedByJoinTicketError) {
            return;
        }

        logoutFromRelaySession();
        authState.authenticated = false;
        authState.session = null;
        refreshAuthControls();
    };

    if (joinTicketError) {
        content.append(createJoinTicketError(joinTicketError));
    }

    if (device === "mobile") {
        const mobilePanel = createMobileButtonPanel(startGame, authState, openLogin, logout, lockedByJoinTicketError);
        refreshCallbacks.add(mobilePanel.refresh);
        content.append(createMobileMenuHeader(), mobilePanel.element);
    } else {
        const desktopPanel = createDesktopButtonPanel(startGame, authState, lockedByJoinTicketError);
        const authCorner = createAuthCornerButton(authState, openLogin, logout, lockedByJoinTicketError);
        refreshCallbacks.add(desktopPanel.refresh);
        refreshCallbacks.add(authCorner.refresh);
        root.append(createDesktopMenuTitle(device));
        content.append(desktopPanel.element);
        root.append(authCorner.element);
    }

    root.append(content);
    document.body.append(root);
}

function createJoinTicketError(message: string): HTMLElement {
    const error = document.createElement("div");
    error.className = "voxicraft-menu__join-ticket-error";
    error.setAttribute("role", "alert");
    error.textContent = `Connexion impossible : ${message}`;
    return error;
}

function createDesktopMenuTitle(device: "desktop" | "vr"): HTMLElement {
    const header = document.createElement("header");
    header.className = "voxicraft-menu__desktop-header";

    const title = document.createElement("h1");
    title.className = "voxicraft-menu__title";
    title.textContent = "VOXICRAFT";

    const splash = document.createElement("p");
    splash.className = "voxicraft-menu__splash";
    splash.textContent = device === "vr" ? "VR Edition" : "XR Edition";

    header.append(title, splash);
    return header;
}

function createDesktopButtonPanel(
    onPlay: (gameMode?: GameMode) => void,
    authState: AuthMenuState,
    locked = false,
): MenuPanelController {
    const panel = document.createElement("section");
    panel.className = "voxicraft-menu__desktop-panel";

    function openOptions(): void {
        if (locked) {
            return;
        }

        showOptionsMenu({
            onBack: () => {
                const canvas = document.querySelector<HTMLCanvasElement>("#voxicraft");
                if (canvas) {
                    showDomMenu(canvas, "desktop", (options) => onPlay(options?.gameMode));
                }
            },
        });
    }

    const singleplayerButton = createMenuButton("Un joueur", "play", locked, () => onPlay("singleplayer"));
    const multiplayerButton = createMenuButton(
        "Multijoueur",
        "play",
        locked || !authState.authenticated,
        () => onPlay("multiplayer"),
    );
    multiplayerButton.title = locked
        ? "Ticket de connexion central invalide ou expiré"
        : "Connecte-toi pour accéder au multijoueur";
    const optionsButton = createMenuButton("Options...", undefined, locked, openOptions);
    const quitButton = createMenuButton("Quitter le jeu", undefined, false);

    const refresh = () => {
        singleplayerButton.disabled = locked;
        optionsButton.disabled = locked;
        multiplayerButton.disabled = locked || !authState.authenticated;
        multiplayerButton.title = locked
            ? "Ticket de connexion central invalide ou expiré"
            : authState.authenticated ? "" : "Connecte-toi pour accéder au multijoueur";
    };

    panel.append(
        singleplayerButton,
        multiplayerButton,
        createDesktopButtonRow(optionsButton, quitButton),
    );

    return { element: panel, refresh };
}

function createDesktopButtonRow(...buttons: HTMLElement[]): HTMLElement {
    const row = document.createElement("div");
    row.className = "voxicraft-menu__button-row";
    row.append(...buttons);
    return row;
}

function createMobileMenuHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "voxicraft-menu__mobile-header";

    const title = document.createElement("h1");
    title.className = "voxicraft-menu__mobile-title";
    title.textContent = "VOXICRAFT";

    const splash = document.createElement("p");
    splash.className = "voxicraft-menu__mobile-splash";
    splash.textContent = "XR Edition";

    header.append(title, splash);
    return header;
}

function createMobileButtonPanel(
    onPlay: (gameMode?: GameMode) => void,
    authState: AuthMenuState,
    onLogin: () => void,
    onLogout: () => void,
    locked = false,
): MenuPanelController {
    const panel = document.createElement("section");
    panel.className = "voxicraft-menu__mobile-panel";

    function openOptions(): void {
        if (locked) {
            return;
        }

        showOptionsMenu({
            onBack: () => {
                const canvas = document.querySelector<HTMLCanvasElement>("#voxicraft");
                if (canvas) {
                    showDomMenu(canvas, "mobile", (options) => onPlay(options?.gameMode));
                }
            },
        });
    }

    const actions = document.createElement("div");
    actions.className = "voxicraft-menu__mobile-actions";

    const playButton = createMenuButton("Jouer", "play", locked, () => onPlay("singleplayer"));
    const multiplayerButton = createMenuButton(
        "Multijoueurs",
        "play",
        locked || !authState.authenticated,
        () => onPlay("multiplayer"),
    );
    multiplayerButton.title = locked
        ? "Ticket de connexion central invalide ou expiré"
        : "Connecte-toi pour accéder au multijoueur";
    const optionsButton = createMenuButton("Paramètres", undefined, locked, openOptions);
    const quitButton = createMenuButton("Quitter", undefined, false);

    actions.append(playButton, multiplayerButton, optionsButton, quitButton);

    const authSlot = document.createElement("div");
    authSlot.className = "voxicraft-menu__mobile-signin voxicraft-menu__auth-slot";

    const refresh = () => {
        playButton.disabled = locked;
        optionsButton.disabled = locked;
        multiplayerButton.disabled = locked || !authState.authenticated;
        multiplayerButton.title = locked
            ? "Ticket de connexion central invalide ou expiré"
            : authState.authenticated ? "" : "Connecte-toi pour accéder au multijoueur";
        renderAuthSlot(authSlot, authState, onLogin, onLogout, locked);
    };
    refresh();

    panel.append(actions, authSlot);
    return { element: panel, refresh };
}

function createAuthCornerButton(
    authState: AuthMenuState,
    onLogin: () => void,
    onLogout: () => void,
    locked = false,
): MenuPanelController {
    const container = document.createElement("div");
    container.className = "voxicraft-menu__auth-corner voxicraft-menu__auth-slot";

    const refresh = () => {
        renderAuthSlot(container, authState, onLogin, onLogout, locked);
    };
    refresh();

    return { element: container, refresh };
}

function renderAuthSlot(
    container: HTMLElement,
    authState: AuthMenuState,
    onLogin: () => void,
    onLogout: () => void,
    locked = false,
): void {
    container.replaceChildren();

    if (!authState.authenticated || !authState.session) {
        const button = createMenuButton("Se connecter", undefined, locked, onLogin);
        button.classList.add("voxicraft-menu__auth-button");
        container.append(button);
        return;
    }

    const profile = document.createElement("div");
    profile.className = "voxicraft-menu__profile";

    const avatar = createAvatarThumbnail(authState.session);

    const username = document.createElement("span");
    username.className = "voxicraft-menu__profile-name";
    username.textContent = authState.session.user.username || "joueur";

    const logout = document.createElement("button");
    logout.className = "voxicraft-menu__logout-button";
    logout.type = "button";
    logout.title = locked ? "Action indisponible avec un ticket invalide" : "Se déconnecter";
    logout.disabled = locked;
    logout.setAttribute("aria-label", "Se déconnecter");
    logout.addEventListener("click", onLogout);

    profile.append(avatar, username, logout);
    container.append(profile);
}

function createAvatarThumbnail(session: AuthSession): HTMLElement {
    const avatar = document.createElement("div");
    avatar.className = "voxicraft-menu__avatar";

    const fallback = document.createElement("span");
    fallback.className = "voxicraft-menu__avatar-fallback";
    fallback.textContent = (session.user.username || "J").trim().charAt(0).toUpperCase() || "J";

    const image = document.createElement("img");
    image.className = "voxicraft-menu__avatar-image";
    image.alt = "";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove(), { once: true });
    avatar.append(image, fallback);

    void loadProfilePicSvgObjectUrl(session)
        .then((avatarUrl) => {
            image.src = avatarUrl;
            image.addEventListener("load", () => {
                window.setTimeout(() => URL.revokeObjectURL(avatarUrl), 30_000);
            }, { once: true });
        })
        .catch((error: unknown) => {
            console.warn("[Voxicraft] Photo de profil indisponible", error);
            image.remove();
        });

    return avatar;
}

function showLoginDialog(menuRoot: HTMLElement, onAuthenticated: (session: AuthSession) => void): void {
    if (menuRoot.querySelector(".voxicraft-login")) {
        return;
    }

    menuRoot.classList.add("is-login-open");

    const overlay = document.createElement("div");
    overlay.className = "voxicraft-login";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Connexion");

    const form = document.createElement("form");
    form.className = "voxicraft-login__panel";

    const title = document.createElement("h2");
    title.className = "voxicraft-login__title";
    title.textContent = "Connexion";

    const email = document.createElement("input");
    email.className = "voxicraft-login__input";
    email.type = "email";
    email.name = "email";
    email.placeholder = "Email";
    email.autocomplete = "email";
    email.required = true;

    const password = document.createElement("input");
    password.className = "voxicraft-login__input";
    password.type = "password";
    password.name = "password";
    password.placeholder = "Mot de passe";
    password.autocomplete = "current-password";
    password.required = true;

    const error = document.createElement("p");
    error.className = "voxicraft-login__error";
    error.setAttribute("aria-live", "polite");

    const submit = createMenuButton("Se connecter", undefined, false);
    submit.type = "submit";

    const closeLogin = () => {
        overlay.remove();
        menuRoot.classList.remove("is-login-open");
    };

    const cancel = createMenuButton("Annuler", undefined, false, closeLogin);

    const actions = document.createElement("div");
    actions.className = "voxicraft-login__actions";
    actions.append(cancel, submit);

    form.append(title, email, password, error, actions);
    overlay.append(form);
    menuRoot.append(overlay);
    email.focus();

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        submit.disabled = true;
        cancel.disabled = true;
        error.textContent = "";

        void loginWithRelay({
            email: email.value.trim(),
            password: password.value,
        }).then((session) => {
            onAuthenticated(session);
            closeLogin();
        }).catch((loginError: unknown) => {
            error.textContent = loginError instanceof Error
                ? loginError.message
                : "Connexion impossible pour le moment";
            submit.disabled = false;
            cancel.disabled = false;
        });
    });
}

function createMenuButton(
    label: string,
    action?: "play",
    disabled = false,
    onClick?: () => void,
): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "voxicraft-menu__button";
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;

    if (action) {
        button.dataset.menuAction = action;
    }

    if (onClick) {
        button.addEventListener("click", onClick);
    }

    return button;
}
