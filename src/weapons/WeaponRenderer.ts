/**
 * Weapon Renderer
 * Renders weapon models in first-person and third-person view
 */

import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { WeaponType } from '../weapons/WeaponConfig';
import { GAME_ASSETS } from '../assets/AssetConfig';
import { ViewMode } from '../player/ViewMode';

export class WeaponRenderer {
    private scene: THREE.Scene;
    private assetManager: AssetManager;
    private camera: THREE.Camera;

    // === WEAPON LAYER SEPARATION ===
    // Separate scene and camera for weapon rendering
    // This prevents weapon from clipping through walls
    private weaponScene: THREE.Scene;
    private weaponCamera: THREE.PerspectiveCamera;

    // First-person weapon (in separate weapon scene)
    private weaponGroup: THREE.Group;
    private currentWeaponModel?: THREE.Group;
    private currentWeaponId: string = '';

    // Third-person weapon (attached to player model in main scene)
    private thirdPersonWeaponGroup?: THREE.Group;
    private currentThirdPersonWeaponModel?: THREE.Group;
    private playerWeaponAttachmentPoint?: THREE.Object3D;

    // View mode
    private viewMode: ViewMode = ViewMode.FIRST_PERSON;

    // Weapon position adjustments (for first-person view)
    // X = right/left, Y = up/down, Z = forward/back (negative = further from camera)
    // Values calibrated using debug tool
    private weaponOffsets: Map<WeaponType, THREE.Vector3> = new Map([
        ['pistol', new THREE.Vector3(0.06, -0.13, -0.42)],      // Calibrated
        ['rifle', new THREE.Vector3(0.09, -0.145, -0.515)],     // Calibrated
        ['shotgun', new THREE.Vector3(0.06, -0.16, -0.34)],    // Calibrated
        ['smg', new THREE.Vector3(0.075, -0.18, -0.475)],      // Calibrated
        ['sniper', new THREE.Vector3(0.025, -0.085, -0.49)],    // Calibrated
        ['rocket_launcher', new THREE.Vector3(0.12, -0.25, -0.4)], // Estimated
        ['flamethrower', new THREE.Vector3(0.08, -0.15, -0.5)],   // Estimated
    ]);

    // Weapon rotation adjustments (in radians)
    // Euler order: X (pitch), Y (yaw), Z (roll)
    private weaponRotations: Map<WeaponType, THREE.Euler> = new Map([
        ['pistol', new THREE.Euler(0, 0.1, 0)],               // Calibrated
        ['rifle', new THREE.Euler(0, 0.09, 0)],                // Calibrated
        ['shotgun', new THREE.Euler(0, 0.14, 0)],              // Calibrated
        ['smg', new THREE.Euler(0, 0.19, 0)],                 // Calibrated
        ['sniper', new THREE.Euler(0, 0.14, 0)],               // Calibrated
        ['rocket_launcher', new THREE.Euler(0, 0.1, 0)],         // Estimated
        ['flamethrower', new THREE.Euler(0, 0.1, 0)],            // Estimated
    ]);

    // Weapon scale adjustments (calibrated using debug tool)
    private weaponScales: Map<WeaponType, number> = new Map([
        ['pistol', 0.575],       // Calibrated
        ['rifle', 0.565],        // Calibrated
        ['shotgun', 0.78],       // Calibrated
        ['smg', 0.91],           // Calibrated
        ['sniper', 0.345],       // Calibrated
        ['rocket_launcher', 0.8],    // Estimated (Heavy blaster is large)
        ['flamethrower', 0.6],       // Estimated
    ]);

    // === THIRD-PERSON CALIBRATION DATA ===
    // Offsets relative to right hand bone
    private tpWeaponOffsets: Map<WeaponType, THREE.Vector3> = new Map([
        ['pistol', new THREE.Vector3(0.00, 0.04, 0.00)],
        ['rifle', new THREE.Vector3(-0.02, 0.05, 0.00)],
    ]);

    // Rotations relative to right hand bone (Euler X, Y, Z)
    private tpWeaponRotations: Map<WeaponType, THREE.Vector3> = new Map([
        ['pistol', new THREE.Vector3(7.95, 0.00, -2.50)],
        ['rifle', new THREE.Vector3(1.60, 0.60, -2.45)],
    ]);

