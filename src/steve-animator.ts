import { Mesh, Scene, Animation, AnimationGroup, Vector3 } from "@babylonjs/core";

export interface SteveBodyParts {
  steve: Mesh;
  head: Mesh;
  torso: Mesh;
  rightArm: Mesh;
  leftArm: Mesh;
  rightLeg: Mesh;
  leftLeg: Mesh;
}

export class SteveAnimator {
  private bodyParts: SteveBodyParts;
  private scene: Scene;
  private animationGroups: Map<string, AnimationGroup> = new Map();
  private currentAnimation: AnimationGroup | null = null;

  constructor(steve: Mesh, scene: Scene) {
    this.scene = scene;
    
    // Récupérer toutes les parties du corps
    this.bodyParts = {
      steve,
      head: steve.getChildMeshes().find(m => m.name === "steve_head") as Mesh,
      torso: steve.getChildMeshes().find(m => m.name === "steve_torso") as Mesh,
      rightArm: steve.getChildMeshes().find(m => m.name === "steve_rightArm") as Mesh,
      leftArm: steve.getChildMeshes().find(m => m.name === "steve_leftArm") as Mesh,
      rightLeg: steve.getChildMeshes().find(m => m.name === "steve_rightLeg") as Mesh,
      leftLeg: steve.getChildMeshes().find(m => m.name === "steve_leftLeg") as Mesh,
    };

    // Créer les animations
    this.createWalkAnimation();
    this.createMineAnimation();
    this.createIdleAnimation();
  }

