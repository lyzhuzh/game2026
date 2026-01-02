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

    // Animation Debug Mode
    private debugMode: boolean = false;
    private debugAnimationIndex: number = 0;
    private debugAnimationSpeed: number = 1.0;
    private debugPaused: boolean = false;

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
     * Find hand/arm bones for weapon attachment
     * Also looks for ForeArm as it's often better for weapon alignment
     */
    private findHandBones(): void {
        if (!this.model) return;

        const commonHandNames = [
            'mixamorigRightHand',
            'RightHand',
            'hand.R',
            'R_hand',
            'right_hand',
            'HandRight'
        ];

        const commonForeArmNames = [
            'mixamorigRightForeArm',
            'RightForeArm',
            'forearm.R',
            'R_forearm',
            'right_forearm'
        ];

        this.model.traverse((child) => {
            if (child instanceof THREE.Bone) {
                // Check for Hand
                for (const name of commonHandNames) {
                    if (child.name.includes(name)) {
                        this.handBones.set('right_hand', child);
                        console.log(`[PlayerModel] Found right hand bone: ${child.name}`);
                    }
                }
                // Check for ForeArm
                for (const name of commonForeArmNames) {
                    if (child.name.includes(name)) {
                        this.handBones.set('right_forearm', child);
                        console.log(`[PlayerModel] Found right forearm bone: ${child.name}`);
                    }
                }
            }
        });
    }

    /**
     * Create weapon attachment point
     */
    private createWeaponAttachmentPoint(): void {
        // Prioritize ForeArm for better alignment, fallback to Hand
        const attachmentBone = this.handBones.get('right_forearm') || this.handBones.get('right_hand');

        if (attachmentBone) {
            // Use bone as attachment point
            this.weaponAttachmentPoint = new THREE.Object3D();
            this.weaponAttachmentPoint.name = 'WeaponAttachmentPoint';
            attachmentBone.add(this.weaponAttachmentPoint);
            console.log(`[PlayerModel] Weapon attached to bone: ${attachmentBone.name}`);
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

    private viewMode: ViewMode = ViewMode.FIRST_PERSON; // Default to FPP

    /**
     * Set view mode
     */
    setViewMode(mode: ViewMode): void {
        this.viewMode = mode;
        this.updateAnimation(); // Force update animation on mode change
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

        console.log('[PlayerModel] Available animations:', animations.map(a => a.name));

        for (const clip of animations) {
            // Store by name
            this.animations.set(clip.name, clip);
            // Also store lowercased name for case-insensitive lookup
            this.animations.set(clip.name.toLowerCase(), clip);
        }

        // Play idle animation if available
        if (this.animations.has('idle')) {
            this.playAnimation('idle', true);
        }
    }

    /**
     * Play animation by name
     * @returns true if animation was found and played
     */
    private playAnimation(name: string, loop: boolean = false): boolean {
        if (!this.mixer) return false;

        // Disabled animations - skip these completely
        const disabledAnimations = ['corin_wickes_Idle_1'];
        if (disabledAnimations.includes(name)) {
            return false;
        }

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
            const disabledAnimations = ['corin_wickes_Idle_1'];
            for (const [animName, animClip] of this.animations) {
                // Skip disabled animations
                if (disabledAnimations.includes(animName)) continue;

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
            return false;
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
        return true;
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

        // Attack/Shoot variations
        if (baseName === 'attack' || baseName === 'shoot') {
            variations.push('Attack');
            variations.push('attack');
            variations.push('Shoot');
            variations.push('shoot');
            variations.push('Shooting');
            variations.push('shooting');
            variations.push('Fire');
            variations.push('fire');
        }

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
        // Note: All rotation offsets are calculated in Game.ts based on view mode
        this.modelGroup.rotation.y = rotation.yaw;

        // Update movement state and switch animation if changed
        this.currentMoveState = moveState;
        if (this.currentMoveState !== this.previousMoveState) {
            this.updateAnimation();
            this.previousMoveState = this.currentMoveState;
        }

        // Debug: log model position and scale every few seconds
        if (Math.random() < 0.005) {
            // console.log(`[PlayerModel] Position: ${ position.x.toFixed(1) }, ${ position.y.toFixed(1) }, ${ position.z.toFixed(1) }, State: ${ moveState } `);
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

        // Skip automatic update if in debug mode
        if (this.debugMode) return;

        // Special case: Third Person Idle -> Use specific combat pose animation
        if (this.currentMoveState === 'idle' && this.viewMode === ViewMode.THIRD_PERSON) {
            // Use corin_wickes_Shoot_3 for combat ready stance
            if (this.playAnimation('corin_wickes_Shoot_3', true)) return;
            // Fallback to other combat animations
            if (this.playAnimation('shoot', true)) return;
            if (this.playAnimation('attack', true)) return;
            if (this.playAnimation('fire', true)) return;
            // If no combat animation found, fall back to normal idle
        }

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

    // ========== Animation Debug Controls ==========

    /**
     * Enable/disable animation debug mode
     * In debug mode, animation state is manually controlled
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        if (enabled) {
            console.log('[PlayerModel Debug] Debug mode ENABLED');
            console.log('[PlayerModel Debug] Controls:');
            console.log('  1-9: Play animation by index');
            console.log('  0: List all animations');
            console.log('  +/-: Adjust animation speed');
            console.log('  P: Pause/Resume animation');
            console.log('  [/]: Previous/Next animation');
            this.listAnimations();
        } else {
            console.log('[PlayerModel Debug] Debug mode DISABLED');
            this.debugAnimationSpeed = 1.0;
            this.debugPaused = false;
        }
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugModeEnabled(): boolean {
        return this.debugMode;
    }

    /**
     * List all available animations
     */
    listAnimations(): string[] {
        const names: string[] = [];
        const seen = new Set<string>();
        for (const [name] of this.animations) {
            const lowerName = name.toLowerCase();
            if (!seen.has(lowerName)) {
                seen.add(lowerName);
                names.push(name);
            }
        }
        console.log('[PlayerModel Debug] Available animations:');
        names.forEach((name, index) => {
            console.log(`  ${index}: ${name}`);
        });
        return names;
    }

    /**
     * Play animation by index (for debug)
     */
    playAnimationByIndex(index: number): boolean {
        const names = this.listAnimations();
        if (index >= 0 && index < names.length) {
            const name = names[index];
            this.debugAnimationIndex = index;
            console.log(`[PlayerModel Debug] Playing animation ${index}: ${name}`);
            return this.playAnimation(name, true);
        }
        console.warn(`[PlayerModel Debug] Invalid animation index: ${index}`);
        return false;
    }

    /**
     * Play next animation (for debug)
     */
    playNextAnimation(): void {
        const names = this.listAnimations();
        this.debugAnimationIndex = (this.debugAnimationIndex + 1) % names.length;
        this.playAnimationByIndex(this.debugAnimationIndex);
    }

    /**
     * Play previous animation (for debug)
     */
    playPreviousAnimation(): void {
        const names = this.listAnimations();
        this.debugAnimationIndex = (this.debugAnimationIndex - 1 + names.length) % names.length;
        this.playAnimationByIndex(this.debugAnimationIndex);
    }

    /**
     * Force play animation by name (public, for debug)
     */
    forcePlayAnimation(name: string, loop: boolean = true): boolean {
        return this.playAnimation(name, loop);
    }

    /**
     * Set animation playback speed (for debug)
     */
    setAnimationSpeed(speed: number): void {
        this.debugAnimationSpeed = Math.max(0.1, Math.min(3.0, speed));
        if (this.currentAction) {
            this.currentAction.timeScale = this.debugAnimationSpeed;
        }
        console.log(`[PlayerModel Debug] Animation speed: ${this.debugAnimationSpeed.toFixed(1)}x`);
    }

    /**
     * Adjust animation speed (for debug)
     */
    adjustAnimationSpeed(delta: number): void {
        this.setAnimationSpeed(this.debugAnimationSpeed + delta);
    }

    /**
     * Toggle pause/resume animation (for debug)
     */
    togglePause(): void {
        this.debugPaused = !this.debugPaused;
        if (this.currentAction) {
            this.currentAction.paused = this.debugPaused;
        }
        console.log(`[PlayerModel Debug] Animation ${this.debugPaused ? 'PAUSED' : 'RESUMED'}`);
    }

    /**
     * Get current animation info (for debug UI)
     */
    getDebugInfo(): { animationName: string; speed: number; paused: boolean; time: number } {
        const names = this.listAnimations();
        return {
            animationName: names[this.debugAnimationIndex] || 'N/A',
            speed: this.debugAnimationSpeed,
            paused: this.debugPaused,
            time: this.currentAction ? this.currentAction.time : 0
        };
    }

    /**
     * Handle debug keyboard input
     * Call this from Game.ts when debug mode is enabled
     */
    handleDebugInput(key: string): void {
        if (!this.debugMode) return;

        switch (key) {
            case '0':
                this.listAnimations();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                this.playAnimationByIndex(parseInt(key) - 1);
                break;
            case '=':
            case '+':
                this.adjustAnimationSpeed(0.1);
                break;
            case '-':
            case '_':
                this.adjustAnimationSpeed(-0.1);
                break;
            case 'p':
            case 'P':
                this.togglePause();
                break;
            case '[':
                this.playPreviousAnimation();
                break;
            case ']':
                this.playNextAnimation();
                break;
        }
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
