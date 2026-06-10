import { Mesh, Scene, Vector3 } from "@babylonjs/core";
import { buildCharacter, getCharacterPhysics } from "~/character-builder";
import { CharacterAnimator } from "~/character-builder";
import {
  buildCharacterPerspectiveSvg,
  type BuildCharacterOptions,
  type CharacterPhysicsController,
  type CharacterSvgRenderOptions,
} from "~/character-builder";
import { alexModel } from "./alex-model";
import { alexAnimations } from "./alex-animations";

/**
 * Crée un personnage Alex avec le système générique
 * @param scene La scène Babylon.js
 * @param position La position du personnage
 * @returns Un objet contenant le mesh et l'animator
 */
export function createAlex(
  scene: Scene,
  position: Vector3,
  buildOptions?: BuildCharacterOptions,
): {
  mesh: Mesh;
  animator: CharacterAnimator;
  physics: CharacterPhysicsController | null;
} {
  // Construire le personnage
  const alexMesh = buildCharacter(scene, alexModel, position, buildOptions);

  // Créer l'animator et charger les animations
  const animator = new CharacterAnimator(alexMesh, scene);
  animator.loadAnimations(alexAnimations);

  const physics = getCharacterPhysics(alexMesh);

  return {
    mesh: alexMesh,
    animator,
    physics,
  };
}

export function createAlexSvg(
  scene: Scene,
  position: Vector3,
  buildOptions?: BuildCharacterOptions,
  svgOptions?: CharacterSvgRenderOptions,
): string {
  return buildCharacterPerspectiveSvg(
    scene,
    alexModel,
    position,
    buildOptions,
    svgOptions,
  );
}
