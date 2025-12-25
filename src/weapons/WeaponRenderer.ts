/**
 * Weapon Renderer
 * Renders weapon models in first-person view
 */

import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { WeaponType } from '../weapons/WeaponConfig';
import { GAME_ASSETS } from '../assets/AssetConfig';

export class WeaponRenderer {
    private scene: THREE.Scene;
    private assetManager: AssetManager;
    private weaponGroup: THREE.Group;
    private currentWeaponModel?: THREE.Group;
    private currentWeaponId: string = '';

    // Weapon position adjustments (for first-person view)
    private weaponOffsets: Map<WeaponType, THREE.Vector3> = new Map([
        ['pistol', new THREE.Vector3(0.25, -0.2, -0.5)],
        ['rifle', new THREE.Vector3(0.25, -0.22, -0.6)],
        ['shotgun', new THREE.Vector3(0.28, -0.18, -0.55)],
        ['smg', new THREE.Vector3(0.23, -0.21, -0.5)],
        ['sniper', new THREE.Vector3(0.25, -0.2, -0.65)],
        ['rocket_launcher', new THREE.Vector3(0.3, -0.15, -0.7)],
    ]);

    // Weapon rotation adjustments
    private weaponRotations: Map<WeaponType, THREE.Euler> = new Map([
        ['pistol', new THREE.Euler(0, 0, 0)],
        ['rifle', new THREE.Euler(0, 0, 0)],
        ['shotgun', new THREE.Euler(0, 0, 0)],
        ['smg', new THREE.Euler(0, 0, 0)],
        ['sniper', new THREE.Euler(0, 0, 0)],
        ['rocket_launcher', new THREE.Euler(-0.1, 0, 0)],
    ]);

    private swayPosition: THREE.Vector3 = new THREE.Vector3();
    private swayVelocity: THREE.Vector3 = new THREE.Vector3();
    private recoilOffset: number = 0;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.assetManager = AssetManager.getInstance();

        // Create weapon holder group (attached to camera)
        this.weaponGroup = new THREE.Group();
        this.weaponGroup.name = 'WeaponHolder';
        camera.add(this.weaponGroup);
    }

    /**
     * Load and show weapon model
     */
    async showWeapon(weaponType: WeaponType): Promise<void> {
        const assetId = this.getWeaponAssetId(weaponType);

        // Skip if already showing this weapon
        if (this.currentWeaponId === assetId && this.currentWeaponModel) {
            return;
        }

        // Remove current weapon model
        this.hideCurrentWeapon();

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
                this.weaponGroup.add(this.currentWeaponModel);

                // Enable shadows
                this.currentWeaponModel.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                console.log(`[WeaponRenderer] Showing: ${weaponType}`);
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
     * Hide current weapon
     */
    hideCurrentWeapon(): void {
        if (this.currentWeaponModel) {
            this.weaponGroup.remove(this.currentWeaponModel);
            this.disposeModel(this.currentWeaponModel);
            this.currentWeaponModel = undefined;
            this.currentWeaponId = '';
        }
    }

    /**
     * Update weapon (sway, recoil, etc.)
     */
    update(deltaTime: number, movementInput: { x: number; y: number }, _isFiring: boolean): void {
        if (!this.currentWeaponModel) return;

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

        // Apply transforms
        this.currentWeaponModel.position.x = this.swayPosition.x;
        this.currentWeaponModel.position.y = this.swayPosition.y - this.recoilOffset;
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
            'rifle': 'weapon_rifle',
            'shotgun': 'weapon_shotgun',
            'smg': 'weapon_smg',
            'sniper': 'weapon_sniper',
            'rocket_launcher': 'weapon_rocket_launcher',
            'flamethrower': 'weapon_pistol'
        };
        return mapping[weaponType] || 'weapon_pistol';
    }

    /**
     * Apply weapon-specific transforms
     */
    private applyWeaponTransforms(weaponType: WeaponType): void {
        if (!this.currentWeaponModel) return;

        const offset = this.weaponOffsets.get(weaponType);
        const rotation = this.weaponRotations.get(weaponType);

        if (offset) {
            this.currentWeaponModel.position.copy(offset);
        }

        if (rotation) {
            this.currentWeaponModel.rotation.copy(rotation);
        }

        // Scale weapon appropriately
        this.currentWeaponModel.scale.setScalar(0.1);
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
    private disposeModel(model: THREE.Group): void {
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
