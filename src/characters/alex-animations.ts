import type { CharacterAnimations } from "~/character-builder";

/**
 * Animations d'Alex (identiques à Steve)
 * Les animations sont les mêmes pour les deux types de corps
 */
export const alexAnimations: CharacterAnimations = {
  walk: {
    name: "walk",
    fps: 30,
    duration: 0.6,
    loop: true,
    animations: [
      {
        name: "rightArmSwing",
        targetPart: "rightArm",
        property: "rotation.x",
        keyframes: [
          { frame: 0, value: -0.5 },
          { frame: 9, value: 0.5 },
          { frame: 18, value: -0.5 },
        ],
      },
      {
        name: "leftArmSwing",
        targetPart: "leftArm",
        property: "rotation.x",
        keyframes: [
          { frame: 0, value: 0.5 },
          { frame: 9, value: -0.5 },
          { frame: 18, value: 0.5 },
        ],
      },
      {
        name: "rightLegSwing",
        targetPart: "rightLeg",
        property: "rotation.x",
        keyframes: [
          { frame: 0, value: 0.5 },
          { frame: 9, value: -0.5 },
          { frame: 18, value: 0.5 },
        ],
      },
      {
        name: "leftLegSwing",
        targetPart: "leftLeg",
        property: "rotation.x",
        keyframes: [
          { frame: 0, value: -0.5 },
          { frame: 9, value: 0.5 },
          { frame: 18, value: -0.5 },
        ],
      },
    ],
  },
  mine: {
    name: "mine",
    fps: 30,
    duration: 0.5,
    loop: true,
    animations: [
      {
        name: "rightArmMine",
        targetPart: "rightArm",
        property: "rotation.x",
        keyframes: [
          { frame: 0, value: -1.2 },
          { frame: 7.5, value: 0.3 },
          { frame: 15, value: -1.2 },
        ],
      },
      {
        name: "leftArmMine",
        targetPart: "leftArm",
        property: "rotation.x",
        keyframes: [
          { frame: 0, value: 0.2 },
          { frame: 7.5, value: -0.1 },
          { frame: 15, value: 0.2 },
        ],
      },
      {
        name: "torsoMine",
        targetPart: "torso",
        property: "rotation.z",
        keyframes: [
          { frame: 0, value: 0 },
          { frame: 7.5, value: 0.05 },
          { frame: 15, value: 0 },
        ],
      },
    ],
  },
  idle: {
    name: "idle",
    fps: 30,
    duration: 2,
    loop: true,
    animations: [
      {
        name: "torsoBreath",
        targetPart: "torso",
        property: "position.y",
        keyframes: [
          { frame: 0, value: 1.0 },
          { frame: 30, value: 1.01 },
          { frame: 60, value: 1.0 },
        ],
      },
    ],
  },
};
