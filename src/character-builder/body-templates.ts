import type { BodyPartDefinition, BodyType } from "./types";

/**
 * Templates de parties du corps pour différents types morphologiques
 */

export type BodyPartTemplate = Omit<BodyPartDefinition, "textures">;

/**
 * Template pour un corps masculin (type Steve)
 * - Bras larges (4x12x4 unités = 0.25x0.75x0.25)
 * - Proportions standard
 */
export const masculineBodyTemplate: readonly BodyPartTemplate[] = [
  {
    name: "head",
    dimensions: { width: 0.5, height: 0.5, depth: 0.5 },
    position: { x: 0, y: 1.625, z: 0 },
  },
  {
    name: "torso",
    dimensions: { width: 0.5, height: 0.75, depth: 0.25 },
    position: { x: 0, y: 1.0, z: 0 },
  },
  {
    name: "rightArm",
    dimensions: { width: 0.25, height: 0.75, depth: 0.25 }, // Bras large
    position: { x: -0.375, y: 1.0, z: 0 },
    pivot: { x: 0, y: 0.375, z: 0 },
  },
  {
    name: "leftArm",
    dimensions: { width: 0.25, height: 0.75, depth: 0.25 }, // Bras large
    position: { x: 0.375, y: 1.0, z: 0 },
    pivot: { x: 0, y: 0.375, z: 0 },
  },
  {
    name: "rightLeg",
    dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
    position: { x: -0.125, y: 0.375, z: 0 },
    pivot: { x: 0, y: 0.375, z: 0 },
  },
  {
    name: "leftLeg",
    dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
    position: { x: 0.125, y: 0.375, z: 0 },
    pivot: { x: 0, y: 0.375, z: 0 },
  },
];

/**
 * Template pour un corps féminin (type Alex)
 * - Bras fins (3x12x4 unités = 0.1875x0.75x0.25)
 * - Position des bras ajustée pour s'aligner avec les épaules
 */
export const feminineBodyTemplate: readonly BodyPartTemplate[] = [
  {
    name: "head",
    dimensions: { width: 0.5, height: 0.5, depth: 0.5 },
    position: { x: 0, y: 1.625, z: 0 },
  },
  {
    name: "torso",
    dimensions: { width: 0.5, height: 0.75, depth: 0.25 },
    position: { x: 0, y: 1.0, z: 0 },
  },
  {
    name: "rightArm",
    dimensions: { width: 0.1875, height: 0.75, depth: 0.25 }, // Bras fin
    position: { x: -0.34375, y: 1.0, z: 0 }, // Ajusté pour coller au torse
    pivot: { x: 0, y: 0.375, z: 0 },
  },
  {
    name: "leftArm",
    dimensions: { width: 0.1875, height: 0.75, depth: 0.25 }, // Bras fin
    position: { x: 0.34375, y: 1.0, z: 0 }, // Ajusté pour coller au torse
    pivot: { x: 0, y: 0.375, z: 0 },
  },
  {
    name: "rightLeg",
    dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
    position: { x: -0.125, y: 0.375, z: 0 },
    pivot: { x: 0, y: 0.375, z: 0 },
  },
  {
    name: "leftLeg",
    dimensions: { width: 0.25, height: 0.75, depth: 0.25 },
    position: { x: 0.125, y: 0.375, z: 0 },
    pivot: { x: 0, y: 0.375, z: 0 },
  },
];

/**
 * Récupère le template de corps selon le type
 */
export function getBodyTemplate(bodyType: BodyType): readonly BodyPartTemplate[] {
  switch (bodyType) {
    case "masculine":
      return masculineBodyTemplate;
    case "feminine":
      return feminineBodyTemplate;
    case "custom":
      return []; // Pas de template pour custom
    default:
      return masculineBodyTemplate;
  }
}

/**
 * Helper pour créer une définition de partie du corps à partir d'un template
 */
export function createBodyPartFromTemplate(
  template: BodyPartTemplate,
  textures: BodyPartDefinition["textures"]
): BodyPartDefinition {
  return {
    ...template,
    textures,
  };
}
