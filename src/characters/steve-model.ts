import type { CharacterModel } from "~/character-builder";
import { steveModelTextures } from "./steve-color-matrices";

/**
 * Modèle de Steve construit avec le système générique de personnages
 * Type masculin avec bras larges
 */
export const steveModel: CharacterModel = {
  name: "steve",
  bodyType: "masculine",
  bodyParts: [
    // Tête
    {
      name: "head",
      dimensions: { width: 0.5, height: 0.5, depth: 0.5 },
      position: { x: 0, y: 1.625, z: 0 },
      textures: steveModelTextures.head,
    },
    // Torse
    {
      name: "torso",
      dimensions: { width: 0.5, height: 0.75, depth: 0.25 },
      position: { x: 0, y: 1.0, z: 0 },
      textures: steveModelTextures.torso,
    },
    // Bras droit
    {
      name: "rightArm",
      dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
      position: { x: -0.375, y: 1.0, z: 0 },
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: steveModelTextures.rightArm,
    },
    // Bras gauche
    {
      name: "leftArm",
      dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
      position: { x: 0.375, y: 1.0, z: 0 },
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: steveModelTextures.leftArm,
    },
    // Jambe droite
    {
      name: "rightLeg",
      dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
      position: { x: -0.125, y: 0.375, z: 0 },
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: steveModelTextures.rightLeg,
    },
    // Jambe gauche
    {
      name: "leftLeg",
      dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
      position: { x: 0.125, y: 0.375, z: 0 },
      pivot: { x: 0, y: 0.375, z: 0 },
      textures: steveModelTextures.leftLeg,
    },
  ],
};
