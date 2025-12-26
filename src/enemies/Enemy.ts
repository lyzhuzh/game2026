/**
 * Enemy Base Class
 * Base class for all enemy types with health, damage, and state management
 */

import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PhysicsBodyFactory } from '../physics/PhysicsBody';
import { AssetManager } from '../assets/AssetManager';
import { GAME_ASSETS } from '../assets/AssetConfig';

export type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
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

    // Points
    scoreValue: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyStats> = {
    grunt: {
        maxHealth: 50,
        health: 50,
        moveSpeed: 2,
        chaseSpeed: 4,
        rotationSpeed: 2,
        damage: 10,
        attackRange: 3,
        attackCooldown: 2.0,  // 1.5 -> 2.0 (slower attack)
        detectionRange: 15,
        loseSightRange: 25,
        scoreValue: 100
    },

    soldier: {
        maxHealth: 80,
        health: 80,
        moveSpeed: 2.5,
        chaseSpeed: 5,
        rotationSpeed: 2.5,
        damage: 15,
        attackRange: 5,
        attackCooldown: 1.5,  // 1.0 -> 1.5
        detectionRange: 20,
        loseSightRange: 30,
        scoreValue: 200
    },

    heavy: {
        maxHealth: 200,
        health: 200,
        moveSpeed: 1.5,
        chaseSpeed: 3,
        rotationSpeed: 1,
        damage: 25,  // 30 -> 25
        attackRange: 4,
        attackCooldown: 2.5,  // 2.0 -> 2.5
        detectionRange: 12,
        loseSightRange: 20,
        scoreValue: 500
    },

    sniper: {
        maxHealth: 40,
        health: 40,
        moveSpeed: 2,
        chaseSpeed: 3,
        rotationSpeed: 2,
        damage: 35,  // 50 -> 35
        attackRange: 30,
        attackCooldown: 3.0,  // 2.5 -> 3.0
        detectionRange: 25,
        loseSightRange: 35,
        scoreValue: 300
    }
};

export class Enemy {
    public readonly type: EnemyType;
    public readonly stats: EnemyStats;
    public readonly mesh: THREE.Group; // Changed to Group for GLTF models

    private physicsBody: any;
    private state: EnemyState = 'idle';
    private health: number;
    private isDead: boolean = false;

    // Callbacks
    private onDeathCallback?: (enemy: Enemy) => void;
    private onAttackCallback?: (damage: number) => void;
    private onHurtCallback?: () => void;

    // Combat
    private lastAttackTime: number = 0;

    // Patrol
    private patrolPoints: THREE.Vector3[] = [];
    private currentPatrolIndex: number = 0;
    private waitTime: number = 0;

    // Asset loading
    private assetManager: AssetManager;

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

        // Create mesh group (will contain model or placeholder)
        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        scene.add(this.mesh);

        // Try to load model, fall back to placeholder
        this.loadModel();

