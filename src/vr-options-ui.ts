import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock, Slider } from "@babylonjs/gui";
import type { Mesh } from "@babylonjs/core";
import { getGameOptions, saveGameOptions } from "./options-menu";

export function createVROptionsPanel(menuPanel: Mesh, onBack: () => void): void {
    if (!menuPanel.metadata) {
        menuPanel.metadata = {};
    }

    const ui = AdvancedDynamicTexture.CreateForMesh(menuPanel, 1600, 820, false);
    const currentOptions = getGameOptions();
    const tempOptions = { ...currentOptions };

    const root = new Rectangle("vr-options-root");
    root.thickness = 8;
    root.color = "#5b3f24";
    root.cornerRadius = 28;
    root.background = "rgba(18, 14, 10, 0.72)";
    root.paddingLeft = "64px";
    root.paddingRight = "64px";
    root.paddingTop = "40px";
    root.paddingBottom = "40px";
    ui.addControl(root);

    const mainStack = new StackPanel("vr-options-main-stack");
    mainStack.spacing = 18;
    root.addControl(mainStack);

    const title = new TextBlock("vr-options-title", "Options");
    title.height = "96px";
    title.color = "white";
    title.fontFamily = "Georgia, serif";
    title.fontSize = 64;
    title.fontWeight = "700";
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    mainStack.addControl(title);

    const scrollContainer = new StackPanel("vr-options-scroll");
    scrollContainer.spacing = 12;
    scrollContainer.height = "480px";
    mainStack.addControl(scrollContainer);

    // Distance de rendu
    const renderDistanceContainer = createSliderControl(
        "Distance de rendu",
        tempOptions.renderDistance,
        4,
        16,
        1,
        " chunks",
        (value) => {
            tempOptions.renderDistance = value;
        }
    );
    scrollContainer.addControl(renderDistanceContainer);

    // Champ de vision
    const fovContainer = createSliderControl(
        "Champ de vision",
        tempOptions.fov,
        30,
        110,
        5,
        "°",
        (value) => {
            tempOptions.fov = value;
        }
    );
    scrollContainer.addControl(fovContainer);

    // Sensibilité de la souris
    const sensitivityContainer = createSliderControl(
        "Sensibilité",
        tempOptions.mouseSensitivity,
        10,
        100,
        5,
        "%",
        (value) => {
            tempOptions.mouseSensitivity = value;
        }
    );
    scrollContainer.addControl(sensitivityContainer);

    // Volume des sons - Désactivé temporairement (pas encore de musiques/bruitages)
    // const soundVolumeContainer = createSliderControl(
    //     "Volume des sons",
    //     tempOptions.soundVolume,
    //     0,
    //     100,
    //     5,
    //     "%",
    //     (value) => {
    //         tempOptions.soundVolume = value;
    //     }
    // );
    // scrollContainer.addControl(soundVolumeContainer);

    // Volume de la musique - Désactivé temporairement (pas encore de musiques/bruitages)
    // const musicVolumeContainer = createSliderControl(
    //     "Volume de la musique",
    //     tempOptions.musicVolume,
    //     0,
    //     100,
    //     5,
    //     "%",
    //     (value) => {
    //         tempOptions.musicVolume = value;
    //     }
    // );
    // scrollContainer.addControl(musicVolumeContainer);

    // Buttons
    const buttonStack = new StackPanel("vr-options-buttons");
    buttonStack.isVertical = false;
    buttonStack.height = "86px";
    buttonStack.spacing = 20;
    mainStack.addControl(buttonStack);

    const applyButton = createVRButton("Appliquer", () => {
        saveGameOptions(tempOptions);
        onBack();
    });
    buttonStack.addControl(applyButton);

    const backButton = createVRButton("Retour", onBack);
    buttonStack.addControl(backButton);
}

function createSliderControl(
    label: string,
    initialValue: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (value: number) => void
): Rectangle {
    const container = new Rectangle(`vr-slider-${label}`);
    container.height = "80px";
    container.thickness = 2;
    container.color = "rgba(255, 255, 255, 0.2)";
    container.background = "rgba(0, 0, 0, 0.3)";
    container.cornerRadius = 6;
    container.paddingLeft = "20px";
    container.paddingRight = "20px";
    container.paddingTop = "10px";
    container.paddingBottom = "10px";

    const stack = new StackPanel(`vr-slider-stack-${label}`);
    stack.spacing = 8;
    container.addControl(stack);

    const labelText = new TextBlock(`vr-slider-label-${label}`, label);
    labelText.height = "28px";
    labelText.color = "white";
    labelText.fontSize = 22;
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(labelText);

    const valueText = new TextBlock(`vr-slider-value-${label}`, `${initialValue}${unit}`);
    valueText.height = "24px";
    valueText.color = "#ffeb3b";
    valueText.fontSize = 20;
    valueText.fontWeight = "600";
    valueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    valueText.top = "-36px";
    container.addControl(valueText);

    const slider = new Slider(`vr-slider-input-${label}`);
    slider.minimum = min;
    slider.maximum = max;
    slider.step = step;
    slider.value = initialValue;
    slider.height = "20px";
    slider.color = "white";
    slider.background = "rgba(255, 255, 255, 0.2)";
    slider.borderColor = "rgba(255, 255, 255, 0.4)";
    slider.thumbWidth = "24px";
    slider.isThumbCircle = true;

    slider.onValueChangedObservable.add((value) => {
        const roundedValue = Math.round(value / step) * step;
        valueText.text = `${roundedValue}${unit}`;
        onChange(roundedValue);
    });

    stack.addControl(slider);

    return container;
}

function createVRButton(label: string, onClick: () => void): Rectangle {
    const button = new Rectangle(`vr-button-${label}`);
    button.width = "340px";
    button.height = "86px";
    button.thickness = 4;
    button.color = "white";
    button.background = "rgba(112, 112, 112, 0.92)";
    button.cornerRadius = 4;
    button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

    const text = new TextBlock(`vr-button-label-${label}`, label);
    text.color = "white";
    text.fontSize = 34;
    text.fontWeight = "600";
    button.addControl(text);

    button.onPointerClickObservable.add(onClick);

    button.onPointerEnterObservable.add(() => {
        button.background = "rgba(140, 140, 140, 0.92)";
        button.color = "#ffeb3b";
    });

    button.onPointerOutObservable.add(() => {
        button.background = "rgba(112, 112, 112, 0.92)";
        button.color = "white";
    });

    return button;
}
