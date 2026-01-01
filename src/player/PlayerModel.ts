/**
 * Player Model
 * Manages the player's 3D character model
 */

import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { GAME_ASSETS } from '../assets/AssetConfig';
import { ViewMode } from './ViewMode';

// Player movement state for animation
export type PlayerMoveState = 'idle' | 'walk' | 'run' | 'jump';

export interface PlayerModelConfig {
    modelId: string;
    scale: number;
    visibleInFirstPerson: boolean;
    shadowEnabled: boolean;
}

export class PlayerModel {
    private scene: THREE.Scene;
    private assetManager: AssetManager;
    private modelGroup: THREE.Group;
    private model?: THREE.Group;

    // Animation system
    private mixer?: THREE.AnimationMixer;
    private animations: Map<string, THREE.AnimationClip> = new Map();
    private currentAction?: THREE.AnimationAction;

    // Movement state tracking for animation
    private currentMoveState: PlayerMoveState = 'idle';
    private previousMoveState: PlayerMoveState = 'idle';

    // Configuration
    private config: PlayerModelConfig;

    // Hand bones for weapon attachment
    private handBones: Map<string, THREE.Bone> = new Map();
    private weaponAttachmentPoint?: THREE.Object3D;

    // First-person arms clipping
    private clippingPlane?: THREE.Plane;

    constructor(scene: THREE.Scene, config: PlayerModelConfig) {
        this.scene = scene;
        this.config = config;
        this.assetManager = AssetManager.getInstance();

        // Create model container group
        this.modelGroup = new THREE.Group();
        this.modelGroup.name = 'PlayerModel';
        this.scene.add(this.modelGroup);
    }

    /**
     * Load player model from asset manager
     */
    async loadModel(): Promise<void> {
        console.log('[PlayerModel] loadModel() called, modelId:', this.config.modelId);
        const assetConfig = GAME_ASSETS.find(a => a.id === this.config.modelId);
        if (!assetConfig) {
            console.warn(`[PlayerModel] Asset config not found: ${this.config.modelId}`);
            this.createPlaceholderModel();
            return;
        }

        try {
            const gltf = await this.assetManager.loadAsset(assetConfig);

            if (gltf && gltf.scene) {
                // Deep clone for proper SkinnedMesh handling
                this.model = this.deepCloneGltf(gltf.scene) as THREE.Group;

                // IMPORTANT: Reset any existing scale on the model before calculating
                this.model.scale.set(1, 1, 1);
                this.model.position.set(0, 0, 0);
                this.model.rotation.set(0, 0, 0);
                this.model.updateMatrix();
                this.model.updateMatrixWorld(true);

                // Calculate bounding box of unscaled model
                const tempBox = new THREE.Box3().setFromObject(this.model);
                const tempSize = new THREE.Vector3();
                tempBox.getSize(tempSize);

                // Get unscaled model height and bottom Y
                const originalHeight = tempSize.y;
                const originalMinY = tempBox.min.y;

                console.log(`[PlayerModel] Original model: height=${originalHeight.toFixed(4)}m, minY=${originalMinY.toFixed(4)}`);

                // Target height is 1.8 meters
                const targetHeight = 1.8;
                const targetScale = targetHeight / originalHeight;

                // Apply uniform scale
                this.model.scale.setScalar(targetScale);

                // After scaling, the minY is also scaled
                // We need to offset the model so that the scaled minY is at 0
                // Scaled minY = originalMinY * targetScale
                const scaledMinY = originalMinY * targetScale;
                this.model.position.y = -scaledMinY;

                console.log(`[PlayerModel] Applied scale: ${targetScale.toFixed(2)}, model.position.y: ${this.model.position.y.toFixed(2)}`);

                // Update matrices
                this.model.updateMatrix();
                this.model.updateMatrixWorld(true);

                // Verify the result and apply correction if needed
                const verifyBox = new THREE.Box3().setFromObject(this.model);
                const verifyHeight = verifyBox.max.y - verifyBox.min.y;
                console.log(`[PlayerModel] Verification: height=${verifyHeight.toFixed(2)}m, Y range=[${verifyBox.min.y.toFixed(2)}, ${verifyBox.max.y.toFixed(2)}]`);

                // If the height is still wrong, apply a correction factor
                const heightTolerance = 0.5; // Allow 0.5m tolerance
                if (Math.abs(verifyHeight - targetHeight) > heightTolerance) {
                    const correctionFactor = targetHeight / verifyHeight;
                    const currentScale = this.model.scale.x;
                    const correctedScale = currentScale * correctionFactor;

                    console.log(`[PlayerModel] Height correction needed. Factor: ${correctionFactor.toFixed(2)}, new scale: ${correctedScale.toFixed(2)}`);

                    this.model.scale.setScalar(correctedScale);

                    // Recalculate position to keep feet at Y=0
                    const correctedBox = new THREE.Box3().setFromObject(this.model);
                    this.model.position.y = -correctedBox.min.y;

                    // Update matrices again
                    this.model.updateMatrix();
                    this.model.updateMatrixWorld(true);

                    // Final verification
                    const finalBox = new THREE.Box3().setFromObject(this.model);
                    const finalHeight = finalBox.max.y - finalBox.min.y;
                    console.log(`[PlayerModel] Final: height=${finalHeight.toFixed(2)}m, Y range=[${finalBox.min.y.toFixed(2)}, ${finalBox.max.y.toFixed(2)}]`);
                }

                // Setup shadows
                if (this.config.shadowEnabled) {
                    this.model.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                }

                // Setup animations
                if (gltf.animations && gltf.animations.length > 0) {
                    this.setupAnimations(gltf.animations);
                }

                // Find hand bones
                this.findHandBones();

                // Create weapon attachment point
                this.createWeaponAttachmentPoint();

                // Setup first-person arms clipping
                this.setupFirstPersonArms();

                // Add to scene
                this.modelGroup.add(this.model);

                // Check world space bounding box after adding to modelGroup
                const finalWorldBox = new THREE.Box3().setFromObject(this.model);
                const finalWorldHeight = finalWorldBox.max.y - finalWorldBox.min.y;
                console.log(`[PlayerModel] After adding to modelGroup - World bounding box height: ${finalWorldHeight.toFixed(2)}m`);

                // Check modelGroup parent
                console.log(`[PlayerModel] modelGroup parent: ${this.modelGroup.parent?.name || 'null'}`);
                console.log(`[PlayerModel] modelGroup children count: ${this.modelGroup.children.length}`);
                console.log(`[PlayerModel] this.model parent: ${this.model.parent?.name || 'null'}`);

                // Set initial visibility
                this.modelGroup.visible = this.config.visibleInFirstPerson;

                console.log('[PlayerModel] Model loaded successfully');
            }
        } catch (error) {
            console.error('[PlayerModel] Failed to load model:', error);
            this.createPlaceholderModel();
        }
    }

