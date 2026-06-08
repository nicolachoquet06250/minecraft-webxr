import { Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, TextBlock } from "@babylonjs/gui";
import { EYE_HEIGHT } from "./constants";
import { getWorldBlock } from "./functions";
import { isMobileMode } from "./mobile-controls";
import { BlockId, type PlayerPhysics, type WorldChunks } from "./types";

const POINTED_BLOCK_REACH = 3;
const POINTED_BLOCK_STEP = 0.1;

type BlockDisplayName = {
  readonly english: string;
  readonly french: string;
};

type PointedBlockLabelParams = {
  readonly scene: Scene;
  readonly player: PlayerPhysics;
  readonly worldChunks: WorldChunks;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly isVisible: boolean;
};

type PointedBlockLabelControls = {
  readonly update: (params: PointedBlockLabelParams) => void;
};

type TargetBlock = {
  readonly block: BlockId;
};

const BLOCK_DISPLAY_NAMES: Partial<Record<BlockId, BlockDisplayName>> = {
  [BlockId.GrassBlock]: { english: "Grass Block", french: "bloc d'herbe" },
  [BlockId.Dirt]: { english: "Dirt", french: "terre" },
  [BlockId.CoarseDirt]: { english: "Coarse Dirt", french: "terre stérile" },
  [BlockId.Podzol]: { english: "Podzol", french: "podzol" },
  [BlockId.RootedDirt]: { english: "Rooted Dirt", french: "terre racineuse" },
  [BlockId.Stone]: { english: "Stone", french: "pierre" },
  [BlockId.Deepslate]: { english: "Deepslate", french: "ardoise des abîmes" },
  [BlockId.Granite]: { english: "Granite", french: "granite" },
  [BlockId.Diorite]: { english: "Diorite", french: "diorite" },
  [BlockId.Andesite]: { english: "Andesite", french: "andésite" },
  [BlockId.Tuff]: { english: "Tuff", french: "tuf" },
  [BlockId.Calcite]: { english: "Calcite", french: "calcite" },
  [BlockId.Gravel]: { english: "Gravel", french: "gravier" },
  [BlockId.Sand]: { english: "Sand", french: "sable" },
  [BlockId.RedSand]: { english: "Red Sand", french: "sable rouge" },
  [BlockId.Clay]: { english: "Clay", french: "argile" },
  [BlockId.Water]: { english: "Water", french: "eau" },
  [BlockId.Lava]: { english: "Lava", french: "lave" },
  [BlockId.Snow]: { english: "Snow", french: "neige" },
  [BlockId.SnowBlock]: { english: "Snow Block", french: "bloc de neige" },
  [BlockId.Ice]: { english: "Ice", french: "glace" },
  [BlockId.PackedIce]: { english: "Packed Ice", french: "glace compactée" },
  [BlockId.BlueIce]: { english: "Blue Ice", french: "glace bleue" },
  [BlockId.CoalOre]: { english: "Coal Ore", french: "minerai de charbon" },
  [BlockId.IronOre]: { english: "Iron Ore", french: "minerai de fer" },
  [BlockId.CopperOre]: { english: "Copper Ore", french: "minerai de cuivre" },
  [BlockId.GoldOre]: { english: "Gold Ore", french: "minerai d'or" },
  [BlockId.RedstoneOre]: { english: "Redstone Ore", french: "minerai de redstone" },
  [BlockId.LapisOre]: { english: "Lapis Lazuli Ore", french: "minerai de lapis-lazuli" },
  [BlockId.DiamondOre]: { english: "Diamond Ore", french: "minerai de diamant" },
  [BlockId.EmeraldOre]: { english: "Emerald Ore", french: "minerai d'émeraude" },
  [BlockId.DeepslateCoalOre]: { english: "Deepslate Coal Ore", french: "minerai de charbon des abîmes" },
  [BlockId.DeepslateIronOre]: { english: "Deepslate Iron Ore", french: "minerai de fer des abîmes" },
  [BlockId.DeepslateCopperOre]: { english: "Deepslate Copper Ore", french: "minerai de cuivre des abîmes" },
  [BlockId.DeepslateGoldOre]: { english: "Deepslate Gold Ore", french: "minerai d'or des abîmes" },
  [BlockId.DeepslateRedstoneOre]: { english: "Deepslate Redstone Ore", french: "minerai de redstone des abîmes" },
  [BlockId.DeepslateLapisOre]: { english: "Deepslate Lapis Lazuli Ore", french: "minerai de lapis-lazuli des abîmes" },
  [BlockId.DeepslateDiamondOre]: { english: "Deepslate Diamond Ore", french: "minerai de diamant des abîmes" },
  [BlockId.DeepslateEmeraldOre]: { english: "Deepslate Emerald Ore", french: "minerai d'émeraude des abîmes" },
  [BlockId.OakLog]: { english: "Oak Log", french: "bûche de chêne" },
  [BlockId.SpruceLog]: { english: "Spruce Log", french: "bûche de sapin" },
  [BlockId.BirchLog]: { english: "Birch Log", french: "bûche de bouleau" },
  [BlockId.JungleLog]: { english: "Jungle Log", french: "bûche d'acajou" },
  [BlockId.AcaciaLog]: { english: "Acacia Log", french: "bûche d'acacia" },
  [BlockId.DarkOakLog]: { english: "Dark Oak Log", french: "bûche de chêne noir" },
  [BlockId.MangroveLog]: { english: "Mangrove Log", french: "bûche de palétuvier" },
  [BlockId.CherryLog]: { english: "Cherry Log", french: "bûche de cerisier" },
  [BlockId.OakLeaves]: { english: "Oak Leaves", french: "feuilles de chêne" },
  [BlockId.SpruceLeaves]: { english: "Spruce Leaves", french: "feuilles de sapin" },
  [BlockId.BirchLeaves]: { english: "Birch Leaves", french: "feuilles de bouleau" },
  [BlockId.JungleLeaves]: { english: "Jungle Leaves", french: "feuilles d'acajou" },
  [BlockId.AcaciaLeaves]: { english: "Acacia Leaves", french: "feuilles d'acacia" },
  [BlockId.DarkOakLeaves]: { english: "Dark Oak Leaves", french: "feuilles de chêne noir" },
  [BlockId.MangroveLeaves]: { english: "Mangrove Leaves", french: "feuilles de palétuvier" },
  [BlockId.CherryLeaves]: { english: "Cherry Leaves", french: "feuilles de cerisier" },
  [BlockId.OakPlanks]: { english: "Oak Planks", french: "planches de chêne" },
  [BlockId.SprucePlanks]: { english: "Spruce Planks", french: "planches de sapin" },
  [BlockId.BirchPlanks]: { english: "Birch Planks", french: "planches de bouleau" },
  [BlockId.JunglePlanks]: { english: "Jungle Planks", french: "planches d'acajou" },
  [BlockId.AcaciaPlanks]: { english: "Acacia Planks", french: "planches d'acacia" },
  [BlockId.DarkOakPlanks]: { english: "Dark Oak Planks", french: "planches de chêne noir" },
  [BlockId.MangrovePlanks]: { english: "Mangrove Planks", french: "planches de palétuvier" },
  [BlockId.CherryPlanks]: { english: "Cherry Planks", french: "planches de cerisier" },
  [BlockId.Cobblestone]: { english: "Cobblestone", french: "pierres" },
  [BlockId.MossyCobblestone]: { english: "Mossy Cobblestone", french: "pierres moussues" },
  [BlockId.StoneBricks]: { english: "Stone Bricks", french: "briques de pierre" },
  [BlockId.MossyStoneBricks]: { english: "Mossy Stone Bricks", french: "briques de pierre moussues" },
  [BlockId.CrackedStoneBricks]: { english: "Cracked Stone Bricks", french: "briques de pierre craquelées" },
  [BlockId.ChiseledStoneBricks]: { english: "Chiseled Stone Bricks", french: "briques de pierre sculptées" },
  [BlockId.Bricks]: { english: "Bricks", french: "briques" },
  [BlockId.Sandstone]: { english: "Sandstone", french: "grès" },
  [BlockId.RedSandstone]: { english: "Red Sandstone", french: "grès rouge" },
  [BlockId.SmoothStone]: { english: "Smooth Stone", french: "pierre lisse" },
  [BlockId.SmoothSandstone]: { english: "Smooth Sandstone", french: "grès lisse" },
  [BlockId.Netherrack]: { english: "Netherrack", french: "netherrack" },
  [BlockId.SoulSand]: { english: "Soul Sand", french: "sable des âmes" },
  [BlockId.SoulSoil]: { english: "Soul Soil", french: "terre des âmes" },
  [BlockId.Basalt]: { english: "Basalt", french: "basalte" },
  [BlockId.Blackstone]: { english: "Blackstone", french: "pierre noire" },
  [BlockId.MagmaBlock]: { english: "Magma Block", french: "bloc de magma" },
  [BlockId.Glowstone]: { english: "Glowstone", french: "pierre lumineuse" },
  [BlockId.EndStone]: { english: "End Stone", french: "pierre de l'End" },
  [BlockId.EndStoneBricks]: { english: "End Stone Bricks", french: "briques de pierre de l'End" },
  [BlockId.PurpurBlock]: { english: "Purpur Block", french: "bloc de purpur" },
  [BlockId.Grass]: { english: "Grass", french: "herbe" },
  [BlockId.TallGrass]: { english: "Tall Grass", french: "hautes herbes" },
  [BlockId.Fern]: { english: "Fern", french: "fougère" },
  [BlockId.DeadBush]: { english: "Dead Bush", french: "buisson mort" },
  [BlockId.Cactus]: { english: "Cactus", french: "cactus" },
  [BlockId.SugarCane]: { english: "Sugar Cane", french: "canne à sucre" },
  [BlockId.Dandelion]: { english: "Dandelion", french: "pissenlit" },
  [BlockId.Poppy]: { english: "Poppy", french: "coquelicot" },
  [BlockId.BlueOrchid]: { english: "Blue Orchid", french: "orchidée bleue" },
  [BlockId.Allium]: { english: "Allium", french: "allium" },
  [BlockId.AzureBluet]: { english: "Azure Bluet", french: "houstonie bleue" },
  [BlockId.RedTulip]: { english: "Red Tulip", french: "tulipe rouge" },
  [BlockId.OrangeTulip]: { english: "Orange Tulip", french: "tulipe orange" },
  [BlockId.WhiteTulip]: { english: "White Tulip", french: "tulipe blanche" },
  [BlockId.PinkTulip]: { english: "Pink Tulip", french: "tulipe rose" },
  [BlockId.OxeyeDaisy]: { english: "Oxeye Daisy", french: "marguerite" },
  [BlockId.CraftingTable]: { english: "Crafting Table", french: "table de craft" },
  [BlockId.Furnace]: { english: "Furnace", french: "four" },
  [BlockId.Chest]: { english: "Chest", french: "coffre" },
  [BlockId.Torch]: { english: "Torch", french: "torche" },
  [BlockId.Glass]: { english: "Glass", french: "verre" },
  [BlockId.Bookshelf]: { english: "Bookshelf", french: "bibliothèque" },
  [BlockId.WhiteWool]: { english: "White Wool", french: "laine blanche" },
  [BlockId.OrangeWool]: { english: "Orange Wool", french: "laine orange" },
  [BlockId.MagentaWool]: { english: "Magenta Wool", french: "laine magenta" },
  [BlockId.LightBlueWool]: { english: "Light Blue Wool", french: "laine bleu clair" },
  [BlockId.YellowWool]: { english: "Yellow Wool", french: "laine jaune" },
  [BlockId.LimeWool]: { english: "Lime Wool", french: "laine vert clair" },
  [BlockId.PinkWool]: { english: "Pink Wool", french: "laine rose" },
  [BlockId.GrayWool]: { english: "Gray Wool", french: "laine grise" },
  [BlockId.LightGrayWool]: { english: "Light Gray Wool", french: "laine gris clair" },
  [BlockId.CyanWool]: { english: "Cyan Wool", french: "laine cyan" },
  [BlockId.PurpleWool]: { english: "Purple Wool", french: "laine violette" },
  [BlockId.BlueWool]: { english: "Blue Wool", french: "laine bleue" },
  [BlockId.BrownWool]: { english: "Brown Wool", french: "laine marron" },
  [BlockId.GreenWool]: { english: "Green Wool", french: "laine verte" },
  [BlockId.RedWool]: { english: "Red Wool", french: "laine rouge" },
  [BlockId.BlackWool]: { english: "Black Wool", french: "laine noire" },
  [BlockId.DirtGrassPickaxe]: { english: "Dirt Grass Pickaxe", french: "pioche terre/herbe" },
};