        // Create physics body
        this.physicsBody = PhysicsBodyFactory.createBox(
            physics,
            { x: 1, y: 2, z: 1 },
            { type: 'dynamic', mass: 50, fixedRotation: true, linearDamping: 0.1 },
            this.mesh
        );
        this.physicsBody.body.position.set(position.x, position.y, position.z);
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
                this.attachModel(clonedScene);
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
            if ((child as THREE.Mesh).isSkinnedMesh) {
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
    private attachModel(model: THREE.Group): void {
        // Clear existing children
        while (this.mesh.children.length > 0) {
            const child = this.mesh.children[0];
            this.mesh.remove(child);
        }

        // Update skeleton matrices before calculating bounding box
        model.updateMatrixWorld(true);

        // Force update all SkinnedMesh bones
        model.traverse((child) => {
            if ((child as THREE.Mesh).isSkinnedMesh) {
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
            if ((child as THREE.Mesh).isSkinnedMesh) {
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

        // Apply simple red material (use MeshStandardMaterial for SkinnedMesh compatibility)
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            roughness: 0.5,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        let appliedCount = 0;
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = material;
                child.visible = true;
                child.castShadow = true;
                child.receiveShadow = true;
                appliedCount++;
            }
        });

        this.mesh.add(model);
    }

    /**
     * Get model bounding box for debugging
     */
    private getBoundingBox(model: THREE.Object3D): {size: THREE.Vector3, center: THREE.Vector3} {
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
     * Update enemy
     */
    update(deltaTime: number, playerPosition: THREE.Vector3): void {
        if (this.isDead) return;

        // Update state based on player proximity
        this.updateState(playerPosition);

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
        }

        // Sync physics body with mesh
        this.physicsBody.update();
    }

    /**
     * Update AI state based on player position
     */
    private updateState(playerPosition: THREE.Vector3): void {
        const distance = this.mesh.position.distanceTo(playerPosition);

        switch (this.state) {
            case 'idle':
            case 'patrol':
                // Detect player
                if (distance < this.stats.detectionRange) {
                    this.state = 'chase';
                    console.log(`[Enemy] ${this.type} detected player at distance ${distance.toFixed(1)}`);
                }
                break;

            case 'chase':
                // Check if in attack range
                if (distance < this.stats.attackRange) {
                    this.state = 'attack';
                    console.log(`[Enemy] ${this.type} entering attack state, distance: ${distance.toFixed(1)}`);
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
                    console.log(`[Enemy] ${this.type} leaving attack state, distance: ${distance.toFixed(1)}`);
                }
                break;
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
        if (this.patrolPoints.length === 0) return;

        // Move towards current patrol point
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        const direction = new THREE.Vector3()
            .subVectors(targetPoint, this.mesh.position)
            .normalize();

        this.move(direction, this.stats.moveSpeed);

        // Check if reached patrol point
        if (this.mesh.position.distanceTo(targetPoint) < 1) {
            this.waitTime += deltaTime;
            if (this.waitTime > 2) {
                this.waitTime = 0;
                this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            }
        }
    }

    /**
     * Chase state
     */
    private updateChase(deltaTime: number, playerPosition: THREE.Vector3): void {
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.mesh.position)
            .normalize();

        this.move(direction, this.stats.chaseSpeed);

        // Face player
        this.faceTarget(playerPosition);
    }

    /**
     * Attack state
     */
    private updateAttack(deltaTime: number, playerPosition: THREE.Vector3): void {
        // Face player
        this.faceTarget(playerPosition);

        // Check if can attack
        const time = performance.now() / 1000;
        if (time - this.lastAttackTime >= this.stats.attackCooldown) {
            console.log(`[Enemy] ${this.type} attacking player for ${this.stats.damage} damage`);
            this.attack(playerPosition);
            this.lastAttackTime = time;
        }
    }

    /**
     * Move enemy - set velocity for physics body
     */
    private move(direction: THREE.Vector3, speed: number): void {
        // For dynamic bodies, we set velocity directly (units per second)
        const velocity = direction.clone().multiplyScalar(speed);
        this.physicsBody.body.velocity.set(velocity.x, 0, velocity.z);
    }

    /**
     * Face target
     */
    private faceTarget(target: THREE.Vector3): void {
        const direction = new THREE.Vector3()
            .subVectors(target, this.mesh.position)
            .setY(0)
            .normalize();

        if (direction.length() > 0.01) {
            const angle = Math.atan2(direction.x, direction.z);
            this.mesh.rotation.y = angle;
        }
    }

    /**
     * Attack player
     */
    private attack(playerPosition: THREE.Vector3): void {
        // Call attack callback to damage player
        if (this.onAttackCallback) {
            console.log(`[Enemy] Calling attack callback with ${this.stats.damage} damage`);
            this.onAttackCallback(this.stats.damage);
        } else {
            console.log(`[Enemy] No attack callback set!`);
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
                    const material = child.material as THREE.MeshStandardMaterial;
                    material.emissive = new THREE.Color(0xff0000);
                    setTimeout(() => {
                        if (!this.isDead) {
                            material.emissive = new THREE.Color(0x000000);
                        }
                    }, 100);
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
                const material = child.material as THREE.MeshStandardMaterial;
                material.color.setHex(0x333333);
            }
        });

        // Ragdoll effect - fall over
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.position.y = 0.5;

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
