import { isMobileMode, isVRMode } from "./mobile-controls";

export type OptionValue = boolean | number | string;

export type GameOptions = {
    renderDistance: number;
    fov: number;
    mouseSensitivity: number;
    soundVolume: number;
    musicVolume: number;
    fullscreen: boolean;
    showFPS: boolean;
    showCoordinates: boolean;
    smoothLighting: boolean;
    clouds: boolean;
    particlesLevel: "all" | "decreased" | "minimal";
};

const DEFAULT_OPTIONS: GameOptions = {
    renderDistance: 8,
    fov: 70,
    mouseSensitivity: 50,
    soundVolume: 80,
    musicVolume: 60,
    fullscreen: false,
    showFPS: false,
    showCoordinates: false,
    smoothLighting: true,
    clouds: true,
    particlesLevel: "all",
};

const OPTIONS_STORAGE_KEY = "voxicraft-options";

export function getGameOptions(): GameOptions {
    try {
        const stored = localStorage.getItem(OPTIONS_STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_OPTIONS, ...JSON.parse(stored) };
        }
    } catch (error) {
        console.warn("Failed to load game options:", error);
    }
    return { ...DEFAULT_OPTIONS };
}

export function saveGameOptions(options: GameOptions): void {
    try {
        localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
    } catch (error) {
        console.error("Failed to save game options:", error);
    }
}

export type OptionsMenuOptions = {
    onBack: () => void;
    onApply?: (options: GameOptions) => void;
};

export function showOptionsMenu({ onBack, onApply }: OptionsMenuOptions): void {
    const device = detectDevice();
    const currentOptions = getGameOptions();
    
    showDomOptionsMenu(device, currentOptions, onBack, onApply);
}

function detectDevice(): "desktop" | "mobile" | "vr" {
    if (isVRMode()) {
        return "vr";
    }
    if (isMobileMode()) {
        return "mobile";
    }
    return "desktop";
}

function showDomOptionsMenu(
    device: "desktop" | "mobile" | "vr",
    currentOptions: GameOptions,
    onBack: () => void,
    onApply?: (options: GameOptions) => void
): void {
    const root = document.createElement("div");
    root.className = `voxicraft-options voxicraft-options--${device === "vr" ? "desktop voxicraft-options--vr" : device}`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Options de jeu");

    const content = document.createElement("div");
    content.classList.add("voxicraft-options__content");

    if (device === "desktop" || device === "vr") {
        content.classList.add("voxicraft-options__content--desktop");
    }

    let tempOptions = { ...currentOptions };

    function handleBack(): void {
        root.remove();
        onBack();
    }

    function handleApply(): void {
        saveGameOptions(tempOptions);
        if (onApply) {
            onApply(tempOptions);
        }
        root.remove();
        onBack();
    }

    function updateOption<K extends keyof GameOptions>(key: K, value: GameOptions[K]): void {
        tempOptions[key] = value;
    }

    if (device === "mobile") {
        content.append(
            createMobileOptionsHeader(),
            createOptionsPanel(device, tempOptions, updateOption),
            createMobileButtonPanel(handleBack, handleApply)
        );
    } else {
        root.append(createDesktopOptionsTitle());
        content.append(
            createOptionsPanel(device, tempOptions, updateOption),
            createDesktopButtonPanel(handleBack, handleApply)
        );
    }

    root.append(content);
    document.body.append(root);
}

function createDesktopOptionsTitle(): HTMLElement {
    const header = document.createElement("header");
    header.className = "voxicraft-options__desktop-header";

    const title = document.createElement("h1");
    title.className = "voxicraft-options__title";
    title.textContent = "OPTIONS";

    header.append(title);
    return header;
}

function createMobileOptionsHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "voxicraft-options__mobile-header";

    const title = document.createElement("h1");
    title.className = "voxicraft-options__mobile-title";
    title.textContent = "OPTIONS";

    header.append(title);
    return header;
}