export function initializePointedBlockLabel(scene: Scene): PointedBlockLabelControls {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("pointed-block-label-ui", true, scene);
  const isMobile = isMobileMode();

  if (isMobile) {
    ui.renderAtIdealSize = true;
    ui.idealWidth = 1280;
    ui.idealHeight = 720;
  }

  const container = new Rectangle("pointed-block-label-container");
  container.width = isMobile ? "520px" : "420px";
  container.height = isMobile ? "30px" : "26px";
  container.thickness = 1;
  container.cornerRadius = 6;
  container.color = "rgba(255, 255, 255, 0.22)";
  container.background = "rgba(0, 0, 0, 0.46)";
  container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  container.top = isMobile ? "-2px" : "-4px";
  container.isPointerBlocker = false;
  container.isVisible = false;

  const text = new TextBlock("pointed-block-label-text");
  text.color = "white";
  text.fontSize = isMobile ? 18 : 15;
  text.fontWeight = "bold";
  text.text = "";
  text.shadowBlur = 3;
  text.shadowColor = "black";
  text.isPointerBlocker = false;

  container.addControl(text);
  ui.addControl(container);

  return {
    update(params) {
      if (!params.isVisible) {
        container.isVisible = false;
        text.text = "";
        return;
      }

      const target = findPointedBlock(params);

      if (!target) {
        container.isVisible = false;
        text.text = "";
        return;
      }

      const displayName = getBlockDisplayName(target.block);
      text.text = `${displayName.english} / ${displayName.french}`;
      container.isVisible = true;
    },
  };
}

function findPointedBlock(params: PointedBlockLabelParams): TargetBlock | null {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ } = params;
  const ray = scene.createPickingRay(
    scene.getEngine().getRenderWidth() / 2,
    scene.getEngine().getRenderHeight() / 2,
    null,
    scene.activeCamera,
  );
  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const direction = ray.direction.normalize();

  for (let distance = POINTED_BLOCK_STEP; distance <= POINTED_BLOCK_REACH; distance += POINTED_BLOCK_STEP) {
    const point = start.add(direction.scale(distance));
    const block = getWorldBlock(
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      Math.floor(point.x),
      Math.floor(point.y),
      Math.floor(point.z),
    );

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return { block };
    }
  }

  return null;
}

function getBlockDisplayName(block: BlockId): BlockDisplayName {
  const displayName = BLOCK_DISPLAY_NAMES[block];

  if (displayName) {
    return displayName;
  }

  const english = BlockId[block] ?? `Block ${block}`;
  return {
    english,
    french: english,
  };
}
