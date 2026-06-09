import { Mesh, Scene, Vector3 } from "@babylonjs/core";
import type { CharacterModel } from "./types";
import { createTextureFromMatrix } from "./texture-builder";
import { createCuboidMesh } from "./mesh-builder";

/**
 * Construit un personnage à partir d'un modèle de personnage
 * @param scene La scène Babylon.js
 * @param model Le modèle de personnage
 * @param position La position du personnage dans la scène
 * @returns Le mesh racine du personnage
 */
export function buildCharacter(
  scene: Scene,
  model: CharacterModel,
  position: Vector3
): Mesh {
  const rootMesh = new Mesh(model.name, scene);
  rootMesh.position = position;

  const meshMap = new Map<string, Mesh>();
  meshMap.set(model.name, rootMesh);

  // Créer toutes les parties du corps
  for (const bodyPart of model.bodyParts) {
    // Créer les textures pour chaque face
    const textures = {
      front: createTextureFromMatrix(
        scene,
        `${model.name}_${bodyPart.name}_front`,
        bodyPart.textures.front
      ),
      back: createTextureFromMatrix(
        scene,
        `${model.name}_${bodyPart.name}_back`,
        bodyPart.textures.back
      ),
      top: createTextureFromMatrix(
        scene,
        `${model.name}_${bodyPart.name}_top`,
        bodyPart.textures.top
      ),
      bottom: createTextureFromMatrix(
        scene,
        `${model.name}_${bodyPart.name}_bottom`,
        bodyPart.textures.bottom
      ),
      right: createTextureFromMatrix(
        scene,
        `${model.name}_${bodyPart.name}_right`,
        bodyPart.textures.right
      ),
      left: createTextureFromMatrix(
        scene,
        `${model.name}_${bodyPart.name}_left`,
        bodyPart.textures.left
      ),
    };

    // Créer le mesh de la partie du corps
    const partMesh = createCuboidMesh(
      scene,
      `${model.name}_${bodyPart.name}`,
      bodyPart.dimensions.width,
      bodyPart.dimensions.height,
      bodyPart.dimensions.depth,
      textures
    );

    // Définir le pivot si spécifié
    if (bodyPart.pivot) {
      partMesh.setPivotPoint(
        new Vector3(bodyPart.pivot.x, bodyPart.pivot.y, bodyPart.pivot.z)
      );
    }

    // Positionner la partie
    partMesh.position = new Vector3(
      bodyPart.position.x,
      bodyPart.position.y,
      bodyPart.position.z
    );

    // Attacher au parent (rootMesh par défaut ou partie spécifique)
    const parent = bodyPart.parent
      ? meshMap.get(bodyPart.parent)
      : rootMesh;
    
    if (parent) {
      partMesh.parent = parent;
    } else {
      console.warn(
        `Parent "${bodyPart.parent}" not found for body part "${bodyPart.name}"`
      );
      partMesh.parent = rootMesh;
    }

    meshMap.set(bodyPart.name, partMesh);
  }

  return rootMesh;
}

/**
 * Récupère une partie du corps d'un personnage par son nom
 * @param characterMesh Le mesh racine du personnage
 * @param partName Le nom de la partie du corps
 * @returns Le mesh de la partie ou undefined si non trouvé
 */
export function getBodyPart(
  characterMesh: Mesh,
  partName: string
): Mesh | undefined {
  return characterMesh
    .getChildMeshes()
    .find((m) => m.name.endsWith(`_${partName}`)) as Mesh | undefined;
}

/**
 * Récupère toutes les parties du corps d'un personnage
 * @param characterMesh Le mesh racine du personnage
 * @returns Un Map des parties du corps par nom
 */
export function getAllBodyParts(characterMesh: Mesh): Map<string, Mesh> {
  const parts = new Map<string, Mesh>();
  const namePrefix = characterMesh.name + "_";

  for (const child of characterMesh.getChildMeshes()) {
    if (child.name.startsWith(namePrefix)) {
      const partName = child.name.substring(namePrefix.length);
      parts.set(partName, child as Mesh);
    }
  }

  return parts;
}