    /**
     * Deep clone GLTF scene with materials and skeleton support
     * Reference: Enemy.ts implementation
     */
    private deepCloneGltf(source: THREE.Object3D): THREE.Object3D {
        // Collect original bones by name
        const originalBonesByName = new Map<string, THREE.Bone>();
        source.traverse((child) => {
            if (child instanceof THREE.Bone) {
                originalBonesByName.set(child.name, child);
            }
        });

        // Clone the entire scene
        const clone = source.clone();

        // Collect cloned bones by name
        const clonedBonesByName = new Map<string, THREE.Bone>();
        clone.traverse((child) => {
            if (child instanceof THREE.Bone) {
                clonedBonesByName.set(child.name, child);
            }
        });

        // Handle SkinnedMesh - update skeleton to use cloned bones
        clone.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
                const skinnedMesh = child;
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
     * Find hand bones for weapon attachment
     * Common bone names: mixamorigRightHand, RightHand, hand.R, R_hand
     */
    private findHandBones(): void {
        if (!this.model) return;

        const commonHandNames = [
            'mixamorigRightHand',
            'RightHand',
            'hand.R',
            'R_hand',
            'right_hand',
            'HandRight',
            'mixamorigLeftHand',
            'LeftHand'
        ];

        this.model.traverse((child) => {
            if (child instanceof THREE.Bone) {
                for (const name of commonHandNames) {
                    if (child.name.includes(name)) {
                        const handType = name.toLowerCase().includes('left') ? 'left' : 'right';
                        this.handBones.set(handType, child);
                        console.log(`[PlayerModel] Found ${handType} hand bone: ${child.name}`);
                    }
                }
            }
        });
    }

    /**
     * Create weapon attachment point
     */
    private createWeaponAttachmentPoint(): void {
        const rightHand = this.handBones.get('right');

        if (rightHand) {
            // Use hand bone as attachment point
            this.weaponAttachmentPoint = new THREE.Object3D();
            this.weaponAttachmentPoint.name = 'WeaponAttachmentPoint';
            rightHand.add(this.weaponAttachmentPoint);
            console.log('[PlayerModel] Weapon attached to right hand bone');
        } else if (this.model) {
            // Fallback: create attachment point on model
            this.weaponAttachmentPoint = new THREE.Object3D();
            this.weaponAttachmentPoint.name = 'WeaponAttachmentPoint';
            this.weaponAttachmentPoint.position.set(0.3, 0.5, 0.2);
            this.model.add(this.weaponAttachmentPoint);
            console.log('[PlayerModel] Weapon attached to model (fallback position)');
        }
    }

    /**
     * Setup first-person arms clipping
     * This allows showing only the arms in first-person view
     * Plane: (0, 1, 0) · point + constant = 0
     * With normal (0, 1, 0) and constant = -1.2:
     * - Shows points where y > 1.2 (arms/chest)
     * - Clips points where y < 1.2 (legs/lower body)
     */
    private setupFirstPersonArms(): void {
        if (!this.model) return;

        // Create clipping plane that hides everything below chest level
        // Normal (0, 1, 0) pointing up, constant = -1.2 clips below y = 1.2
        this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material.clippingPlanes = [this.clippingPlane!];
                child.material.clipShadows = true;
            }
        });
    }

    /**
     * Get weapon attachment point
     */
    getWeaponAttachmentPoint(): THREE.Object3D | undefined {
        return this.weaponAttachmentPoint;
    }

    /**
     * Setup animations
     */
    private setupAnimations(animations: THREE.AnimationClip[]): void {
        if (!this.model) return;

        this.mixer = new THREE.AnimationMixer(this.model);

        for (const clip of animations) {
            this.animations.set(clip.name, clip);
        }

        // Play idle animation if available
        if (this.animations.has('idle')) {
            this.playAnimation('idle', true);
        }
    }

    /**
     * Play animation by name with fuzzy matching
     * Reference: Enemy.playAnimation
     */
    playAnimation(name: string, loop: boolean = true): void {
        if (!this.mixer) return;

        // First, try exact match
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

                // Match: idle, walk, run, jump
                if ((nameLower === 'idle' && animNameLower.includes('idle')) ||
                    (nameLower === 'walk' && animNameLower.includes('walk')) ||
                    (nameLower === 'run' && animNameLower.includes('run')) ||
                    (nameLower === 'jump' && animNameLower.includes('jump'))) {
                    clip = animClip;
                    break;
                }
            }
        }

        if (!clip) {
            // Don't spam warnings - only log once per animation type
            return;
        }

        // Fade out current animation
        if (this.currentAction) {
            this.currentAction.fadeOut(0.2);
        }

        // Play new animation
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
        const variations: string[] = [];
        const lower = baseName.toLowerCase();

        // Common naming patterns
        variations.push(baseName);
        variations.push(lower);
        variations.push(lower.charAt(0).toUpperCase() + lower.slice(1));

        // Mixamo naming patterns
        variations.push(`mixamo.com_${lower}`);
        variations.push(`${lower}_mixamo`);

        // Suffix patterns
        variations.push(`${lower}ing`);  // walk -> walking
        variations.push(`${lower}_loop`);
        variations.push(`${lower}_anim`);

        return variations;
    }

    /**
     * Update model (sync physics position + animation update)
     * @param deltaTime - Frame delta time
     * @param position - Player feet position
     * @param rotation - Player rotation (yaw)
     * @param moveState - Current movement state for animation
     */
    update(deltaTime: number, position: THREE.Vector3, rotation: { yaw: number }, moveState: PlayerMoveState = 'idle'): void {
        if (!this.model) return;

        // Sync position
        this.modelGroup.position.copy(position);

        // Sync rotation (only Y axis to avoid tilting)
        this.modelGroup.rotation.y = rotation.yaw;

        // Update movement state and switch animation if changed
        this.currentMoveState = moveState;
        if (this.currentMoveState !== this.previousMoveState) {
            this.updateAnimation();
            this.previousMoveState = this.currentMoveState;
        }

        // Debug: log model position and scale every few seconds
        if (Math.random() < 0.005) {
            console.log(`[PlayerModel] Position: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}, State: ${moveState}`);
        }

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }

    /**
     * Update animation based on current movement state
     * Reference: Enemy.updateAnimation
     */
    private updateAnimation(): void {
        if (!this.mixer || this.animations.size === 0) return;

        switch (this.currentMoveState) {
            case 'idle':
                this.playAnimation('idle', true);
                break;
            case 'walk':
                this.playAnimation('walk', true);
                break;
            case 'run':
                this.playAnimation('run', true);
                break;
            case 'jump':
                this.playAnimation('jump', false);
                break;
        }
    }

    /**
     * Set visibility based on view mode
     */
    setVisible(visible: boolean, viewMode: ViewMode = ViewMode.FIRST_PERSON): void {
        if (!visible) {
            this.modelGroup.visible = false;
            return;
        }

        if (!this.model) {
            this.modelGroup.visible = false;
            return;
        }

        if (viewMode === ViewMode.FIRST_PERSON) {
            // First person: hide the model completely
            // Only weapon is visible (handled by WeaponRenderer)
            this.modelGroup.visible = false;
        } else {
            // Third person: show full body, disable any clipping
            this.modelGroup.visible = true;
            this.model.traverse((child) => {
                // Ensure all parts are visible
                child.visible = true;

                if (child instanceof THREE.Mesh) {
                    // Disable clipping for full body visibility
                    if (child.material.clippingPlanes) {
                        child.material.clippingPlanes = [];
                        child.material.clipShadows = false;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }
    }

    /**
     * Create placeholder model (simple capsule)
     */
    private createPlaceholderModel(): void {
        const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x4444ff,
            roughness: 0.7,
            metalness: 0.3
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'PlaceholderPlayerModel';
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.model = new THREE.Group();
        this.model.add(mesh);
        this.modelGroup.add(this.model);

        // Create weapon attachment point
        this.weaponAttachmentPoint = new THREE.Object3D();
        this.weaponAttachmentPoint.name = 'WeaponAttachmentPoint';
        this.weaponAttachmentPoint.position.set(0.3, 0.5, 0.2);
        this.model.add(this.weaponAttachmentPoint);

        console.log('[PlayerModel] Created placeholder model');
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.model) {
            this.model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        this.scene.remove(this.modelGroup);
    }
}
