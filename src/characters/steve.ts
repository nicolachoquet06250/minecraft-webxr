import { Mesh, Scene, Vector3 } from "@babylonjs/core";
import {
  buildCharacter,
  buildCharacterPerspectiveSvg,
  getCharacterPhysics,
} from "~/character-builder";
import { CharacterAnimator } from "~/character-builder";
import type {
  BuildCharacterOptions,
  CharacterPhysicsController,
  CharacterSvgRenderOptions,
} from "~/character-builder";
import { steveModel } from "./steve-model";
import { steveAnimations } from "./steve-animations";

/**
 * Crée un personnage Steve avec le système générique
 * @param scene La scène Babylon.js
 * @param position La position du personnage
 * @returns Un objet contenant le mesh et l'animator
 */
export function createSteve(
  scene: Scene,
  position: Vector3,
  buildOptions?: BuildCharacterOptions,
): {
  mesh: Mesh;
  animator: CharacterAnimator;
  physics: CharacterPhysicsController | null;
} {
  // Construire le personnage
  const steveMesh = buildCharacter(scene, steveModel, position, buildOptions);

  // Créer l'animator et charger les animations
  const animator = new CharacterAnimator(steveMesh, scene);
  animator.loadAnimations(steveAnimations);

  const physics = getCharacterPhysics(steveMesh);

  return {
    mesh: steveMesh,
    animator,
    physics,
  };
}

export function createSteveSvg(
  scene: Scene,
  position: Vector3,
  buildOptions?: BuildCharacterOptions,
  svgOptions?: CharacterSvgRenderOptions,
): string {
  return buildCharacterPerspectiveSvg(
    scene,
    steveModel,
    position,
    buildOptions,
    svgOptions,
  );
}
