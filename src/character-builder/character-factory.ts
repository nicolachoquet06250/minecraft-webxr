import type { CharacterModel, BodyPartFaces, ColorPalette, BodyType } from "../character-builder/types";
import { getBodyTemplate, createBodyPartFromTemplate } from "../character-builder/body-templates";

/**
 * Options pour créer un personnage personnalisé
 */
export interface CustomCharacterOptions {
  name: string;
  bodyType: BodyType;
  palette: ColorPalette;
  textures: {
    head: BodyPartFaces;
    torso: BodyPartFaces;
    rightArm: BodyPartFaces;
    leftArm: BodyPartFaces;
    rightLeg: BodyPartFaces;
    leftLeg: BodyPartFaces;
  };
}

/**
 * Crée un personnage personnalisé en utilisant un template de corps
 * @param options Options de configuration du personnage
 * @returns Un modèle de personnage prêt à être construit
 */
export function createCustomCharacter(options: CustomCharacterOptions): CharacterModel {
  const template = getBodyTemplate(options.bodyType);
  
  if (template.length === 0 && options.bodyType === "custom") {
    throw new Error(
      "For 'custom' body type, you must provide complete body part definitions. " +
      "Consider using 'masculine' or 'feminine' as a base instead."
    );
  }

  const bodyParts = template.map((partTemplate) => {
    const textures = options.textures[partTemplate.name as keyof typeof options.textures];
    
    if (!textures) {
      throw new Error(
        `Missing textures for body part: ${partTemplate.name}. ` +
        `Expected one of: ${Object.keys(options.textures).join(", ")}`
      );
    }

    return createBodyPartFromTemplate(partTemplate, textures);
  });

  return {
    name: options.name,
    bodyType: options.bodyType,
    bodyParts,
  };
}

/**
 * Crée un personnage personnalisé de type masculin (bras larges)
 */
export function createMasculineCharacter(
  name: string,
  palette: ColorPalette,
  textures: CustomCharacterOptions["textures"]
): CharacterModel {
  return createCustomCharacter({
    name,
    bodyType: "masculine",
    palette,
    textures,
  });
}

/**
 * Crée un personnage personnalisé de type féminin (bras fins)
 */
export function createFeminineCharacter(
  name: string,
  palette: ColorPalette,
  textures: CustomCharacterOptions["textures"]
): CharacterModel {
  return createCustomCharacter({
    name,
    bodyType: "feminine",
    palette,
    textures,
  });
}
