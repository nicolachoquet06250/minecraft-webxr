import { Mesh, Scene, Vector3 } from "@babylonjs/core";
import { buildCharacter } from "~/character-builder";
import { CharacterAnimator } from "~/character-builder";
import { steveModel } from "./steve-model";
import { steveAnimations } from "./steve-animations";

/**
 * Crée un personnage Steve avec le système générique
 * @param scene La scène Babylon.js
 * @param position La position du personnage
 * @returns Un objet contenant le mesh et l'animator
 */
export function createSteve(scene: Scene, position: Vector3): {
  mesh: Mesh;
  animator: CharacterAnimator;
} {
  // Construire le personnage
  const steveMesh = buildCharacter(scene, steveModel, position);

  // Créer l'animator et charger les animations
  const animator = new CharacterAnimator(steveMesh, scene);
  animator.loadAnimations(steveAnimations);

  return {
    mesh: steveMesh,
    animator,
  };
}
