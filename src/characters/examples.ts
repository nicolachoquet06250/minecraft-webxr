/**
 * Exemples d'utilisation du système de construction de personnages
 * avec support masculin/féminin
 */

import { Scene, Vector3 } from "@babylonjs/core";
import { createSteve, createAlex } from "../characters";
import {
    createMasculineCharacter,
    createFeminineCharacter,
    buildCharacter,
    CharacterAnimator, type ColorPalette,
} from "~/character-builder";

/**
 * Exemple 1 : Créer Steve et Alex côte à côte
 */
export function example1_steveAndAlex(scene: Scene) {
  // Steve (masculin)
  const { mesh: steve, animator: steveAnim } = createSteve(
    scene,
    new Vector3(-1, 0, 0)
  );
  steveAnim.play("walk");

  // Alex (féminin)
  const { mesh: alex, animator: alexAnim } = createAlex(
    scene,
    new Vector3(1, 0, 0)
  );
  alexAnim.play("walk");

  return { steve, alex, steveAnim, alexAnim };
}

/**
 * Exemple 2 : Créer un guerrier personnalisé (masculin)
 */
export async function example2_customWarrior(scene: Scene) {
  // Palette personnalisée (rouge et noir)
  const warriorPalette = {
    // Cheveux noirs
    A: [0.05, 0.05, 0.05, 1],
    B: [0.10, 0.10, 0.10, 1],
    C: [0.15, 0.15, 0.15, 1],
    D: [0.20, 0.20, 0.20, 1],

    // Peau
    E: [0.50, 0.30, 0.20, 1],
    F: [0.65, 0.42, 0.28, 1],
    G: [0.78, 0.54, 0.38, 1],
    H: [0.88, 0.64, 0.46, 1],
    I: [0.95, 0.74, 0.56, 1],

    // Visage
    J: [0.98, 0.96, 0.92, 1],
    K: [0.22, 0.15, 0.72, 1],
    L: [0.32, 0.16, 0.10, 1],
    M: [0.50, 0.24, 0.16, 1],

    // Armure rouge
    N: [0.60, 0.05, 0.05, 1],
    O: [0.75, 0.10, 0.10, 1],
    P: [0.85, 0.20, 0.20, 1],
    Q: [0.95, 0.30, 0.30, 1],
    R: [0.45, 0.05, 0.05, 1],

    // Pantalon noir
    S: [0.15, 0.15, 0.15, 1],
    T: [0.20, 0.20, 0.20, 1],
    U: [0.25, 0.25, 0.25, 1],
    V: [0.10, 0.10, 0.10, 1],

    // Bottes
    W: [0.25, 0.25, 0.25, 1],
    X: [0.35, 0.35, 0.35, 1],
    Y: [0.45, 0.45, 0.45, 1],
    Z: [0.15, 0.15, 0.15, 1],
  };

  // Note: Vous devriez définir vos propres textures ici
  // Pour cet exemple, on réutilise les textures de Steve
  const { steveModelTextures } = await import("./steve-color-matrices.ts");

  const warriorTextures = {
    head: steveModelTextures.head,
    torso: steveModelTextures.torso,
    rightArm: steveModelTextures.rightArm,
    leftArm: steveModelTextures.leftArm,
    rightLeg: steveModelTextures.rightLeg,
    leftLeg: steveModelTextures.leftLeg,
  };

  // Créer le personnage masculin
  const warriorModel = createMasculineCharacter(
    "warrior",
    warriorPalette as unknown as ColorPalette,
    warriorTextures
  );

  // Construire dans la scène
  const warriorMesh = buildCharacter(scene, warriorModel, new Vector3(0, 0, 0));

  // Créer l'animator
  const { steveAnimations } = await import("../characters/steve-animations");
  const animator = new CharacterAnimator(warriorMesh, scene);
  animator.loadAnimations(steveAnimations);
  animator.play("mine");

  return { mesh: warriorMesh, animator };
}

/**
 * Exemple 3 : Créer une mage personnalisée (féminin)
 */