  private createWalkAnimation(): void {
    const animGroup = new AnimationGroup("walk", this.scene);
    const fps = 30;
    const cycleDuration = 0.6; // durée d'un cycle de marche en secondes
    const frames = fps * cycleDuration;

    // Animation des bras (balancement opposé aux jambes)
    const rightArmSwing = new Animation(
      "rightArmSwing",
      "rotation.x",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    rightArmSwing.setKeys([
      { frame: 0, value: -0.5 },
      { frame: frames / 2, value: 0.5 },
      { frame: frames, value: -0.5 },
    ]);
    this.bodyParts.rightArm.animations.push(rightArmSwing);
    animGroup.addTargetedAnimation(rightArmSwing, this.bodyParts.rightArm);

    const leftArmSwing = new Animation(
      "leftArmSwing",
      "rotation.x",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    leftArmSwing.setKeys([
      { frame: 0, value: 0.5 },
      { frame: frames / 2, value: -0.5 },
      { frame: frames, value: 0.5 },
    ]);
    this.bodyParts.leftArm.animations.push(leftArmSwing);
    animGroup.addTargetedAnimation(leftArmSwing, this.bodyParts.leftArm);

    // Animation des jambes
    const rightLegSwing = new Animation(
      "rightLegSwing",
      "rotation.x",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    rightLegSwing.setKeys([
      { frame: 0, value: 0.5 },
      { frame: frames / 2, value: -0.5 },
      { frame: frames, value: 0.5 },
    ]);
    this.bodyParts.rightLeg.animations.push(rightLegSwing);
    animGroup.addTargetedAnimation(rightLegSwing, this.bodyParts.rightLeg);

    const leftLegSwing = new Animation(
      "leftLegSwing",
      "rotation.x",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    leftLegSwing.setKeys([
      { frame: 0, value: -0.5 },
      { frame: frames / 2, value: 0.5 },
      { frame: frames, value: -0.5 },
    ]);
    this.bodyParts.leftLeg.animations.push(leftLegSwing);
    animGroup.addTargetedAnimation(leftLegSwing, this.bodyParts.leftLeg);

    this.animationGroups.set("walk", animGroup);
  }

  private createMineAnimation(): void {
    const animGroup = new AnimationGroup("mine", this.scene);
    const fps = 30;
    const cycleDuration = 0.5; // cycle de minage rapide
    const frames = fps * cycleDuration;

    // Animation du bras droit qui mine
    const rightArmMine = new Animation(
      "rightArmMine",
      "rotation.x",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    rightArmMine.setKeys([
      { frame: 0, value: -1.2 },        // Bras levé
      { frame: frames / 2, value: 0.3 }, // Bras baissé (frappe)
      { frame: frames, value: -1.2 },    // Retour
    ]);
    this.bodyParts.rightArm.animations.push(rightArmMine);
    animGroup.addTargetedAnimation(rightArmMine, this.bodyParts.rightArm);

    // Légère rotation du bras gauche pour équilibre
    const leftArmMine = new Animation(
      "leftArmMine",
      "rotation.x",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    leftArmMine.setKeys([
      { frame: 0, value: 0.2 },
      { frame: frames / 2, value: -0.1 },
      { frame: frames, value: 0.2 },
    ]);
    this.bodyParts.leftArm.animations.push(leftArmMine);
    animGroup.addTargetedAnimation(leftArmMine, this.bodyParts.leftArm);

    // Légère rotation du torse pour plus de réalisme
    const torsoMine = new Animation(
      "torsoMine",
      "rotation.z",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    torsoMine.setKeys([
      { frame: 0, value: 0 },
      { frame: frames / 2, value: 0.05 },
      { frame: frames, value: 0 },
    ]);
    this.bodyParts.torso.animations.push(torsoMine);
    animGroup.addTargetedAnimation(torsoMine, this.bodyParts.torso);

    this.animationGroups.set("mine", animGroup);
  }

  private createIdleAnimation(): void {
    const animGroup = new AnimationGroup("idle", this.scene);
    const fps = 30;
    const cycleDuration = 2; // respiration lente
    const frames = fps * cycleDuration;

    // Légère animation de respiration
    const torsoBreath = new Animation(
      "torsoBreath",
      "position.y",
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    torsoBreath.setKeys([
      { frame: 0, value: 1.0 },
      { frame: frames / 2, value: 1.01 },
      { frame: frames, value: 1.0 },
    ]);
    this.bodyParts.torso.animations.push(torsoBreath);
    animGroup.addTargetedAnimation(torsoBreath, this.bodyParts.torso);

    this.animationGroups.set("idle", animGroup);
  }

  /**
   * Joue une animation
   * @param animationName Le nom de l'animation ("walk", "mine", "idle")
   * @param loop Si l'animation doit boucler (par défaut: true)
   * @param speed La vitesse de l'animation (par défaut: 1.0)
   */
  play(animationName: string, loop: boolean = true, speed: number = 1.0): void {
    const animGroup = this.animationGroups.get(animationName);
    
    if (!animGroup) {
      console.warn(`Animation "${animationName}" not found`);
      return;
    }

    // Arrêter l'animation actuelle
    if (this.currentAnimation && this.currentAnimation !== animGroup) {
      this.currentAnimation.stop();
      this.resetPose();
    }

    // Jouer la nouvelle animation
    animGroup.play(loop);
    animGroup.speedRatio = speed;
    this.currentAnimation = animGroup;
  }

  /**
   * Arrête l'animation en cours
   */
  stop(): void {
    if (this.currentAnimation) {
      this.currentAnimation.stop();
      this.currentAnimation = null;
      this.resetPose();
    }
  }

  /**
   * Réinitialise la pose par défaut
   */
  private resetPose(): void {
    this.bodyParts.rightArm.rotation = Vector3.Zero();
    this.bodyParts.leftArm.rotation = Vector3.Zero();
    this.bodyParts.rightLeg.rotation = Vector3.Zero();
    this.bodyParts.leftLeg.rotation = Vector3.Zero();
    this.bodyParts.torso.rotation = Vector3.Zero();
    this.bodyParts.torso.position = new Vector3(0, 1.0, 0);
  }

  /**
   * Retourne le nom de l'animation en cours
   */
  getCurrentAnimation(): string | null {
    if (!this.currentAnimation) return null;
    
    for (const [name, group] of this.animationGroups.entries()) {
      if (group === this.currentAnimation) return name;
    }
    
    return null;
  }

  /**
   * Libère les ressources
   */
  dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups.clear();
  }
}
