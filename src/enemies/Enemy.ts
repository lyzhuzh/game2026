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

export type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'evade' | 'retreat' | 'cover' | 'dead';
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

    // Ranged Combat
    shootRange: number;         // 射击范围

    // Survival Intelligence
    retreatHealthThreshold: number;  // 低血撤退阈值 (0-1, 30% = 0.3)
    retreatDuration: number;         // 撤退持续时间(秒)

    // Sound Perception
    hearingRange: number;            // 听力范围(米)
    investigationDuration: number;   // 调查声音持续时间(秒)

    // Points
    scoreValue: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyStats> = {
    grunt: {
        maxHealth: 50,
        health: 50,
        moveSpeed: 10,  // 2 -> 10 (faster movement)
        chaseSpeed: 15,  // 4 -> 15
        rotationSpeed: 2,
        damage: 10,
        attackRange: 3,
        attackCooldown: 2.0,
        detectionRange: 15,
        loseSightRange: 25,
        // Ranged combat - 基础敌人射程较短
        shootRange: 25,  // detectionRange + 10
        // Survival Intelligence - 基础敌人血少，容易撤退
        retreatHealthThreshold: 0.4,  // 40% 血量撤退
        retreatDuration: 3,            // 撤退3秒
        // Sound Perception - 基础敌人听力一般
        hearingRange: 40,              // 40米听力范围
        investigationDuration: 5,      // 调查5秒
        scoreValue: 100
    },

    soldier: {
        maxHealth: 80,
        health: 80,
        moveSpeed: 12,  // 2.5 -> 12
        chaseSpeed: 18,  // 5 -> 18
        rotationSpeed: 2.5,
        damage: 15,
        attackRange: 5,
        attackCooldown: 1.5,
        detectionRange: 20,
        loseSightRange: 30,
        // Ranged combat - 士兵射程中等
        shootRange: 30,  // detectionRange + 10
        // Survival Intelligence - 士兵中等生存能力
        retreatHealthThreshold: 0.3,  // 30% 血量撤退
        retreatDuration: 4,            // 撤退4秒
        // Sound Perception - 士兵听力较好
        hearingRange: 50,              // 50米听力范围
        investigationDuration: 6,      // 调查6秒
        scoreValue: 200
    },

    heavy: {
        maxHealth: 200,
        health: 200,
        moveSpeed: 8,  // 1.5 -> 8
        chaseSpeed: 12,  // 3 -> 12
        rotationSpeed: 1,
        damage: 25,
        attackRange: 4,
        attackCooldown: 2.5,
        detectionRange: 12,
        loseSightRange: 20,
        // Ranged combat - 重装敌人射程中等
        shootRange: 22,  // detectionRange + 10
        // Survival Intelligence - 重装兵血厚，不易撤退
        retreatHealthThreshold: 0.2,  // 20% 血量撤退
        retreatDuration: 2,            // 撤退2秒
        // Sound Perception - 重装兵听力差（重装备影响）
        hearingRange: 30,              // 30米听力范围
        investigationDuration: 4,      // 调查4秒
        scoreValue: 500
    },

    sniper: {
        maxHealth: 40,
        health: 40,
        moveSpeed: 10,  // 2 -> 10
        chaseSpeed: 12,  // 3 -> 12
        rotationSpeed: 2,
        damage: 35,
        attackRange: 30,
        attackCooldown: 3.0,
        detectionRange: 25,
        loseSightRange: 35,
        // Ranged combat - 狙击手射程最远
        shootRange: 50,  // detectionRange + 10 (狙击手特殊配置，更远的射程)
        // Survival Intelligence - 狙击手血少，容易撤退，撤退时间长
        retreatHealthThreshold: 0.5,  // 50% 血量撤退
        retreatDuration: 5,            // 撤退5秒
        // Sound Perception - 狙击手听力最好（专注）
        hearingRange: 60,              // 60米听力范围
        investigationDuration: 8,      // 调查8秒
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

    // Combat
    private lastAttackTime: number = 0;

    // Team Awareness
    private alertedByAlly: boolean = false;
    private lastAlertTime: number = 0;

    // Evade behavior
    private evadeTimer: number = 0;
    private evadeDirection: THREE.Vector3 = new THREE.Vector3();

    // Retreat behavior
    private retreatTimer: number = 0;

    // Sound investigation
    private investigatingSound: boolean = false;
    private soundPosition: THREE.Vector3 | null = null;
    private investigationTimer: number = 0;

    // Cover behavior
    private seekingCover: boolean = false;
    private coverPosition: THREE.Vector3 | null = null;
    private inCover: boolean = false;
    private coverTimer: number = 0;
    private availableCovers: any[] = []; // Will be set from EnemyManager

    // Ranged Combat
    private lastShootTime: number = 0;
    private onShootCallback?: (origin: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;

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

                // Extract animations if available
                const animations = gltf.animations || [];
                this.attachModel(clonedScene as THREE.Group, animations);
            } else {
                this.createPlaceholder();
            }
        } catch (error) {
            console.warn(`[Enemy] Failed to load model for ${this.type}:`, error);
            this.createPlaceholder();
        }
    }

    /**
     * Deep clone GLTF scene with materials and skeleton support
     */
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
            if ((child as any).isSkinnedMesh) {
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
    private attachModel(model: THREE.Group, animations: THREE.AnimationClip[] = []): void {
        // Clear existing children
        while (this.mesh.children.length > 0) {
            const child = this.mesh.children[0];
            this.mesh.remove(child);
        }

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
            if ((child as any).isSkinnedMesh) {
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
            if ((child as any).isSkinnedMesh) {
                const skinnedMesh = child as THREE.SkinnedMesh;
                skinnedMesh.updateMatrixWorld(true);
            }
        });

        // Recalculate bounding box after scaling to position model on ground
        const scaledBox = new THREE.Box3().setFromObject(model);
        const minY = scaledBox.min.y;
        const maxY = scaledBox.max.y;

        // Position model so its bottom is at y=0 (on the ground)
        // For SkinnedMesh, the bounding box may not reflect actual feet position
        // Add significant offset to push model down to ground
        const groundOffset = 1.0; // Extra offset to push model down
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
    private getBoundingBox(model: THREE.Object3D): { size: THREE.Vector3, center: THREE.Vector3 } {
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
                    case 'retreat':
                        this.playAnimation('run', true); // Use run animation for retreating
                        break;
                    case 'cover':
                        // Use run when moving to cover, idle when in cover
                        if (this.seekingCover) {
                            this.playAnimation('run', true);
                        } else {
                            this.playAnimation('idle', true);
                        }
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
    private updateProceduralAnimation(): void {
        if (!this.modelRoot || this.isDead) return;

        const isMoving = this.state === 'chase' || this.state === 'patrol' || this.state === 'retreat' || this.state === 'evade' || (this.state === 'cover' && this.seekingCover);

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
            case 'retreat':
                this.updateRetreat(deltaTime, playerPosition);
                break;
            case 'cover':
                this.updateCover(deltaTime, playerPosition);
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
                // Detect player or alerted by ally
                if (distance < this.stats.detectionRange || this.alertedByAlly) {
                    // If alerted by ally (not by direct detection), evade first
                    if (this.alertedByAlly && distance >= this.stats.detectionRange) {
                        this.state = 'evade';
                        this.evadeTimer = 2 + Math.random() * 2; // Evade for 2-4 seconds
                        // Pick random evade direction (perpendicular to player)
                        const toPlayer = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).normalize();
                        const perpendicular = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
                        if (Math.random() > 0.5) perpendicular.negate();
                        this.evadeDirection.copy(perpendicular.normalize());
                    } else {
                        this.state = 'chase';
                    }
                }
                break;

            case 'chase':
                // Check if low health - retreat to survive
                if (this.health < this.stats.maxHealth * this.stats.retreatHealthThreshold) {
                    this.state = 'retreat';
                    this.retreatTimer = this.stats.retreatDuration;
                    break;
                }
                // Check if in attack range
                if (distance < this.stats.attackRange) {
                    this.state = 'attack';
                }
                // Lose sight of player - clear alerted status when returning to patrol
                else if (distance > this.stats.loseSightRange) {
                    this.state = 'patrol';
                    this.alertedByAlly = false; // Clear alert to prevent state flipping
                }
                break;

            case 'evade':
                // Check if low health during evade - retreat to survive
                if (this.health < this.stats.maxHealth * this.stats.retreatHealthThreshold) {
                    this.state = 'retreat';
                    this.retreatTimer = this.stats.retreatDuration;
                    break;
                }
                // Update evade timer
                this.evadeTimer -= deltaTime;
                if (this.evadeTimer <= 0) {
                    // After evading, try to find cover (30% chance) or continue combat
                    if (Math.random() < 0.3 && this.availableCovers.length > 0) {
                        const currentPos = new THREE.Vector3(
                            this.physicsBody.body.position.x,
                            this.physicsBody.body.position.y,
                            this.physicsBody.body.position.z
                        );
                        const cover = this.findNearestCover(currentPos, playerPosition);
                        if (cover) {
                            this.state = 'cover';
                            this.coverPosition = cover;
                            this.seekingCover = true;
                            this.inCover = false;
                            break;
                        }
                    }
                    // No cover found or chose not to seek it, continue combat
                    if (distance < this.stats.attackRange) {
                        this.state = 'attack';
                    } else {
                        this.state = 'chase';
                    }
                }
                break;

            case 'attack':
                // Check if low health - retreat to survive
                if (this.health < this.stats.maxHealth * this.stats.retreatHealthThreshold) {
                    this.state = 'retreat';
                    this.retreatTimer = this.stats.retreatDuration;
                    break;
                }
                // Player out of range
                if (distance > this.stats.attackRange * 1.5) {
                    this.state = 'chase';
                }
                break;

            case 'retreat':
                // Update retreat timer
                this.retreatTimer -= deltaTime;
                if (this.retreatTimer <= 0) {
                    // After retreating, re-evaluate based on health and distance
                    if (this.health < this.stats.maxHealth * this.stats.retreatHealthThreshold) {
                        // Still low health, try to patrol/sneak away
                        this.state = 'patrol';
                    } else {
                        // Health is stable, return to combat
                        if (distance < this.stats.attackRange) {
                            this.state = 'attack';
                        } else {
                            this.state = 'chase';
                        }
                    }
                }
                break;
        }

        // Clear alerted status after 10 seconds
        if (this.alertedByAlly && time - this.lastAlertTime > 10) {
            this.alertedByAlly = false;
        }
    }

    /**
     * Idle state
     */
    private updateIdle(deltaTime: number): void {
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
    private updateChase(deltaTime: number, playerPosition: THREE.Vector3): void {
        const currentPos = new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y,
            this.physicsBody.body.position.z
        );

        // Determine target: investigate sound or chase player
        let targetPosition: THREE.Vector3;
        if (this.investigatingSound && this.soundPosition) {
            targetPosition = this.soundPosition;
            // Decrease investigation timer
            this.investigationTimer -= deltaTime;

            // Check if investigation is complete
            const distToSound = currentPos.distanceTo(this.soundPosition);
            if (this.investigationTimer <= 0 || distToSound < 3) {
                // Investigation complete - check if player is visible
                const distToPlayer = currentPos.distanceTo(playerPosition);
                if (distToPlayer <= this.stats.detectionRange) {
                    // Player found, continue chase
                    this.investigatingSound = false;
                    this.soundPosition = null;
                } else {
                    // Player not found, return to patrol
                    this.investigatingSound = false;
                    this.soundPosition = null;
                    this.alertedByAlly = false; // Clear alert to prevent state flipping
                    this.state = 'patrol';
                }
            }
        } else {
            targetPosition = playerPosition;
        }

        const direction = new THREE.Vector3()
            .subVectors(targetPosition, currentPos)
            .normalize();

        const distance = currentPos.distanceTo(playerPosition);

        // Ranged attack - shoot if in range and cooldown ready (only when actually chasing, not investigating)
        if (!this.investigatingSound && distance <= this.stats.shootRange && this.canShoot()) {
            this.shootAtPlayer(playerPosition);
        }

        // Slow down when approaching attack range (only when chasing player)
        let actualSpeed = this.stats.chaseSpeed;
        if (!this.investigatingSound && distance < this.stats.attackRange * 1.5) {
            actualSpeed = this.stats.chaseSpeed * (distance / (this.stats.attackRange * 1.5));
        }

        this.move(direction, actualSpeed);

        // Face target
        this.faceTarget(targetPosition);
    }

    /**
     * Attack state
     */
    private updateAttack(deltaTime: number, playerPosition: THREE.Vector3): void {
        // Face player
        this.faceTarget(playerPosition);

        // Stop movement when attacking
        this.physicsBody.body.velocity.set(0, 0, 0);

        // Check if can attack
        const time = performance.now() / 1000;
        if (time - this.lastAttackTime >= this.stats.attackCooldown) {
            this.attack(playerPosition);
            this.lastAttackTime = time;
        }
    }

    /**
     * Evade state - move sideways to avoid player
     */
    private updateEvade(deltaTime: number, playerPosition: THREE.Vector3): void {
        // Move in evade direction using RUNNING speed (chaseSpeed)
        this.move(this.evadeDirection, this.stats.chaseSpeed);

        // Face player while evading (to shoot)
        this.faceTarget(playerPosition);

        // Still try to shoot while evading if in range
        const distance = this.mesh.position.distanceTo(playerPosition);
        if (distance <= this.stats.shootRange && this.canShoot()) {
            this.shootAtPlayer(playerPosition);
        }
    }

    /**
     * Retreat state - run away from player when low health
     */
    private updateRetreat(deltaTime: number, playerPosition: THREE.Vector3): void {
        const currentPos = new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y,
            this.physicsBody.body.position.z
        );

        // Calculate direction AWAY from player
        const awayDirection = new THREE.Vector3()
            .subVectors(currentPos, playerPosition)
            .normalize();

        // Move away from player using FASTER speed (1.5x chaseSpeed)
        this.move(awayDirection, this.stats.chaseSpeed * 1.5);

        // Face away from player (don't look at threat while running)
        // Keep current facing direction
    }

    /**
     * Cover state - move to cover and hide
     */
    private updateCover(deltaTime: number, playerPosition: THREE.Vector3): void {
        const currentPos = new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y,
            this.physicsBody.body.position.z
        );

        if (this.seekingCover && this.coverPosition) {
            // Moving to cover
            const distToCover = currentPos.distanceTo(this.coverPosition);

            if (distToCover > 2) {
                // Still moving to cover
                const direction = new THREE.Vector3()
                    .subVectors(this.coverPosition, currentPos)
                    .normalize();

                this.move(direction, this.stats.chaseSpeed * 1.2); // Move faster to cover
                this.faceTarget(this.coverPosition);
            } else {
                // Reached cover
                this.seekingCover = false;
                this.inCover = true;
                this.coverTimer = 3 + Math.random() * 2; // Stay in cover for 3-5 seconds

                // Stop movement
                this.physicsBody.body.velocity.set(0, 0, 0);
            }
        } else if (this.inCover) {
            // In cover - wait for timer
            this.coverTimer -= deltaTime;

            // Face toward player to peek out
            this.faceTarget(playerPosition);

            // Occasionally shoot from cover
            const distToPlayer = currentPos.distanceTo(playerPosition);
            if (distToPlayer <= this.stats.shootRange && this.canShoot() && Math.random() < 0.02) {
                this.shootAtPlayer(playerPosition);
            }

            // Check if should leave cover
            if (this.coverTimer <= 0) {
                this.inCover = false;
                this.coverPosition = null;
                // Return to chase or patrol based on player visibility
                if (distToPlayer <= this.stats.detectionRange) {
                    this.state = 'chase';
                } else {
                    this.state = 'patrol';
                    this.alertedByAlly = false;
                }
            }
        }
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
    private attack(playerPosition: THREE.Vector3): void {
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
     * Check if enemy can shoot (cooldown check)
     */
    private canShoot(): boolean {
        const time = performance.now() / 1000;
        return time - this.lastShootTime >= 3.0; // 3 second cooldown
    }

    /**
     * Shoot at player position
     */
    private shootAtPlayer(playerPosition: THREE.Vector3): void {
        if (!this.onShootCallback) return;

        this.lastShootTime = performance.now() / 1000;

        // Calculate shoot origin (enemy's chest height)
        const origin = this.mesh.position.clone();
        origin.y += 1.5;

        // Calculate direction to player
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, origin)
            .normalize();

        // Apply accuracy (60% accuracy for now)
        const accuracyError = 0.4 * 0.5;
        direction.x += (Math.random() - 0.5) * accuracyError;
        direction.y += (Math.random() - 0.5) * accuracyError;
        direction.z += (Math.random() - 0.5) * accuracyError;
        direction.normalize();

        // Call shoot callback
        this.onShootCallback(origin, direction, this.stats.damage);
    }

    /**
     * Notify this enemy that an ally died nearby
     */
    notifyAllyDeath(allyPosition: THREE.Vector3): void {
        const distance = this.mesh.position.distanceTo(allyPosition);
        const alertRange = 25; // Fixed alert range

        if (distance <= alertRange && !this.isDead) {
            this.alertedByAlly = true;
            this.lastAlertTime = performance.now() / 1000;
        }
    }

    /**
     * Notify this enemy that a gunshot was heard nearby
     */
    hearPlayerShot(soundPosition: THREE.Vector3): void {
        const distance = this.mesh.position.distanceTo(soundPosition);

        // Check if within hearing range
        if (distance <= this.stats.hearingRange && !this.isDead) {
            // Only investigate if not already in combat
            if (this.state === 'idle' || this.state === 'patrol') {
                this.investigatingSound = true;
                this.soundPosition = soundPosition.clone();
                this.investigationTimer = this.stats.investigationDuration;
                // Switch to chase state to investigate
                this.state = 'chase';
            }
        }
    }

    /**
     * Set available cover positions from level
     */
    setAvailableCovers(covers: any[]): void {
        this.availableCovers = covers;
    }

    /**
     * Find the nearest cover position that provides cover from the player
     */
    private findNearestCover(enemyPosition: THREE.Vector3, playerPosition: THREE.Vector3): THREE.Vector3 | null {
        let nearestCover: THREE.Vector3 | null = null;
        let nearestDistance = Infinity;

        for (const cover of this.availableCovers) {
            const coverPos = cover.position || cover;
            if (!coverPos) continue;

            const distToCover = enemyPosition.distanceTo(coverPos);
            const distToPlayer = playerPosition.distanceTo(coverPos);

            // Cover must be closer than player, and not too far
            if (distToCover < nearestDistance && distToCover < 50 && distToPlayer > 10) {
                // Check if this position actually provides cover
                if (this.providesCover(coverPos, playerPosition)) {
                    nearestCover = new THREE.Vector3(coverPos.x, coverPos.y || 0, coverPos.z || 0);
                    nearestDistance = distToCover;
                }
            }
        }

        return nearestCover;
    }

    /**
     * Check if a position provides cover from the player's perspective
     * Uses raycasting to determine if there's line-of-sight
     */
    private providesCover(coverPos: THREE.Vector3, playerPosition: THREE.Vector3): boolean {
        // Check if cover position is between enemy and player
        const toPlayer = new THREE.Vector3().subVectors(playerPosition, coverPos).normalize();
        const enemyPos = new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y + 1.5, // Eye level
            this.physicsBody.body.position.z
        );

        // Simple check: if cover is closer to player than enemy, and angle is reasonable
        const distCoverToPlayer = coverPos.distanceTo(playerPosition);
        const distEnemyToPlayer = enemyPos.distanceTo(playerPosition);

        // Cover must be between enemy and player (closer to player)
        if (distCoverToPlayer >= distEnemyToPlayer) {
            return false;
        }

        // Check angle: cover should be roughly in line between enemy and player
        const toCover = new THREE.Vector3().subVectors(coverPos, enemyPos).normalize();
        const dot = toCover.dot(toPlayer);

        // Cover is in the right direction if dot product is positive
        return dot > 0.3; // About 70 degrees or less
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
     * Get enemy center position (for hit detection)
     * Returns position at torso/center height for more accurate shooting
     */
    getCenterPosition(): THREE.Vector3 {
        return new THREE.Vector3(
            this.physicsBody.body.position.x,
            this.physicsBody.body.position.y + 1.2, // Torso/center height
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