export async function example3_customMage(scene: Scene) {
  // Palette personnalisée (violet et bleu)
  const magePalette = {
    // Cheveux violets
    A: [0.30, 0.10, 0.40, 1],
    B: [0.40, 0.15, 0.50, 1],
    C: [0.50, 0.20, 0.60, 1],
    D: [0.60, 0.30, 0.70, 1],

    // Peau
    E: [0.50, 0.30, 0.20, 1],
    F: [0.65, 0.42, 0.28, 1],
    G: [0.78, 0.54, 0.38, 1],
    H: [0.88, 0.64, 0.46, 1],
    I: [0.95, 0.74, 0.56, 1],

    // Visage
    J: [0.98, 0.96, 0.92, 1],
    K: [0.40, 0.20, 0.80, 1], // Yeux violets
    L: [0.32, 0.16, 0.10, 1],
    M: [0.50, 0.24, 0.16, 1],

    // Robe bleue
    N: [0.10, 0.20, 0.60, 1],
    O: [0.15, 0.30, 0.70, 1],
    P: [0.20, 0.40, 0.80, 1],
    Q: [0.30, 0.50, 0.90, 1],
    R: [0.05, 0.15, 0.45, 1],

    // Pantalon bleu foncé
    S: [0.10, 0.15, 0.35, 1],
    T: [0.15, 0.20, 0.45, 1],
    U: [0.20, 0.25, 0.55, 1],
    V: [0.05, 0.10, 0.25, 1],

    // Chaussures
    W: [0.20, 0.20, 0.30, 1],
    X: [0.30, 0.30, 0.40, 1],
    Y: [0.40, 0.40, 0.50, 1],
    Z: [0.10, 0.10, 0.20, 1],
  };

  // Note: Vous devriez définir vos propres textures ici
  const { alexModelTextures } = await import("../characters/alex-color-matrices.ts");

  const mageTextures = {
    head: alexModelTextures.head,
    torso: alexModelTextures.torso,
    rightArm: alexModelTextures.rightArm,
    leftArm: alexModelTextures.leftArm,
    rightLeg: alexModelTextures.rightLeg,
    leftLeg: alexModelTextures.leftLeg,
  };

  // Créer le personnage féminin
  const mageModel = createFeminineCharacter(
      "mage",
      magePalette as unknown as ColorPalette,
      mageTextures
  );

  // Construire dans la scène
  const mageMesh = buildCharacter(scene, mageModel, new Vector3(2, 0, 0));

  // Créer l'animator
  const { alexAnimations } = await import("../characters/alex-animations");
  const animator = new CharacterAnimator(mageMesh, scene);
  animator.loadAnimations(alexAnimations);
  animator.play("idle");

  return { mesh: mageMesh, animator };
}

/**
 * Exemple 4 : Créer plusieurs personnages avec différentes animations
 */
export function example4_multipleCharacters(scene: Scene) {
  const characters = [];

  // Steve qui marche
  const steve = createSteve(scene, new Vector3(-2, 0, 0));
  steve.animator.play("walk");
  characters.push(steve);

  // Alex qui mine
  const alex = createAlex(scene, new Vector3(0, 0, 0));
  alex.animator.play("mine");
  characters.push(alex);

  // Steve 2 en idle
  const steve2 = createSteve(scene, new Vector3(2, 0, 0));
  steve2.animator.play("idle");
  characters.push(steve2);

  return characters;
}

/**
 * Exemple 5 : Comparer les types de corps
 */
export function example5_compareBodyTypes(scene: Scene) {
  // Créer Steve (masculin - bras larges)
  const { mesh: steve } = createSteve(scene, new Vector3(-1.5, 0, 0));

  // Créer Alex (féminin - bras fins)
  const { mesh: alex } = createAlex(scene, new Vector3(1.5, 0, 0));

  // Les placer côte à côte pour comparaison
  console.log("Steve (masculin) - Bras larges (0.25 unités)");
  console.log("Alex (féminin) - Bras fins (0.1875 unités)");

  return { steve, alex };
}
