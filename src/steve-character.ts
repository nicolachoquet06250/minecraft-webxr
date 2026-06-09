import { Mesh, Scene, Color3, Vector3, VertexData, StandardMaterial, DynamicTexture, MultiMaterial, SubMesh } from "@babylonjs/core";
import { steveModelTextures, type SteveTextureDefinition } from "./steve-color-matrices";

function createTextureFromMatrix(scene: Scene, name: string, textureData: SteveTextureDefinition): DynamicTexture {
  const { width, height, matrix, palette } = textureData;
  
  const scale = 16;
  const texture = new DynamicTexture(name, { width: width * scale, height: height * scale }, scene, false);
  const ctx = texture.getContext();
  
  for (let y = 0; y < height; y++) {
    const row = matrix[y];
    for (let x = 0; x < width; x++) {
      const char = row[x];
      const color = palette[char as keyof typeof palette];
      
      ctx.fillStyle = `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(color[2] * 255)}, ${color[3]})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  
  texture.update();
  texture.hasAlpha = false;
  texture.updateSamplingMode(1); // Nearest neighbor pour effet pixelisé
  return texture;
}

function createCuboidMesh(
  scene: Scene,
  name: string,
  width: number,
  height: number,
  depth: number,
  textures: {
    front: DynamicTexture;
    back: DynamicTexture;
    top: DynamicTexture;
    bottom: DynamicTexture;
    right: DynamicTexture;
    left: DynamicTexture;
  }
): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;

  // Front face (Z+) - visible de devant
  positions.push(
    -w, -h, d,  // 0
    w, -h, d,   // 1
    w, h, d,    // 2
    -w, h, d    // 3
  );
  uvs.push(1, 0, 0, 0, 0, 1, 1, 1);
  indices.push(0, 2, 1, 0, 3, 2);

  // Back face (Z-) - visible de derrière
  positions.push(
    w, -h, -d,   // 4
    -w, -h, -d,  // 5
    -w, h, -d,   // 6
    w, h, -d     // 7
  );
  uvs.push(1, 0, 0, 0, 0, 1, 1, 1);
  indices.push(4, 6, 5, 4, 7, 6);

  // Top face (Y+) - visible du dessus
  positions.push(
    -w, h, -d,  // 8
    w, h, -d,   // 9
    w, h, d,    // 10
    -w, h, d    // 11
  );
  uvs.push(1, 1, 0, 1, 0, 0, 1, 0);
  indices.push(8, 10, 9, 8, 11, 10);

  // Bottom face (Y-) - visible du dessous
  positions.push(
    -w, -h, d,   // 12
    w, -h, d,    // 13
    w, -h, -d,   // 14
    -w, -h, -d   // 15
  );
  uvs.push(1, 1, 0, 1, 0, 0, 1, 0);
  indices.push(12, 13, 14, 12, 14, 15);

  // Right face (X+) - visible de droite
  positions.push(
    w, -h, d,    // 16
    w, -h, -d,   // 17
    w, h, -d,    // 18
    w, h, d      // 19
  );
  uvs.push(1, 0, 0, 0, 0, 1, 1, 1);
  indices.push(16, 18, 17, 16, 19, 18);

  // Left face (X-) - visible de gauche
  positions.push(
    -w, -h, -d,  // 20
    -w, -h, d,   // 21
    -w, h, d,    // 22
    -w, h, -d    // 23
  );
  uvs.push(1, 0, 0, 0, 0, 1, 1, 1);
  indices.push(20, 22, 21, 20, 23, 22);

  const mesh = new Mesh(name, scene);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.uvs = uvs;

  VertexData.ComputeNormals(positions, indices, normals);
  vertexData.normals = normals;

  vertexData.applyToMesh(mesh);

  // Créer un MultiMaterial avec 6 matériaux
  const multiMat = new MultiMaterial(name + "_multiMat", scene);
  const faceTextures = [textures.front, textures.back, textures.top, textures.bottom, textures.right, textures.left];
  
  for (let i = 0; i < 6; i++) {
    const mat = new StandardMaterial(`${name}_mat_${i}`, scene);
    mat.diffuseTexture = faceTextures[i];
    mat.specularColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false; // Désactiver pour voir toutes les faces
    multiMat.subMaterials.push(mat);
  }

  mesh.material = multiMat;

  // Définir les SubMeshes (6 faces, chacune avec 2 triangles = 6 indices)
  mesh.subMeshes = [];
  for (let i = 0; i < 6; i++) {
    new SubMesh(i, 0, 24, i * 6, 6, mesh);
  }

  // Debug: afficher les submeshes
  console.log(`${name}: Created ${mesh.subMeshes.length} submeshes with ${multiMat.subMaterials.length} materials`);

  return mesh;
}

export function createSteveCharacter(scene: Scene, position: Vector3): Mesh {
  const steve = new Mesh("steve", scene);
  steve.position = position;

  // Créer les textures pour la tête
  const headTextures = {
    front: createTextureFromMatrix(scene, "head_front", steveModelTextures.head.front),
    back: createTextureFromMatrix(scene, "head_back", steveModelTextures.head.back),
    top: createTextureFromMatrix(scene, "head_top", steveModelTextures.head.top),
    bottom: createTextureFromMatrix(scene, "head_bottom", steveModelTextures.head.bottom),
    right: createTextureFromMatrix(scene, "head_right", steveModelTextures.head.right),
    left: createTextureFromMatrix(scene, "head_left", steveModelTextures.head.left),
  };

  // Tête (8x8x8 unités Minecraft = 0.5x0.5x0.5 unités jeu)
  const head = createCuboidMesh(scene, "steve_head", 0.5, 0.5, 0.5, headTextures);
  head.position = new Vector3(0, 1.625, 0); // 1.75 - 0.125 pour centrer à mi-hauteur
  head.parent = steve;

  // Créer les textures pour le torse
  const torsoTextures = {
    front: createTextureFromMatrix(scene, "torso_front", steveModelTextures.torso.front),
    back: createTextureFromMatrix(scene, "torso_back", steveModelTextures.torso.back),
    top: createTextureFromMatrix(scene, "torso_top", steveModelTextures.torso.top),
    bottom: createTextureFromMatrix(scene, "torso_bottom", steveModelTextures.torso.bottom),
    right: createTextureFromMatrix(scene, "torso_right", steveModelTextures.torso.right),
    left: createTextureFromMatrix(scene, "torso_left", steveModelTextures.torso.left),
  };

  // Torse (8x12x4 unités = 0.5x0.75x0.25)
  const torso = createCuboidMesh(scene, "steve_torso", 0.5, 0.75, 0.25, torsoTextures);
  torso.position = new Vector3(0, 1.0, 0); // Centre du torse
  torso.parent = steve;

  // Créer les textures pour le bras droit
  const rightArmTextures = {
    front: createTextureFromMatrix(scene, "rightArm_front", steveModelTextures.rightArm.front),
    back: createTextureFromMatrix(scene, "rightArm_back", steveModelTextures.rightArm.back),
    top: createTextureFromMatrix(scene, "rightArm_top", steveModelTextures.rightArm.top),
    bottom: createTextureFromMatrix(scene, "rightArm_bottom", steveModelTextures.rightArm.bottom),
    right: createTextureFromMatrix(scene, "rightArm_right", steveModelTextures.rightArm.right),
    left: createTextureFromMatrix(scene, "rightArm_left", steveModelTextures.rightArm.left),
  };

  // Bras droit (4x12x4 = 0.25x0.75x0.25)
  const rightArm = createCuboidMesh(scene, "steve_rightArm", 0.25, 0.75, 0.25, rightArmTextures);
  rightArm.setPivotPoint(new Vector3(0, 0.375, 0)); // Pivot en haut du bras (épaule)
  rightArm.position = new Vector3(-0.375, 1.0, 0);
  rightArm.parent = steve;

  // Créer les textures pour le bras gauche
  const leftArmTextures = {
    front: createTextureFromMatrix(scene, "leftArm_front", steveModelTextures.leftArm.front),
    back: createTextureFromMatrix(scene, "leftArm_back", steveModelTextures.leftArm.back),
    top: createTextureFromMatrix(scene, "leftArm_top", steveModelTextures.leftArm.top),
    bottom: createTextureFromMatrix(scene, "leftArm_bottom", steveModelTextures.leftArm.bottom),
    right: createTextureFromMatrix(scene, "leftArm_right", steveModelTextures.leftArm.right),
    left: createTextureFromMatrix(scene, "leftArm_left", steveModelTextures.leftArm.left),
  };

  // Bras gauche
  const leftArm = createCuboidMesh(scene, "steve_leftArm", 0.25, 0.75, 0.25, leftArmTextures);
  leftArm.setPivotPoint(new Vector3(0, 0.375, 0)); // Pivot en haut du bras (épaule)
  leftArm.position = new Vector3(0.375, 1.0, 0);
  leftArm.parent = steve;

  // Créer les textures pour la jambe droite
  const rightLegTextures = {
    front: createTextureFromMatrix(scene, "rightLeg_front", steveModelTextures.rightLeg.front),
    back: createTextureFromMatrix(scene, "rightLeg_back", steveModelTextures.rightLeg.back),
    top: createTextureFromMatrix(scene, "rightLeg_top", steveModelTextures.rightLeg.top),
    bottom: createTextureFromMatrix(scene, "rightLeg_bottom", steveModelTextures.rightLeg.bottom),
    right: createTextureFromMatrix(scene, "rightLeg_right", steveModelTextures.rightLeg.right),
    left: createTextureFromMatrix(scene, "rightLeg_left", steveModelTextures.rightLeg.left),
  };

  // Jambe droite (4x12x4 = 0.25x0.75x0.25)
  const rightLeg = createCuboidMesh(scene, "steve_rightLeg", 0.25, 0.75, 0.25, rightLegTextures);
  rightLeg.setPivotPoint(new Vector3(0, 0.375, 0)); // Pivot en haut de la jambe (hanche)
  rightLeg.position = new Vector3(-0.125, 0.375, 0);
  rightLeg.parent = steve;

  // Créer les textures pour la jambe gauche
  const leftLegTextures = {
    front: createTextureFromMatrix(scene, "leftLeg_front", steveModelTextures.leftLeg.front),
    back: createTextureFromMatrix(scene, "leftLeg_back", steveModelTextures.leftLeg.back),
    top: createTextureFromMatrix(scene, "leftLeg_top", steveModelTextures.leftLeg.top),
    bottom: createTextureFromMatrix(scene, "leftLeg_bottom", steveModelTextures.leftLeg.bottom),
    right: createTextureFromMatrix(scene, "leftLeg_right", steveModelTextures.leftLeg.right),
    left: createTextureFromMatrix(scene, "leftLeg_left", steveModelTextures.leftLeg.left),
  };

  // Jambe gauche
  const leftLeg = createCuboidMesh(scene, "steve_leftLeg", 0.25, 0.75, 0.25, leftLegTextures);
  leftLeg.setPivotPoint(new Vector3(0, 0.375, 0)); // Pivot en haut de la jambe (hanche)
  leftLeg.position = new Vector3(0.125, 0.375, 0);
  leftLeg.parent = steve;

  return steve;
}
