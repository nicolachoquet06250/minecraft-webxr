/**
 * Système générique de construction de personnages cubiques
 * Permet de créer des personnages type Minecraft avec des parties du corps définies par des matrices de couleur
 */

export type ColorPalette = {
  readonly [key: string]: readonly [number, number, number, number];
};

export type TextureMatrix = {
  readonly palette: ColorPalette;
  readonly width: number;
  readonly height: number;
  readonly matrix: readonly string[];
};

export type BodyPartFaces = {
  readonly front: TextureMatrix;
  readonly back: TextureMatrix;
  readonly top: TextureMatrix;
  readonly bottom: TextureMatrix;
  readonly left: TextureMatrix;
  readonly right: TextureMatrix;
};

export type BodyPartDimensions = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
};

export type BodyPartPosition = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type BodyPartPivot = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type BodyPartDefinition = {
  readonly name: string;
  readonly dimensions: BodyPartDimensions;
  readonly position: BodyPartPosition;
  readonly pivot?: BodyPartPivot;
  readonly textures: BodyPartFaces;
  readonly parent?: string; // nom de la partie parente
};

export type BodyType = "masculine" | "feminine" | "custom";

export type CharacterModel = {
  readonly name: string;
  readonly bodyType: BodyType;
  readonly bodyParts: readonly BodyPartDefinition[];
};

export type AnimationKeyframe = {
  readonly frame: number;
  readonly value: number;
};

export type AnimationDefinition = {
  readonly name: string;
  readonly targetPart: string;
  readonly property: "rotation.x" | "rotation.y" | "rotation.z" | "position.x" | "position.y" | "position.z";
  readonly keyframes: readonly AnimationKeyframe[];
};

export type AnimationGroup = {
  readonly name: string;
  readonly fps: number;
  readonly duration: number; // en secondes
  readonly loop: boolean;
  readonly animations: readonly AnimationDefinition[];
};

export type CharacterAnimations = {
  readonly [animationName: string]: AnimationGroup;
};
