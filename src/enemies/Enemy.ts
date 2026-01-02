/**
 * Enemy Base Class
 * Base class for all enemy types with health, damage, and state management
 */

import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PhysicsBodyFactory } from '../physics/PhysicsBody';
import { AssetManager } from '../assets/AssetManager';
import { GAME_ASSETS } from '../assets/AssetConfig';
import { Time } from '../core/Time';
import { SoundManager } from '../audio/SoundManager';

export type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'evade' | 'dead';
export type EnemyType = 'grunt' | 'soldier' | 'heavy' | 'sniper';

export interface EnemyStats {
    // Health
    maxHealth: number;
    health: number;

    // Movement
    moveSpeed: number;
    chaseSpeed: number;
    rotationSpeed: number;

    // Combat
    damage: number;
    attackRange: number;
    attackCooldown: number;
    detectionRange: number;
    loseSightRange: number;

    // Ranged combat
    hasRanged: boolean;        // 是否有远程攻击能力
    shootRange: number;         // 射击范围
    shootAccuracy: number;      // 射击精度 (0-1)
    shootCooldown: number;      // 射击冷却时间

    // AI behavior
    evadeSpeed: number;         // 躲避移动速度
    allyAlertRange: number;     // 队友死亡感知范围

    // Points
    scoreValue: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyStats> = {
    grunt: {
        maxHealth: 50,
        health: 50,
        moveSpeed: 10,
        chaseSpeed: 15,
        rotationSpeed: 2,
        damage: 10,
        attackRange: 3,
        attackCooldown: 2.0,
        detectionRange: 15,
        loseSightRange: 25,
        // Ranged combat - 基础敌人有简单射击能力
        hasRanged: true,
        shootRange: 15,
        shootAccuracy: 0.4,
        shootCooldown: 3.0,
        // AI behavior
        evadeSpeed: 8,
        allyAlertRange: 20,
        scoreValue: 100
    },

    soldier: {
        maxHealth: 80,
        health: 80,
        moveSpeed: 12,
        chaseSpeed: 18,
        rotationSpeed: 2.5,
        damage: 15,
        attackRange: 5,
        attackCooldown: 1.5,
        detectionRange: 20,
        loseSightRange: 30,
        // Ranged combat - 士兵有较好的射击能力
        hasRanged: true,
        shootRange: 25,
        shootAccuracy: 0.6,
        shootCooldown: 2.0,
        // AI behavior
        evadeSpeed: 12,
        allyAlertRange: 30,
        scoreValue: 200
    },

    heavy: {
        maxHealth: 200,
        health: 200,
        moveSpeed: 8,
        chaseSpeed: 12,
        rotationSpeed: 1,
        damage: 25,
        attackRange: 4,
        attackCooldown: 2.5,
        detectionRange: 12,
        loseSightRange: 20,
        // Ranged combat - 重装兵射击慢但伤害高
        hasRanged: true,
        shootRange: 20,
        shootAccuracy: 0.5,
        shootCooldown: 4.0,
        // AI behavior - 移动慢
        evadeSpeed: 6,
        allyAlertRange: 25,
        scoreValue: 500
    },

    sniper: {
        maxHealth: 40,
        health: 40,
        moveSpeed: 10,
        chaseSpeed: 12,
        rotationSpeed: 2,
        damage: 35,
        attackRange: 30,
        attackCooldown: 3.0,
        detectionRange: 25,
        loseSightRange: 35,
        // Ranged combat - 狙击手精准但装填慢
        hasRanged: true,
        shootRange: 50,
        shootAccuracy: 0.8,
        shootCooldown: 5.0,
        // AI behavior - 优先躲避
        evadeSpeed: 15,
        allyAlertRange: 40,
        scoreValue: 300
    }
};

export class Enemy {
    public readonly type: EnemyType;
    public readonly stats: EnemyStats;
    public readonly mesh: THREE.Group; // Changed to Group for GLTF models

    private physicsBody: any;
    private state: EnemyState = 'patrol'; // Start in patrol mode instead of idle
    private health: number;
    private isDead: boolean = false;