function createOptionsPanel(
    device: "desktop" | "mobile" | "vr",
    options: GameOptions,
    updateOption: <K extends keyof GameOptions>(key: K, value: GameOptions[K]) => void
): HTMLElement {
    const panel = document.createElement("section");
    panel.className = `voxicraft-options__panel voxicraft-options__panel--${device}`;

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "voxicraft-options__scroll";

    // Vidéo
    const videoSection = createOptionSection("Vidéo");
    videoSection.append(
        createSliderOption("Distance de rendu", options.renderDistance, 4, 16, 1, " chunks", (value) => {
            updateOption("renderDistance", value);
        }),
        createSliderOption("Champ de vision", options.fov, 30, 110, 5, "°", (value) => {
            updateOption("fov", value);
        }),
        createToggleOption("Plein écran", options.fullscreen, (value) => {
            updateOption("fullscreen", value);
        }),
        createToggleOption("Éclairage lissé", options.smoothLighting, (value) => {
            updateOption("smoothLighting", value);
        }),
        createToggleOption("Nuages", options.clouds, (value) => {
            updateOption("clouds", value);
        }),
        createSelectOption(
            "Particules",
            options.particlesLevel,
            [
                { value: "all", label: "Toutes" },
                { value: "decreased", label: "Réduites" },
                { value: "minimal", label: "Minimales" },
            ],
            (value) => {
                updateOption("particlesLevel", value as GameOptions["particlesLevel"]);
            }
        )
    );

    // Audio - Désactivé temporairement (pas encore de musiques/bruitages)
    // const audioSection = createOptionSection("Audio");
    // audioSection.append(
    //     createSliderOption("Volume des sons", options.soundVolume, 0, 100, 5, "%", (value) => {
    //         updateOption("soundVolume", value);
    //     }),
    //     createSliderOption("Volume de la musique", options.musicVolume, 0, 100, 5, "%", (value) => {
    //         updateOption("musicVolume", value);
    //     })
    // );

    // Contrôles
    const controlsSection = createOptionSection("Contrôles");
    controlsSection.append(
        createSliderOption("Sensibilité de la souris", options.mouseSensitivity, 10, 100, 5, "%", (value) => {
            updateOption("mouseSensitivity", value);
        })
    );

    // Interface
    const uiSection = createOptionSection("Interface");
    uiSection.append(
        createToggleOption("Afficher FPS", options.showFPS, (value) => {
            updateOption("showFPS", value);
        }),
        createToggleOption("Afficher coordonnées", options.showCoordinates, (value) => {
            updateOption("showCoordinates", value);
        })
    );

    scrollContainer.append(videoSection, controlsSection, uiSection);
    panel.append(scrollContainer);

    return panel;
}

function createOptionSection(title: string): HTMLElement {
    const section = document.createElement("div");
    section.className = "voxicraft-options__section";

    const heading = document.createElement("h2");
    heading.className = "voxicraft-options__section-title";
    heading.textContent = title;

    section.append(heading);
    return section;
}

function createSliderOption(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (value: number) => void
): HTMLElement {
    const container = document.createElement("div");
    container.className = "voxicraft-options__option";

    const labelEl = document.createElement("label");
    labelEl.className = "voxicraft-options__option-label";
    labelEl.textContent = label;

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "voxicraft-options__option-value";
    valueDisplay.textContent = `${value}${unit}`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "voxicraft-options__slider";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);

    slider.addEventListener("input", () => {
        const newValue = Number(slider.value);
        valueDisplay.textContent = `${newValue}${unit}`;
        onChange(newValue);
    });

    container.append(labelEl, valueDisplay, slider);
    return container;
}

function createToggleOption(label: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
    const container = document.createElement("div");
    container.className = "voxicraft-options__option voxicraft-options__option--toggle";

    const labelEl = document.createElement("label");
    labelEl.className = "voxicraft-options__option-label";
    labelEl.textContent = label;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `voxicraft-options__toggle ${value ? "voxicraft-options__toggle--on" : "voxicraft-options__toggle--off"}`;
    toggle.setAttribute("aria-label", value ? "Activé" : "Désactivé");
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(value));

    toggle.addEventListener("click", () => {
        const newValue = !value;
        value = newValue;
        toggle.className = `voxicraft-options__toggle ${newValue ? "voxicraft-options__toggle--on" : "voxicraft-options__toggle--off"}`;
        toggle.setAttribute("aria-label", newValue ? "Activé" : "Désactivé");
        toggle.setAttribute("aria-checked", String(newValue));
        onChange(newValue);
    });

    container.append(labelEl, toggle);
    return container;
}

function createSelectOption(
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void
): HTMLElement {
    const container = document.createElement("div");
    container.className = "voxicraft-options__option";

    const labelEl = document.createElement("label");
    labelEl.className = "voxicraft-options__option-label";
    labelEl.textContent = label;

    const select = document.createElement("select");
    select.className = "voxicraft-options__select";
    select.value = value;

    for (const opt of options) {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === value) {
            option.selected = true;
        }
        select.append(option);
    }

    select.addEventListener("change", () => {
        onChange(select.value);
    });

    container.append(labelEl, select);
    return container;
}

function createDesktopButtonPanel(onBack: () => void, onApply: () => void): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "voxicraft-options__desktop-buttons";

    const applyButton = createOptionsButton("Appliquer", false, onApply);
    const backButton = createOptionsButton("Retour", false, onBack);

    panel.append(applyButton, backButton);
    return panel;
}

function createMobileButtonPanel(onBack: () => void, onApply: () => void): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "voxicraft-options__mobile-buttons";

    const applyButton = createOptionsButton("Appliquer", false, onApply);
    const backButton = createOptionsButton("Retour", false, onBack);

    panel.append(applyButton, backButton);
    return panel;
}

function createOptionsButton(label: string, disabled = false, onClick?: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "voxicraft-options__button";
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;

    if (onClick) {
        button.addEventListener("click", onClick, { once: false });
    }

    return button;
}