    // Scales for third-person view
    private tpWeaponScales: Map<WeaponType, number> = new Map([
        ['pistol', 0.028],
        ['rifle', 0.042],
    ]);

    // === DEBUG: Third-person weapon position (relative to player) ===
    // Arrow keys: position X/Y offset
    // ,/.: position Z offset (forward/back)
    // [ ]: rotation X
    // These are offsets from player position, forward is based on yaw
    // X = right side, Y = height, Z = forward
    private tpWeaponOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);  // Reset for relative hand positioning
    private tpWeaponRotX: number = 0;
    private tpWeaponRotY: number = 0;
    private tpWeaponRotZ: number = 0;
    private lastTPDebugTime: number = 0;

    // Player position for third-person weapon following
    private playerPosition: THREE.Vector3 = new THREE.Vector3();
    private playerYaw: number = 0;

    private swayPosition: THREE.Vector3 = new THREE.Vector3();
    private swayVelocity: THREE.Vector3 = new THREE.Vector3();
    private recoilOffset: number = 0;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
        this.assetManager = AssetManager.getInstance();

        // === CREATE SEPARATE WEAPON SCENE ===
        // Weapon scene is rendered AFTER main scene with depth cleared
        // This ensures weapon never clips through walls
        this.weaponScene = new THREE.Scene();
        this.weaponScene.name = 'WeaponScene';

        // Create weapon camera (same FOV as main camera)
        const mainCam = camera as THREE.PerspectiveCamera;
        this.weaponCamera = new THREE.PerspectiveCamera(
            mainCam.fov,
            mainCam.aspect,
            0.01,  // Very small near plane for weapon
            10     // Short far plane (weapon is close)
        );

        // Add lighting to weapon scene (so weapon is visible)
        const weaponAmbient = new THREE.AmbientLight(0xffffff, 0.6);
        const weaponDirectional = new THREE.DirectionalLight(0xffffff, 0.8);
        weaponDirectional.position.set(1, 1, 1);
        this.weaponScene.add(weaponAmbient);
        this.weaponScene.add(weaponDirectional);

        // Create first-person weapon holder group (in weapon scene, attached to weapon camera)
        this.weaponGroup = new THREE.Group();
        this.weaponGroup.name = 'WeaponHolder_FP';
        this.weaponCamera.add(this.weaponGroup);
        this.weaponScene.add(this.weaponCamera);

        // Create third-person weapon holder group (in main scene)
        this.thirdPersonWeaponGroup = new THREE.Group();
        this.thirdPersonWeaponGroup.name = 'WeaponHolder_TP';
        this.thirdPersonWeaponGroup.visible = false;
        this.scene.add(this.thirdPersonWeaponGroup);

        console.log('[WeaponRenderer] Created separate weapon scene for FPP rendering');
    }

    /**
     * Get weapon scene (for separate rendering)
     */
    getWeaponScene(): THREE.Scene {
        return this.weaponScene;
    }

    /**
     * Get weapon camera (for separate rendering)
     */
    getWeaponCamera(): THREE.Camera {
        return this.weaponCamera;
    }

    /**
     * Sync weapon camera with main camera
     * Call this every frame before rendering
     */
    syncWeaponCamera(): void {
        // Copy main camera's world matrix to weapon camera
        this.camera.updateMatrixWorld(true);
        this.weaponCamera.position.copy(this.camera.position);
        this.weaponCamera.quaternion.copy(this.camera.quaternion);
        this.weaponCamera.updateMatrixWorld(true);
    }

    /**
     * Set player weapon attachment point (for third-person view)
     */
    setPlayerWeaponAttachmentPoint(point: THREE.Object3D | undefined): void {
        this.playerWeaponAttachmentPoint = point;

        // If we already have a third-person weapon, reattach it
        if (point && this.currentThirdPersonWeaponModel) {
            point.remove(this.currentThirdPersonWeaponModel);
            point.add(this.currentThirdPersonWeaponModel);
        }
    }

    /**
     * Set view mode (first-person or third-person)
     */
    setViewMode(mode: ViewMode): void {
        const prevMode = this.viewMode;
        this.viewMode = mode;

        if (mode === ViewMode.FIRST_PERSON) {
            // Show first-person weapon, hide third-person
            this.weaponGroup.visible = true;
            if (this.thirdPersonWeaponGroup) {
                this.thirdPersonWeaponGroup.visible = false;
            }
            if (this.currentThirdPersonWeaponModel) {
                this.currentThirdPersonWeaponModel.visible = false;
            }
        } else {
            // Hide first-person weapon, show third-person
            this.weaponGroup.visible = false;
            if (this.thirdPersonWeaponGroup) {
                this.thirdPersonWeaponGroup.visible = true;
            }

            // If we have a current weapon type but no TP model, load it
            if (this.currentWeaponId && !this.currentThirdPersonWeaponModel) {
                // Extract weapon type from asset ID
                const weaponType = this.currentWeaponId.replace('weapon_', '') as WeaponType;
                console.log(`[WeaponRenderer] Loading TP weapon on mode switch: ${weaponType}`);
                this.showThirdPersonWeapon(weaponType);
            }
            if (this.currentThirdPersonWeaponModel) {
                this.currentThirdPersonWeaponModel.visible = true;
            }
        }

        console.log(`[WeaponRenderer] View mode: ${prevMode} -> ${mode}`);
    }

    /**
     * Set first-person weapon visibility (for sniper scope)
     */
    setWeaponVisible(visible: boolean): void {
        this.weaponGroup.visible = visible;
    }

    /**
     * Set player position and yaw for third-person weapon following
     */
    setPlayerTransform(position: THREE.Vector3, yaw: number): void {
        this.playerPosition.copy(position);
        this.playerYaw = yaw;
    }

    /**
     * Load and show weapon model based on current view mode
     * Only loads weapon for the active view mode to prevent duplicate rendering
     */
    async showWeapon(weaponType: WeaponType): Promise<void> {
        const assetId = this.getWeaponAssetId(weaponType);

        // Skip if already showing this weapon
        if (this.currentWeaponId === assetId && this.currentWeaponModel) {
            return;
        }

        // Remove current weapon models
        this.hideCurrentWeapon();

        // Load weapon based on current view mode
        if (this.viewMode === ViewMode.FIRST_PERSON) {
            // First-person: only load FP weapon
            await this.showFirstPersonWeapon(weaponType);
            console.log(`[WeaponRenderer] Loaded FP weapon only: ${weaponType}`);
        } else {
            // Third-person: only load TP weapon
            await this.showThirdPersonWeapon(weaponType);
            console.log(`[WeaponRenderer] Loaded TP weapon only: ${weaponType}`);
        }
    }

    /**
     * Load first-person weapon
     */
    private async showFirstPersonWeapon(weaponType: WeaponType): Promise<void> {
        const assetId = this.getWeaponAssetId(weaponType);

        // Find asset config for this weapon
        const assetConfig = GAME_ASSETS.find(a => a.id === assetId);
        if (!assetConfig) {
            console.warn(`[WeaponRenderer] No asset config found for ${weaponType} (${assetId})`);
            this.createPlaceholderWeapon(weaponType);
            return;
        }

        // Load new weapon model
        try {
            const gltf = await this.assetManager.loadAsset(assetConfig);

            if (gltf && gltf.scene) {
                this.currentWeaponModel = gltf.scene.clone();
                this.currentWeaponId = assetId;

                // Apply transforms
                this.applyWeaponTransforms(weaponType);

                // Add to weapon group
                this.weaponGroup.add(this.currentWeaponModel!);

                // Enable shadows
                this.currentWeaponModel!.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                console.log(`[WeaponRenderer] Showing first-person: ${weaponType}`);
            } else {
                console.warn(`[WeaponRenderer] GLTF loaded but no scene found for ${weaponType}`);
                this.createPlaceholderWeapon(weaponType);
            }
        } catch (error) {
            console.warn(`[WeaponRenderer] Failed to load ${weaponType}:`, error);
            // Fallback: create placeholder model
            this.createPlaceholderWeapon(weaponType);
        }
    }

    /**
     * Load third-person weapon
     */
    private async showThirdPersonWeapon(weaponType: WeaponType): Promise<void> {
        // DISABLED per user request: No weapon model in third person view
        return;

        /* Original implementation disabled
        if (!this.thirdPersonWeaponGroup) return;

        const assetId = this.getWeaponAssetId(weaponType);

        // Find asset config for this weapon
        const assetConfig = GAME_ASSETS.find(a => a.id === assetId);
        if (!assetConfig) {
            console.warn(`[WeaponRenderer] No asset config found for third-person ${weaponType}`);
            return;
        }

        // Load weapon model
        try {
            const gltf = await this.assetManager.loadAsset(assetConfig);

            if (gltf && gltf.scene) {
                this.currentThirdPersonWeaponModel = gltf.scene.clone();

                // Apply third-person specific transforms
                this.applyThirdPersonWeaponTransforms(weaponType);

                // Attach to player attachment point (right hand) if available
                if (this.playerWeaponAttachmentPoint) {
                    this.playerWeaponAttachmentPoint.add(this.currentThirdPersonWeaponModel!);
                    console.log(`[WeaponRenderer] Attached TP weapon to hand bone`);
                    // Reset local transform, debug offsets will be applied in update()
                    this.currentThirdPersonWeaponModel!.position.set(0, 0, 0);
                    this.currentThirdPersonWeaponModel!.rotation.set(0, 0, 0);
                } else {
                    // Fallback: Add directly to main scene if no attachment point
                    this.scene.add(this.currentThirdPersonWeaponModel!);
                    console.log(`[WeaponRenderer] WARNING: Added TP weapon directly to scene (no attachment point)`);
                }

                // Enable shadows
                this.currentThirdPersonWeaponModel!.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Set initial visibility based on current view mode
                this.currentThirdPersonWeaponModel!.visible = (this.viewMode === ViewMode.THIRD_PERSON);

                console.log(`[WeaponRenderer] Showing third-person: ${weaponType}`);
            }
        } catch (error) {
            console.warn(`[WeaponRenderer] Failed to load third-person ${weaponType}:`, error);
        }
        */
    }

    /**
     * Hide current weapon (both first-person and third-person)
     */
    hideCurrentWeapon(): void {
        // Remove first-person weapon
        if (this.currentWeaponModel) {
            this.weaponGroup.remove(this.currentWeaponModel);
            this.disposeModel(this.currentWeaponModel);
            this.currentWeaponModel = undefined;
        }

        // Remove third-person weapon
        if (this.currentThirdPersonWeaponModel) {
            // Remove from all possible parents
            this.currentThirdPersonWeaponModel.removeFromParent();
            this.disposeModel(this.currentThirdPersonWeaponModel);
            this.currentThirdPersonWeaponModel = undefined;
        }

        this.currentWeaponId = '';
    }

    /**
     * Update weapon (sway, recoil, etc.)
     * In FPP: applies sway and recoil
     * In TPP: updates weapon position relative to player
     */
    update(deltaTime: number, movementInput: { x: number; y: number }, _isFiring: boolean): void {
        // === THIRD-PERSON MODE: Update weapon position relative to player ===
        if (this.viewMode === ViewMode.THIRD_PERSON && this.currentThirdPersonWeaponModel) {
            // Handle debug input for TP weapon
            this.handleTPWeaponDebug();

            // If attached to bone, use LOCAL offsets (relative to hand)
            if (this.playerWeaponAttachmentPoint) {
                this.currentThirdPersonWeaponModel.position.copy(this.tpWeaponOffset);
                this.currentThirdPersonWeaponModel.rotation.set(this.tpWeaponRotX, this.tpWeaponRotY, this.tpWeaponRotZ);
            } else {
                // If not attached to bone (fallback), use WORLD offsets relative to player position
                // Calculate weapon world position based on player position and offset
                // Offset: X = right, Y = up, Z = forward (relative to player facing direction)
                const forwardDir = new THREE.Vector3(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
                const rightDir = new THREE.Vector3(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

                const worldPos = this.playerPosition.clone()
                    .add(forwardDir.multiplyScalar(this.tpWeaponOffset.z))
                    .add(rightDir.multiplyScalar(this.tpWeaponOffset.x))
                    .add(new THREE.Vector3(0, this.tpWeaponOffset.y, 0));

                this.currentThirdPersonWeaponModel.position.copy(worldPos);
                this.currentThirdPersonWeaponModel.rotation.set(this.tpWeaponRotX, this.playerYaw, 0);
            }
            return;
        }

        // === FIRST-PERSON MODE: Sway and recoil ===
        if (!this.currentWeaponModel || this.viewMode !== ViewMode.FIRST_PERSON) return;

        // === DEBUG: Weapon position adjustment (DISABLED) ===
        // Uncomment this.handleDebugInput() to enable weapon position debug
        // Use arrow keys to adjust X/Y, ,/. for Z, [ ] for rotation, +/- for scale
        // this.handleDebugInput();

        // Calculate weapon sway
        const swayAmount = 0.02;
        const swaySpeed = 5.0;

        this.swayVelocity.x += (movementInput.x * swayAmount - this.swayPosition.x) * swaySpeed * deltaTime;
        this.swayVelocity.y += (movementInput.y * swayAmount - this.swayPosition.y) * swaySpeed * deltaTime;

        // Damping
        this.swayVelocity.multiplyScalar(0.9);
        this.swayPosition.add(this.swayVelocity.clone().multiplyScalar(deltaTime));

        // Apply recoil recovery
        this.recoilOffset *= 0.9;

        // Apply transforms (add debug offset + sway)
        const basePos = this.debugPosition;
        this.currentWeaponModel.position.set(
            basePos.x + this.swayPosition.x,
            basePos.y + this.swayPosition.y - this.recoilOffset,
            basePos.z
        );
        this.currentWeaponModel.rotation.y = this.debugRotationY;
        this.currentWeaponModel.scale.setScalar(this.debugScale);
    }

    // === DEBUG: Weapon position variables (default: calibrated pistol values) ===
    private debugPosition: THREE.Vector3 = new THREE.Vector3(0.06, -0.13, -0.45);
    private debugRotationY: number = 3.24;
    private debugScale: number = 0.575;
    private lastKeyTime: number = 0;

    /**
     * Handle debug keyboard input for weapon positioning
     * Arrow keys: X/Y position (step: 0.005)
     * PageUp/Down: Z position
     * [ ]: Rotation Y
     * + -: Scale
     */
    public handleDebugInput(): void {
        const step = 0.005;       // Smaller step for precise positioning
        const rotStep = 0.05;     // Smaller rotation step
        const scaleStep = 0.005;  // Scale step
        const now = Date.now();

        // Throttle input
        if (now - this.lastKeyTime < 80) return;

        // Right arrow = X+, Left arrow = X-
        if ((window as any).__debugKeys?.ArrowRight) {
            this.debugPosition.x += step;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        if ((window as any).__debugKeys?.ArrowLeft) {
            this.debugPosition.x -= step;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        // Up arrow = Y+, Down arrow = Y-
        if ((window as any).__debugKeys?.ArrowUp) {
            this.debugPosition.y += step;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        if ((window as any).__debugKeys?.ArrowDown) {
            this.debugPosition.y -= step;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        // Z position: PageUp/Home/Comma = Z+ (closer), PageDown/End/Period = Z- (further)
        if ((window as any).__debugKeys?.PageUp || (window as any).__debugKeys?.Home || (window as any).__debugKeys?.Comma) {
            this.debugPosition.z += step;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        if ((window as any).__debugKeys?.PageDown || (window as any).__debugKeys?.End || (window as any).__debugKeys?.Period) {
            this.debugPosition.z -= step;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        // [ = rotate left, ] = rotate right
        if ((window as any).__debugKeys?.BracketLeft) {
            this.debugRotationY -= rotStep;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        if ((window as any).__debugKeys?.BracketRight) {
            this.debugRotationY += rotStep;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        // + = scale up, - = scale down (Equal and Minus keys)
        if ((window as any).__debugKeys?.Equal || (window as any).__debugKeys?.NumpadAdd) {
            this.debugScale += scaleStep;
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
        if ((window as any).__debugKeys?.Minus || (window as any).__debugKeys?.NumpadSubtract) {
            this.debugScale = Math.max(0.01, this.debugScale - scaleStep);
            this.lastKeyTime = now;
            this.logDebugPosition();
        }
    }

    private logDebugPosition(): void {
        console.log(`[WeaponDebug] Pos: (${this.debugPosition.x.toFixed(3)}, ${this.debugPosition.y.toFixed(3)}, ${this.debugPosition.z.toFixed(3)}), RotY: ${this.debugRotationY.toFixed(2)}, Scale: ${this.debugScale.toFixed(3)}`);
    }

    /**
     * Apply recoil kickback
     */
    applyRecoil(amount: number): void {
        this.recoilOffset = Math.min(this.recoilOffset + amount, 0.1);
    }

    /**
     * Get weapon asset ID
     */
    private getWeaponAssetId(weaponType: WeaponType): string {
        const mapping: Record<string, string> = {
            'pistol': 'weapon_pistol',
            'rifle': 'weapon_smg',            // Swapped with smg
            'shotgun': 'weapon_sniper',       // Swapped with sniper
            'smg': 'weapon_rifle',            // Swapped with rifle
            'sniper': 'weapon_shotgun',       // Swapped with shotgun
            'rocket_launcher': 'weapon_rocket_launcher',
            'flamethrower': 'weapon_pistol'
        };
        return mapping[weaponType] || 'weapon_pistol';
    }

    /**
     * Apply weapon-specific transforms and initialize debug variables
     */
    private applyWeaponTransforms(weaponType: WeaponType): void {
        if (!this.currentWeaponModel) return;

        const offset = this.weaponOffsets.get(weaponType);
        const rotation = this.weaponRotations.get(weaponType);
        const scale = this.weaponScales.get(weaponType) || 0.5;

        // Initialize debug variables from calibrated values for this weapon
        if (offset) {
            this.debugPosition.copy(offset);
            this.currentWeaponModel.position.copy(offset);
        }

        if (rotation) {
            this.debugRotationY = rotation.y;
            this.currentWeaponModel.rotation.copy(rotation);
        }

        this.debugScale = scale;
        this.currentWeaponModel.scale.setScalar(scale);

        console.log(`[WeaponRenderer] Applied transforms: ${weaponType}, pos: ${offset?.x.toFixed(2)},${offset?.y.toFixed(2)},${offset?.z.toFixed(2)}, rotY: ${rotation?.y.toFixed(2)}, scale: ${scale.toFixed(3)}`);
    }

    /**
     * Apply third-person weapon-specific transforms
     * Position is now updated every frame in update() method
     */
    private applyThirdPersonWeaponTransforms(weaponType: WeaponType): void {
        if (!this.currentThirdPersonWeaponModel) return;

        // Apply scale from calibration data
        // Priority: Specific TP scale -> First-person scale * 0.1 (fallback)
        let scale = this.tpWeaponScales.get(weaponType);

        if (scale === undefined) {
            // Fallback to previous logic if no specific TP scale defined
            scale = (this.weaponScales.get(weaponType) || 0.5) * 0.1;
        }

        this.currentThirdPersonWeaponModel.scale.setScalar(scale);

        // Also initialize offset and rotation from maps if available
        const offset = this.tpWeaponOffsets.get(weaponType);
        if (offset) this.tpWeaponOffset.copy(offset);
        else this.tpWeaponOffset.set(0, 0, 0);

        const rot = this.tpWeaponRotations.get(weaponType);
        if (rot) {
            this.tpWeaponRotX = rot.x;
            this.tpWeaponRotY = rot.y;
            this.tpWeaponRotZ = rot.z;
        } else {
            this.tpWeaponRotX = 0;
            this.tpWeaponRotY = 0;
            this.tpWeaponRotZ = 0;
        }

        console.log(`[WeaponRenderer] Applied TP transforms for ${weaponType}: Scale=${scale.toFixed(3)}`);
    }

    /**
     * DEBUG: Handle third-person weapon position adjustment
     * Arrow keys: X/Y offset
     * ,/.: Z offset (forward/back)
     * [ ]: rotation X
     */
    private handleTPWeaponDebug(): void {
        const debugKeys = (window as any).__debugKeys;
        if (!debugKeys) return;

        const posStep = 0.01;
        const rotStep = 0.05;
        const now = Date.now();
        if (now - this.lastTPDebugTime < 100) return;

        // Arrow keys: X (right/left offset)
        if (debugKeys.ArrowRight) {
            this.tpWeaponOffset.x += posStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        if (debugKeys.ArrowLeft) {
            this.tpWeaponOffset.x -= posStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        // Arrow Up/Down: Y offset (height)
        if (debugKeys.ArrowUp) {
            this.tpWeaponOffset.y += posStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        if (debugKeys.ArrowDown) {
            this.tpWeaponOffset.y -= posStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        // ,/. (Comma/Period): Z offset (forward/back)
        if (debugKeys.Comma) {
            this.tpWeaponOffset.z -= posStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        if (debugKeys.Period) {
            this.tpWeaponOffset.z += posStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        // [ ]: rotation X
        if (debugKeys.BracketLeft) {
            this.tpWeaponRotX -= rotStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        if (debugKeys.BracketRight) {
            this.tpWeaponRotX += rotStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }

        // ; / ' : rotation Y (Semicolon / Quote)
        if (debugKeys.Semicolon) {
            this.tpWeaponRotY -= rotStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        if (debugKeys.Quote) {
            this.tpWeaponRotY += rotStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }

        // N / M : rotation Z (N / M)
        if (debugKeys.KeyN) {
            this.tpWeaponRotZ -= rotStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }
        if (debugKeys.KeyM) {
            this.tpWeaponRotZ += rotStep;
            this.lastTPDebugTime = now;
            this.logTPWeaponPosition();
        }

        // Scale: I (Increase) / U (Decrease)
        const scaleStep = 0.005;
        if (debugKeys.KeyI) {
            if (this.currentThirdPersonWeaponModel) {
                const currentScale = this.currentThirdPersonWeaponModel.scale.x;
                this.currentThirdPersonWeaponModel.scale.setScalar(currentScale + scaleStep);
                this.lastTPDebugTime = now;
                this.logTPWeaponPosition();
            }
        }
        if (debugKeys.KeyU) {
            if (this.currentThirdPersonWeaponModel) {
                const currentScale = this.currentThirdPersonWeaponModel.scale.x;
                this.currentThirdPersonWeaponModel.scale.setScalar(Math.max(0.01, currentScale - scaleStep));
                this.lastTPDebugTime = now;
                this.logTPWeaponPosition();
            }
        }
    }

    private logTPWeaponPosition(): void {
        const scale = this.currentThirdPersonWeaponModel ? this.currentThirdPersonWeaponModel.scale.x : 0;
        console.log(`[WeaponRenderer] TP Debug - Offset: (${this.tpWeaponOffset.x.toFixed(2)}, ${this.tpWeaponOffset.y.toFixed(2)}, ${this.tpWeaponOffset.z.toFixed(2)}), Rot: (${this.tpWeaponRotX.toFixed(2)}, ${this.tpWeaponRotY.toFixed(2)}, ${this.tpWeaponRotZ.toFixed(2)}), Scale: ${scale.toFixed(3)}`);
    }

    /**
     * Create placeholder weapon (fallback)
     */
    private createPlaceholderWeapon(weaponType: WeaponType): void {
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const material = new THREE.MeshStandardMaterial({
            color: this.getWeaponColor(weaponType),
            roughness: 0.3,
            metalness: 0.8
        });

        this.currentWeaponModel = new THREE.Group();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'PlaceholderWeapon';
        this.currentWeaponModel.add(mesh);

        this.applyWeaponTransforms(weaponType);
        this.weaponGroup.add(this.currentWeaponModel);

        console.log(`[WeaponRenderer] Created placeholder for: ${weaponType}`);
    }

    /**
     * Get weapon color for placeholder
     */
    private getWeaponColor(weaponType: WeaponType): number {
        const colors: Record<string, number> = {
            'pistol': 0x444444,
            'rifle': 0x333333,
            'shotgun': 0x554433,
            'smg': 0x445544,
            'sniper': 0x224422,
            'rocket_launcher': 0x443333,
            'flamethrower': 0x554400
        };
        return colors[weaponType] || 0x444444;
    }

    /**
     * Dispose of model resources
     */
    private disposeModel(model: THREE.Group | undefined): void {
        if (!model) return;
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else if (child.material) {
                    child.material.dispose();
                }
            }
        });
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.hideCurrentWeapon();
        this.scene.remove(this.weaponGroup);
    }
}

export default WeaponRenderer;
