import {
  Mesh,
  Scene,
  Color3,
  VertexData,
  StandardMaterial,
  DynamicTexture,
  MultiMaterial,
  SubMesh,
} from "@babylonjs/core";

/**
 * Crée un mesh cuboïde avec des textures différentes sur chaque face
 * @param scene La scène Babylon.js
 * @param name Le nom du mesh
 * @param width Largeur du cuboïde
 * @param height Hauteur du cuboïde
 * @param depth Profondeur du cuboïde
 * @param textures Les 6 textures pour chaque face
 * @returns Le mesh créé
 */
export function createCuboidMesh(
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

  // Front face (Z+)
  positions.push(-w, -h, d, w, -h, d, w, h, d, -w, h, d);
  uvs.push(1, 0, 0, 0, 0, 1, 1, 1);
  indices.push(0, 2, 1, 0, 3, 2);

  // Back face (Z-)
  positions.push(w, -h, -d, -w, -h, -d, -w, h, -d, w, h, -d);
  uvs.push(1, 0, 0, 0, 0, 1, 1, 1);
  indices.push(4, 6, 5, 4, 7, 6);

  // Top face (Y+)
  positions.push(-w, h, -d, w, h, -d, w, h, d, -w, h, d);
  uvs.push(1, 1, 0, 1, 0, 0, 1, 0);
  indices.push(8, 10, 9, 8, 11, 10);

  // Bottom face (Y-)
  positions.push(-w, -h, d, w, -h, d, w, -h, -d, -w, -h, -d);
  uvs.push(1, 1, 0, 1, 0, 0, 1, 0);
  indices.push(12, 13, 14, 12, 14, 15);

  // Right face (X+)
  positions.push(w, -h, d, w, -h, -d, w, h, -d, w, h, d);
  uvs.push(1, 0, 0, 0, 0, 1, 1, 1);
  indices.push(16, 18, 17, 16, 19, 18);

  // Left face (X-)
  positions.push(-w, -h, -d, -w, -h, d, -w, h, d, -w, h, -d);
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
  const faceTextures = [
    textures.front,
    textures.back,
    textures.top,
    textures.bottom,
    textures.right,
    textures.left,
  ];

  for (let i = 0; i < 6; i++) {
    const mat = new StandardMaterial(`${name}_mat_${i}`, scene);
    mat.diffuseTexture = faceTextures[i];
    mat.specularColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false;
    multiMat.subMaterials.push(mat);
  }

  mesh.material = multiMat;

  // Définir les SubMeshes (6 faces, chacune avec 2 triangles = 6 indices)
  mesh.subMeshes = [];
  for (let i = 0; i < 6; i++) {
    new SubMesh(i, 0, 24, i * 6, 6, mesh);
  }

  return mesh;
}