    // Callbacks
    private onDeathCallback?: (enemy: Enemy) => void;
    private onAttackCallback?: (damage: number) => void;
    private onHurtCallback?: () => void;
    private onShootCallback?: (origin: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
    private onAllyDeathCallback?: (allyPosition: THREE.Vector3) => void;

    // Combat
    private lastAttackTime: number = 0;
    private lastShootTime: number = 0;

    // AI behavior
    private evadeTimer: number = 0;
    private evadeDirection: THREE.Vector3 = new THREE.Vector3();
    private alertedByAlly: boolean = false;
    private lastAlertTime: number = 0;

    // Patrol
    private patrolPoints: THREE.Vector3[] = [];
    private currentPatrolIndex: number = 0;
    private waitTime: number = 0;
    private randomPatrolTarget: THREE.Vector3 | null = null;
    private randomPatrolTimer: number = 0;

    // Asset loading
    private assetManager: AssetManager;

    // Animation
    private mixer: THREE.AnimationMixer | null = null;
    private animations: Map<string, THREE.AnimationClip> = new Map();
    private currentAction: THREE.AnimationAction | null = null;
    private previousState: EnemyState = 'idle';

    // Procedural animation (for models without animations)
    private walkCycleTime: number = 0;
    private modelRoot: THREE.Group | null = null;

    // Footstep audio
    private footstepTimer: number = 0;
    private footstepInterval: number = 0.5;
    private soundManager: SoundManager;

    constructor(
        type: EnemyType,
        position: THREE.Vector3,
        physics: PhysicsWorld,
        scene: THREE.Scene
    ) {
        this.type = type;
        this.stats = { ...ENEMY_CONFIGS[type] };
        this.health = this.stats.maxHealth;
        this.assetManager = AssetManager.getInstance();
        this.soundManager = SoundManager.getInstance();

        // Create mesh group (will contain model or placeholder)
        this.mesh = new THREE.Group();
        this.mesh.position.set(position.x, position.y + 1, position.z); // Y+1 to stand on ground
        scene.add(this.mesh);

        // Try to load model, fall back to placeholder
        this.loadModel();

        // Create physics body
        this.physicsBody = PhysicsBodyFactory.createBox(
            physics,
            { x: 1, y: 2, z: 1 },
            { type: 'dynamic', mass: 50, fixedRotation: true, linearDamping: 0 },
            this.mesh
        );

        // Disable sleep so enemy always responds to velocity changes
        this.physicsBody.body.allowSleep = false;
        this.physicsBody.body.sleepSpeedLimit = -1;

        // Debug: verify physics body was added to world
        console.log(`[Enemy] Created enemy at (${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.y.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`);
        console.log(`[Enemy] Physics body position: (${this.physicsBody.body.position.x.toFixed(1)}, ${this.physicsBody.body.position.y.toFixed(1)}, ${this.physicsBody.body.position.z.toFixed(1)})`);
        console.log(`[Enemy] Physics body in world?`, this.physicsBody.body.world !== undefined);
        console.log(`[Enemy] Total dynamic bodies in world:`, physics.getWorld().bodies.filter((b: any) => b.type === 1 && b.mass > 0).length);
    }

    /**
     * Load enemy model from asset manager
     */
    private async loadModel(): Promise<void> {
        // Find asset config for this enemy type
        const assetConfig = GAME_ASSETS.find(a => a.id === `enemy_${this.type}`) ||
            GAME_ASSETS.find(a => a.id === 'enemy_soldier');

        if (!assetConfig) {
            console.warn(`[Enemy] No asset config found for ${this.type}`);
            this.createPlaceholder();
            return;
        }

        try {
            // Always load fresh copy
            const gltf = await this.assetManager.loadAsset(assetConfig);

            if (gltf && gltf.scene) {
                // Deep clone the scene manually
                const clonedScene = this.deepCloneGltf(gltf.scene);

                // Use attachModel to setup mesh, animations, and scaling
                const animations = gltf.animations || [];
                this.attachModel(clonedScene, animations);

                // Rotate model 180 degrees to face forward (common GLTF issue)
                if (this.modelRoot) {
                    this.modelRoot.rotation.y = Math.PI;
                }

                // Load weapon
                await this.loadWeapon();
            } else {
                console.warn(`[Enemy] Failed to load GLTF scene for ${this.type}`);
                this.createPlaceholder();
            }
        } catch (error) {
            console.error(`[Enemy] Error loading model for ${this.type}:`, error);
            this.createPlaceholder();
        }
    }

    /**
     * Load and attach weapon (Rifle)
     */
    private async loadWeapon(): Promise<void> {
        if (!this.modelRoot) return;

        // Find RightForeArm bone
        let attachmentBone: THREE.Bone | null = null;
        this.modelRoot.traverse((child) => {
            if (child instanceof THREE.Bone) {
                if (child.name.includes('RightForeArm') || child.name.includes('forearm.R')) {
                    attachmentBone = child;
                }
            }
        });

        if (!attachmentBone) {
            console.warn('[Enemy] RightForeArm bone not found for weapon attachment');
            return;
        }

        // Load rifle asset
        const weaponConfig = GAME_ASSETS.find(a => a.id === 'weapon_smg'); // Same asset as player's rifle
        if (!weaponConfig) return;

        try {
            const gltf = await this.assetManager.loadAsset(weaponConfig);
            if (gltf && gltf.scene) {
                const weaponModel = gltf.scene.clone();

                // Apply calibration data (Rifle - Forearm)
                // Offset: (-0.02, 0.05, 0.00)
                // Rot: (1.60, 0.60, -2.45)
                // Scale: 0.042
                weaponModel.position.set(-0.02, 0.05, 0.00);
                weaponModel.rotation.set(1.60, 0.60, -2.45);
                weaponModel.scale.setScalar(0.042);

                // Attach to bone
                attachmentBone.add(weaponModel);

                // Enable shadows and clone materials for weapon
                weaponModel.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // Clone materials to avoid sharing
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(mat => mat.clone());
                            } else {
                                child.material = child.material.clone();
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('[Enemy] Failed to load weapon:', error);
        }
    }
    private deepCloneGltf(source: THREE.Object3D): THREE.Object3D {
        // First, collect all bones from original source by name
        const originalBonesByName = new Map<string, THREE.Bone>();
        source.traverse((child) => {
            if (child instanceof THREE.Bone) {
                originalBonesByName.set(child.name, child as THREE.Bone);
            }
        });

        // Clone the entire scene
        const clone = source.clone();

        // Collect cloned bones by name
        const clonedBonesByName = new Map<string, THREE.Bone>();
        clone.traverse((child) => {
            if (child instanceof THREE.Bone) {
                clonedBonesByName.set(child.name, child as THREE.Bone);
            }
        });

        // Handle SkinnedMesh - update skeleton to use cloned bones
        clone.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
                const skinnedMesh = child as THREE.SkinnedMesh;
                const originalSkeleton = skinnedMesh.skeleton;

                if (originalSkeleton) {
                    // Map original bones to cloned bones by name
                    const clonedBones = originalSkeleton.bones.map(bone => {
                        return clonedBonesByName.get(bone.name) || bone;
                    });

                    // Create new skeleton with cloned bones
                    skinnedMesh.skeleton = new THREE.Skeleton(clonedBones, originalSkeleton.boneInverses);

                    // Update bind matrix
                    skinnedMesh.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix);
                }
            }

            // Clone materials
            if (child instanceof THREE.Mesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(mat => mat.clone());
                    } else {
                        mesh.material = mesh.material.clone();
                    }
                }
            }
        });

        return clone;
    }

    /**
     * Attach loaded model to mesh
     */
    private attachModel(model: THREE.Group | THREE.Object3D, animations: THREE.AnimationClip[] = []): void {
        this.modelRoot = model as THREE.Group;

        // Clear existing children
        while (this.mesh.children.length > 0) {
            const child = this.mesh.children[0];
            this.mesh.remove(child);
        }

        this.mesh.add(model);

        // Setup animation mixer and clips
        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);

            // Store animations by name for easy access
            for (const clip of animations) {
                this.animations.set(clip.name, clip);
            }

            // Play idle animation by default if available
            this.playAnimation('idle', true);
        }

        // Update skeleton matrices before calculating bounding box
        model.updateMatrixWorld(true);

        // Force update all SkinnedMesh bones
        model.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
                const skinnedMesh = child as THREE.SkinnedMesh;
                skinnedMesh.updateMatrixWorld(true);
            }
        });

        // Calculate bounding box for scale
        const tempBox = new THREE.Box3().setFromObject(model);
        const tempSize = new THREE.Vector3();
        tempBox.getSize(tempSize);

        // Determine scale - target height ~2.0 units
        const modelHeight = tempSize.y;
        const targetScale = modelHeight > 0 ? 2.0 / modelHeight : 1;

        // Apply scale to model
        model.scale.setScalar(targetScale);

        // Update matrices after scale
        model.updateMatrix();
        model.updateMatrixWorld(true);

        // Force update all SkinnedMesh bones and matrices
        model.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
                const skinnedMesh = child as THREE.SkinnedMesh;
                skinnedMesh.updateMatrixWorld(true);
            }
        });

        // Recalculate bounding box after scaling to position model on ground
        const scaledBox = new THREE.Box3().setFromObject(model);
        const minY = scaledBox.min.y;
        const _maxY = scaledBox.max.y;

        // Position model so its bottom is at y=0 (on the ground)
        // For SkinnedMesh, the bounding box may not reflect actual feet position
        // Reduced offset to prevent model from sinking into ground
        const groundOffset = 0.0; // No extra offset, let -minY handle the positioning
        model.position.set(0, -minY - groundOffset, 0);
        model.rotation.set(0, 0, 0);

        // Keep original materials, just ensure visibility and shadows
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.visible = true;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.mesh.add(model);

        // Save model root reference for procedural animation
        this.modelRoot = model;
    }

    /**
     * Get model bounding box for debugging
     */
    private _getBoundingBox(model: THREE.Object3D): { size: THREE.Vector3, center: THREE.Vector3 } {
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        return { size, center };
    }

    /**
     * Create placeholder geometry (fallback)
     */
    private createPlaceholder(): void {
        // Clear existing children
        while (this.mesh.children.length > 0) {
            const child = this.mesh.children[0];
            this.mesh.remove(child);
        }

        const geometry = new THREE.CapsuleGeometry(0.5, 1.5, 8, 16);
        const material = new THREE.MeshStandardMaterial({
            color: this.getEnemyColor(this.type),
            roughness: 0.7,
            metalness: 0.3
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.mesh.add(mesh);
    }

    private getEnemyColor(type: EnemyType): number {
        switch (type) {
            case 'grunt': return 0xff4444;
            case 'soldier': return 0xff6644;
            case 'heavy': return 0xff0000;
            case 'sniper': return 0xffaa44;
            default: return 0xff4444;
        }
    }

    /**
     * Play animation by name
     */
    private playAnimation(name: string, loop: boolean = false): void {
        if (!this.mixer) return;

        // First, try to find animation by exact name
        let clip = this.animations.get(name);

        // If not found, try common variations
        if (!clip) {
            const variations = this.getAnimationVariations(name);
            for (const variation of variations) {
                if (this.animations.has(variation)) {
                    clip = this.animations.get(variation);
                    break;
                }
            }
        }

        // If still not found, try fuzzy matching (contains the keyword)
        if (!clip) {
            for (const [animName, animClip] of this.animations) {
                const animNameLower = animName.toLowerCase();
                const nameLower = name.toLowerCase();

                // Match: idle, walk, run, attack/shoot
                if ((nameLower === 'idle' && (animNameLower.includes('idle'))) ||
                    (nameLower === 'walk' && (animNameLower.includes('walk'))) ||
                    (nameLower === 'run' && (animNameLower.includes('run'))) ||
                    (nameLower === 'attack' && (animNameLower.includes('shoot') || animNameLower.includes('attack')))) {
                    clip = animClip;
                    break;
                }
            }
        }

        if (!clip) {
            return;
        }

        // Fade out current action if exists
        if (this.currentAction) {
            this.currentAction.fadeOut(0.2);
        }

        // Create and play new action
        const action = this.mixer.clipAction(clip);
        action.reset();
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        action.clampWhenFinished = !loop;
        action.fadeIn(0.2);
        action.play();

        this.currentAction = action;
    }

    /**
     * Get common animation name variations
     */
    private getAnimationVariations(baseName: string): string[] {
        const variations: Record<string, string[]> = {
            'idle': ['Idle', 'idle_', 'Stand', 'stand', 'Breathing', 'breathing'],
            'walk': ['Walk', 'walk_', 'Walking', 'walking', 'Run', 'run_', 'Running', 'running'],
            'run': ['Run', 'run_', 'Running', 'running', 'Sprint', 'sprint'],
            'attack': ['Attack', 'attack_', 'Hit', 'hit_', 'Strike', 'strike', 'Shoot', 'shoot_', 'Shooting', 'shooting']
        };

        return variations[baseName] || [];
    }

    /**
     * Update animation based on state
     */
    private updateAnimation(): void {
        // If we have animation mixer with clips, use it
        if (this.mixer && this.animations.size > 0) {
            // Only switch animation if state changed
            if (this.state !== this.previousState) {
                switch (this.state) {
                    case 'idle':
                        this.playAnimation('idle', true);
                        break;
                    case 'patrol':
                        this.playAnimation('walk', true);
                        break;
                    case 'chase':
                        this.playAnimation('run', true);
                        break;
                    case 'attack':
                        this.playAnimation('attack', false);
                        break;
                    case 'evade':
                        this.playAnimation('run', true); // Use run animation for evading
                        break;
                }
                this.previousState = this.state;
            }
        }
        // No fallback to procedural animation - use models with animations
    }

    /**
     * Update procedural animation (simple bob/bounce when moving)
     */
    private _updateProceduralAnimation(): void {
        if (!this.modelRoot || this.isDead) return;

        const isMoving = this.state === 'chase' || this.state === 'patrol';

        if (isMoving) {
            // Increment walk cycle
            this.walkCycleTime += 0.15;

            // Bob up and down to simulate walking
            const bobAmount = 0.08;
            const bobOffset = Math.sin(this.walkCycleTime * Math.PI * 2) * bobAmount;

            // Slight forward/backward tilt
            const tiltAmount = 0.03;
            const tiltOffset = Math.cos(this.walkCycleTime * Math.PI * 2) * tiltAmount;

            // Get original position (first time)
            if (!this.modelRoot.userData.originalY) {
                this.modelRoot.userData.originalY = this.modelRoot.position.y;
            }
            const originalY = this.modelRoot.userData.originalY;

            // Apply bobbing motion
            this.modelRoot.position.y = originalY + bobOffset;
            this.modelRoot.rotation.x = tiltOffset;

            // Add slight side-to-side sway
            this.modelRoot.rotation.z = Math.sin(this.walkCycleTime * Math.PI) * 0.02;
        } else {
            // Return to idle pose
            if (this.modelRoot.userData.originalY !== undefined) {
                this.modelRoot.position.y = this.modelRoot.userData.originalY;
            }
            this.modelRoot.rotation.x = 0;
            this.modelRoot.rotation.z = 0;

            // Slowly reset walk cycle
            this.walkCycleTime *= 0.9;
        }
    }

    /**
     * Update enemy
     */
    update(deltaTime: number, playerPosition: THREE.Vector3): void {
        if (this.isDead) return;

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
            this.updateAnimation();
        }

        // Update state based on player proximity
        this.updateState(deltaTime, playerPosition);

        // Execute state behavior
        switch (this.state) {
            case 'idle':
                this.updateIdle(deltaTime);
                break;
            case 'patrol':
                this.updatePatrol(deltaTime);
                break;
            case 'chase':
                this.updateChase(deltaTime, playerPosition);
                break;
            case 'attack':
                this.updateAttack(deltaTime, playerPosition);
                break;
            case 'evade':
                this.updateEvade(deltaTime, playerPosition);
                break;
        }

        // Sync physics body with mesh
        this.physicsBody.update();
    }

    /**
     * Update AI state based on player position
     */
    private updateState(deltaTime: number, playerPosition: THREE.Vector3): void {
        const distance = this.mesh.position.distanceTo(playerPosition);
        const time = performance.now() / 1000;

        switch (this.state) {
            case 'idle':
            case 'patrol':
                // Detect player
                if (distance < this.stats.detectionRange || this.alertedByAlly) {
                    this.state = 'chase';
                    // console.log(`[Enemy] ${this.type} detected player at distance ${distance.toFixed(1)}`);
                }
                break;

            case 'chase':
                // Check if can shoot (ranged attack)
                if (this.stats.hasRanged && distance <= this.stats.shootRange && this.canShoot()) {
                    this.shootAtPlayer(playerPosition);
                }
                // Check if in melee attack range
                if (distance < this.stats.attackRange) {
                    this.state = 'attack';
                }
                // Lose sight of player
                else if (distance > this.stats.loseSightRange) {
                    this.state = 'patrol';
                }
                break;

            case 'attack':
                // Player out of range
                if (distance > this.stats.attackRange * 1.5) {
                    this.state = 'chase';
                }
                break;

            case 'evade':
                // Update evade timer
                this.evadeTimer -= deltaTime;
                if (this.evadeTimer <= 0) {
                    // After evading, switch to chase or attack based on distance
                    if (distance < this.stats.attackRange) {
                        this.state = 'attack';
                    } else {
                        this.state = 'chase';
                    }
                }
                // Still try to shoot while evading if possible
                if (this.stats.hasRanged && distance <= this.stats.shootRange && this.canShoot()) {
                    this.shootAtPlayer(playerPosition);
                }
                break;
        }

        // Clear alerted status after a while
        if (this.alertedByAlly && time - this.lastAlertTime > 10) {
            this.alertedByAlly = false;
        }
    }

    /**
     * Idle state
     */
    private updateIdle(_deltaTime: number): void {
        // Do nothing, wait for player detection
    }

    /**
     * Patrol state
     */
    private updatePatrol(deltaTime: number): void {
        // If patrol points are set, use them
        if (this.patrolPoints.length > 0) {
            const targetPoint = this.patrolPoints[this.currentPatrolIndex];
            const currentPos = new THREE.Vector3(
                this.physicsBody.body.position.x,
                this.physicsBody.body.position.y,
                this.physicsBody.body.position.z
            );
            const direction = new THREE.Vector3()
                .subVectors(targetPoint, currentPos)
                .normalize();

            const distance = currentPos.distanceTo(targetPoint);

            // Slow down when approaching target
            let actualSpeed = this.stats.moveSpeed;
            if (distance < 3) {
                actualSpeed = this.stats.moveSpeed * (distance / 3);
            }

            this.move(direction, actualSpeed);
            this.faceTarget(targetPoint);

            // Check if reached patrol point
            if (distance < 0.5) {
                this.waitTime += deltaTime;
                if (this.waitTime > 2) {
                    this.waitTime = 0;
                    this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
                }
            }
            return;
        }

        // Random patrol when no patrol points set
        this.randomPatrolTimer -= deltaTime;

        // Pick a new random target
        if (!this.randomPatrolTarget || this.randomPatrolTimer <= 0) {
            const currentPos = new THREE.Vector3(
                this.physicsBody.body.position.x,
                this.physicsBody.body.position.y,
                this.physicsBody.body.position.z
            );
            const randomAngle = Math.random() * Math.PI * 2;
            const randomDistance = 5 + Math.random() * 10; // 5-15 units away

            this.randomPatrolTarget = new THREE.Vector3(
                currentPos.x + Math.cos(randomAngle) * randomDistance,
                currentPos.y,
                currentPos.z + Math.sin(randomAngle) * randomDistance
            );
            this.randomPatrolTimer = 3 + Math.random() * 4; // Move for 3-7 seconds
        }

        // Move towards random target
        const currentPos = new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y,
            this.physicsBody.body.position.z
        );
        const direction = new THREE.Vector3()
            .subVectors(this.randomPatrolTarget, currentPos)
            .normalize();

        const distance = currentPos.distanceTo(this.randomPatrolTarget);

        // Use full moveSpeed for patrol (no 0.5x reduction)
        let actualSpeed = this.stats.moveSpeed;
        if (distance < 3) {
            actualSpeed = this.stats.moveSpeed * (distance / 3);
        }

        this.move(direction, actualSpeed);
        this.faceTarget(this.randomPatrolTarget);

        // Check if reached target
        if (distance < 0.5) {
            this.randomPatrolTarget = null;
            this.randomPatrolTimer = 1 + Math.random() * 2; // Wait 1-3 seconds before moving again
        }
    }

    /**
     * Chase state
     */
    private updateChase(_deltaTime: number, playerPosition: THREE.Vector3): void {
        const currentPos = new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y,
            this.physicsBody.body.position.z
        );
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, currentPos)
            .normalize();

        const distance = currentPos.distanceTo(playerPosition);

        // Slow down when approaching attack range
        let actualSpeed = this.stats.chaseSpeed;
        if (distance < this.stats.attackRange * 1.5) {
            actualSpeed = this.stats.chaseSpeed * (distance / (this.stats.attackRange * 1.5));
        }

        this.move(direction, actualSpeed);

        // Face player
        this.faceTarget(playerPosition);
    }

    /**
     * Attack state
     */
    private updateAttack(_deltaTime: number, playerPosition: THREE.Vector3): void {
        // Face player
        this.faceTarget(playerPosition);

        // Stop movement when attacking
        this.physicsBody.body.velocity.set(0, 0, 0);

        // Check if can attack (melee)
        const time = performance.now() / 1000;
        if (time - this.lastAttackTime >= this.stats.attackCooldown) {
            this.attack(playerPosition);
            this.lastAttackTime = time;
        }

        // Also try to shoot if has ranged capability and in range
        if (this.stats.hasRanged) {
            const distance = this.mesh.position.distanceTo(playerPosition);
            if (distance <= this.stats.shootRange && this.canShoot()) {
                this.shootAtPlayer(playerPosition);
            }
        }
    }

    /**
     * Evade state - move away from danger while trying to shoot
     */
    private updateEvade(deltaTime: number, playerPosition: THREE.Vector3): void {
        // Calculate evade direction (perpendicular to player direction)
        const toPlayer = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).normalize();
        const evadeDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();

        // If this is the first frame of evade, pick a random perpendicular direction
        if (this.evadeDirection.length() === 0) {
            if (Math.random() > 0.5) {
                evadeDir.negate();
            }
            this.evadeDirection.copy(evadeDir);
        }

        // Move in evade direction
        this.move(this.evadeDirection, this.stats.evadeSpeed);

        // Face player while evading (to shoot)
        this.faceTarget(playerPosition);
    }

    /**
     * Check if enemy can shoot (cooldown check)
     */
    private canShoot(): boolean {
        const time = performance.now() / 1000;
        return time - this.lastShootTime >= this.stats.shootCooldown;
    }

    /**
     * Shoot at player position
     */
    private shootAtPlayer(playerPosition: THREE.Vector3): void {
        this.lastShootTime = performance.now() / 1000;

        // Calculate direction to player
        const origin = this.mesh.position.clone();
        origin.y += 1.5; // Shoot from chest height
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, origin)
            .normalize();

        // Apply accuracy (add some randomness)
        if (this.stats.shootAccuracy < 1.0) {
            const accuracyError = (1 - this.stats.shootAccuracy) * 0.5; // Max error
            direction.x += (Math.random() - 0.5) * accuracyError;
            direction.y += (Math.random() - 0.5) * accuracyError;
            direction.z += (Math.random() - 0.5) * accuracyError;
            direction.normalize();
        }

        // Call shoot callback to create projectile
        if (this.onShootCallback) {
            this.onShootCallback(origin, direction, this.stats.damage);
        }

        // Play shoot sound
        this.soundManager.play('pistol_shot'); // Using pistol sound for now
    }

    /**
     * Move enemy - using physics simulation
     */
    private move(direction: THREE.Vector3, speed: number): void {
        // Wake up the physics body so it responds to velocity changes
        this.physicsBody.body.wakeUp();

        // Set velocity to let physics engine handle movement
        const vx = direction.x * speed;
        const vz = direction.z * speed;
        this.physicsBody.body.velocity.set(vx, 0, vz);

        // CRITICAL: Keep enemy at ground level by counteracting gravity
        // Physics engine gravity (-9.82) will pull enemy down, so we need to keep Y position stable
        const targetY = 1; // Ground level + half height
        if (Math.abs(this.physicsBody.body.position.y - targetY) > 0.1) {
            this.physicsBody.body.position.y = targetY;
            this.physicsBody.body.velocity.y = 0;
        }

        // 更新脚步声计时器
        const deltaTime = Time.deltaTime;
        this.footstepTimer += deltaTime;
        if (this.footstepTimer >= this.footstepInterval) {
            this.soundManager.play('enemy_footstep');
            this.footstepTimer = 0;
        }
    }


    /**
     * Face target
     */
    private faceTarget(target: THREE.Vector3): void {
        const direction = new THREE.Vector3()
            .subVectors(target, this.mesh.position)
            .setY(0)
            .normalize();

        if (direction.length() > 0.01 && this.modelRoot) {
            const angle = Math.atan2(direction.x, direction.z);
            this.modelRoot.rotation.y = angle;
        }
    }

    /**
     * Attack player
     */
    private attack(_playerPosition: THREE.Vector3): void {
        // Call attack callback to damage player
        if (this.onAttackCallback) {
            this.onAttackCallback(this.stats.damage);
        }
    }

    /**
     * Set on attack callback
     */
    setOnAttack(callback: (damage: number) => void): void {
        this.onAttackCallback = callback;
    }

    /**
     * Set on hurt callback
     */
    setOnHurt(callback: () => void): void {
        this.onHurtCallback = callback;
    }

    /**
     * Set on shoot callback (for ranged attacks)
     */
    setOnShoot(callback: (origin: THREE.Vector3, direction: THREE.Vector3, damage: number) => void): void {
        this.onShootCallback = callback;
    }

    /**
     * Set on ally death callback (for team awareness)
     */
    setOnAllyDeath(callback: (allyPosition: THREE.Vector3) => void): void {
        this.onAllyDeathCallback = callback;
    }

    /**
     * Notify this enemy that an ally died nearby
     */
    notifyAllyDeath(allyPosition: THREE.Vector3): void {
        const distance = this.mesh.position.distanceTo(allyPosition);
        if (distance <= this.stats.allyAlertRange && !this.isDead) {
            this.alertedByAlly = true;
            this.lastAlertTime = performance.now() / 1000;
            // Switch to chase or evade state based on distance to player
            this.state = 'evade';
            this.evadeTimer = 2 + Math.random() * 2; // 躲避2-4秒
            console.log(`[Enemy] ${this.type} alerted by ally death at distance ${distance.toFixed(1)}`);
        }
    }

    /**
     * Take damage
     */
    takeDamage(amount: number): void {
        if (this.isDead) return;

        this.health -= amount;

        if (this.health <= 0) {
            this.die();
        } else {
            // Call hurt callback
            if (this.onHurtCallback) {
                this.onHurtCallback();
            }

            // Flash red on hit
            this.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const material = child.material;
                    // Check if material supports emissive (MeshStandardMaterial, MeshPhongMaterial, etc.)
                    if ('emissive' in material) {
                        const mat = material as THREE.MeshStandardMaterial;
                        mat.emissive = new THREE.Color(0xff0000);
                        setTimeout(() => {
                            if (!this.isDead && mat.emissive) {
                                mat.emissive = new THREE.Color(0x000000);
                            }
                        }, 100);
                    }
                }
            });
        }
    }

    /**
     * Die
     */
    private die(): void {
        this.isDead = true;
        this.state = 'dead';

        // Change appearance - darken all meshes
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const material = child.material;
                // Check if material has color property
                if ('color' in material) {
                    material.color.setHex(0x333333);
                }
            }
        });

        // Ragdoll effect - fall over
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.position.y = 0.1;

        // Call death callback
        if (this.onDeathCallback) {
            this.onDeathCallback(this);
        }
    }

    /**
     * Set on death callback
     */
    setOnDeath(callback: (enemy: Enemy) => void): void {
        this.onDeathCallback = callback;
    }

    /**
     * Set patrol points
     */
    setPatrolPoints(points: THREE.Vector3[]): void {
        this.patrolPoints = points;
        this.currentPatrolIndex = 0;
    }

    /**
     * Get state
     */
    getState(): EnemyState {
        return this.state;
    }

    /**
     * Get health percentage
     */
    getHealthPercentage(): number {
        return this.health / this.stats.maxHealth;
    }

    /**
     * Check if dead
     */
    isEnemyDead(): boolean {
        return this.isDead;
    }

    /**
     * Get position
     */
    getPosition(): THREE.Vector3 {
        return new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y,
            this.physicsBody.body.position.z
        );
    }

    /**
     * Dispose
     */
    dispose(): void {
        // Stop and cleanup animation mixer
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }

        // Remove mesh from scene
        this.mesh.parent?.remove(this.mesh);

        // Dispose all geometries and materials in the group
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        // Remove physics body from world (access world through body)
        if (this.physicsBody.body.world) {
            this.physicsBody.body.world.removeBody(this.physicsBody.body);
        }
    }
}
