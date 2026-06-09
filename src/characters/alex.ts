import { Mesh, Scene, Vector3 } from "@babylonjs/core";
import { buildCharacter } from "~/character-builder";
import { CharacterAnimator } from "~/character-builder";
import { alexModel } from "./alex-model";
import { alexAnimations } from "./alex-animations";

/**
 * Crée un personnage Alex avec le système générique
 * @param scene La scène Babylon.js
 * @param position La position du personnage
 * @returns Un objet contenant le mesh et l'animator
 */
export function createAlex(scene: Scene, position: Vector3): {
  mesh: Mesh;
  animator: CharacterAnimator;
} {
  // Construire le personnage
  const alexMesh = buildCharacter(scene, alexModel, position);

  // Créer l'animator et charger les animations
  const animator = new CharacterAnimator(alexMesh, scene);
  animator.loadAnimations(alexAnimations);

  return {
    mesh: alexMesh,
    animator,
  };
}
