import type { CharacterModel } from "~/character-builder";
import { alexModelTextures } from "./alex-color-matrices.ts";

/**
 * Modèle d'Alex construit avec le système générique de personnages
 * Type féminin avec bras fins (3 pixels au lieu de 4)
 */
export const alexModel: CharacterModel = {
  name: "alex",
  bodyType: "feminine",
  bodyParts: [
    // Tête (identique à tous les personnages)
    {
      name: "head",
      dimensions: { width: 0.5, height: 0.5, depth: 0.5 },
      position: { x: 0, y: 1.625, z: 0 },
      textures: alexModelTextures.head,
    },
    // Torse (identique à tous les personnages)
    {
      name: "torso",
      dimensions: { width: 0.5, height: 0.75, depth: 0.25 },
      position: { x: 0, y: 1.0, z: 0 },
      textures: alexModelTextures.torso,
    },
    // Bras droit FIN (3x12x4 = 0.1875x0.75x0.25)
    {
      name: "rightArm",
      dimensions: { width: 0.1875, height: 0.75, depth: 0.25 },
      position: { x: -0.34375, y: 1.0, z: 0 }, // Ajusté pour coller au torse
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: alexModelTextures.rightArm,
    },
    // Bras gauche FIN (3x12x4 = 0.1875x0.75x0.25)
    {
      name: "leftArm",
      dimensions: { width: 0.1875, height: 0.75, depth: 0.25 },
      position: { x: 0.34375, y: 1.0, z: 0 }, // Ajusté pour coller au torse
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: alexModelTextures.leftArm,
    },
    // Jambe droite (identique à Steve)
    {
      name: "rightLeg",
      dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
      position: { x: -0.125, y: 0.375, z: 0 },
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: alexModelTextures.rightLeg,
    },
    // Jambe gauche (identique à Steve)
    {
      name: "leftLeg",
      dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
      position: { x: 0.125, y: 0.375, z: 0 },
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: alexModelTextures.leftLeg,
    },
  ],
};
